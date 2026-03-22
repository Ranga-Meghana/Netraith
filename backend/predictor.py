"""
Netraith Predictive Threat Engine
Pure Python ML — no scikit-learn needed.
Uses frequency analysis, time-series patterns, and Bayesian probability.
"""

import sqlite3
import json
import os
from datetime import datetime, timezone, timedelta
from collections import defaultdict, Counter
import math

DB_PATH = os.environ.get("NETRAITH_DB", "netraith.db")

def _get_alerts(hours_back: int = 48) -> list[dict]:
    try:
        since = (datetime.now(timezone.utc) - timedelta(hours=hours_back)).isoformat()
        with sqlite3.connect(DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute("""
                SELECT severity, category, src_ip, timestamp, dest_port
                FROM alerts
                WHERE timestamp >= ?
                ORDER BY timestamp ASC
            """, (since,)).fetchall()
        return [dict(r) for r in rows]
    except Exception:
        return []

def _hour_of(ts: str) -> int:
    try:
        return datetime.fromisoformat(ts.replace('Z', '+00:00')).hour
    except Exception:
        return 0

def _map_category(cat: str) -> str:
    cat = (cat or '').upper()
    if 'DOS' in cat or 'DENIAL' in cat:          return 'DDoS Attack'
    if 'SQL' in cat or 'WEB' in cat:             return 'Web Attack'
    if 'BRUTE' in cat or 'ADMIN' in cat:         return 'Brute Force'
    if 'MALWARE' in cat or 'C2' in cat:          return 'Malware/C2'
    if 'SCAN' in cat or 'NETWORK' in cat:        return 'Port Scan'
    if 'INSIDER' in cat or 'POLICY' in cat:      return 'Insider Threat'
    if 'EXFIL' in cat or 'DATA' in cat:          return 'Data Exfiltration'
    return 'Unknown'

def _sigmoid(x: float) -> float:
    return 1 / (1 + math.exp(-x))

def predict() -> dict:
    alerts = _get_alerts(hours_back=48)
    now    = datetime.now(timezone.utc)
    hour   = now.hour

    if len(alerts) < 3:
        return {
            "status":      "insufficient_data",
            "message":     "Need more alerts for prediction. Simulate some attacks first.",
            "predictions": [],
            "risk_score":  0,
            "peak_hours":  [],
            "top_sources": [],
            "trend":       "stable",
        }

    # ── 1. Category frequency ──────────────────────────────────────────────
    cat_counts   = Counter(_map_category(a['category']) for a in alerts)
    total        = len(alerts)

    # ── 2. Hourly distribution ─────────────────────────────────────────────
    hourly = defaultdict(int)
    for a in alerts:
        hourly[_hour_of(a['timestamp'])] += 1

    peak_hours = sorted(hourly, key=hourly.get, reverse=True)[:3]

    # ── 3. Severity trend (last 6h vs previous 6h) ─────────────────────────
    cutoff  = (now - timedelta(hours=6)).isoformat()
    recent  = [a for a in alerts if a['timestamp'] >= cutoff]
    older   = [a for a in alerts if a['timestamp'] <  cutoff]

    recent_crit = sum(1 for a in recent if a['severity'] == 'critical')
    older_crit  = sum(1 for a in older  if a['severity'] == 'critical') / max(len(older), 1) * max(len(recent), 1)
    trend = 'escalating' if recent_crit > older_crit * 1.3 else \
            'declining'  if recent_crit < older_crit * 0.7 else 'stable'

    # ── 4. Top source IPs ──────────────────────────────────────────────────
    ip_counts  = Counter(a['src_ip'] for a in alerts if a.get('src_ip'))
    top_sources = [{"ip": ip, "count": cnt} for ip, cnt in ip_counts.most_common(5)]

    # ── 5. Build predictions ───────────────────────────────────────────────
    predictions = []

    for cat, count in cat_counts.most_common(5):
        base_prob = count / total

        # Time-of-day boost — if current hour is in attack's peak hours
        cat_hours = [_hour_of(a['timestamp']) for a in alerts if _map_category(a['category']) == cat]
        hour_freq = cat_hours.count(hour) / max(len(cat_hours), 1)
        time_boost = hour_freq * 0.3

        # Trend boost
        recent_cat = sum(1 for a in recent if _map_category(a['category']) == cat)
        older_cat  = sum(1 for a in older  if _map_category(a['category']) == cat)
        trend_boost = 0.15 if recent_cat > older_cat else -0.05

        # Final probability
        raw_prob    = base_prob + time_boost + trend_boost
        probability = round(min(0.97, max(0.05, _sigmoid(raw_prob * 4 - 1))), 2)

        # Time window prediction
        next_hours = max(1, round(6 / max(base_prob * 10, 0.1)))
        next_hours = min(next_hours, 24)

        # Severity prediction
        cat_alerts  = [a for a in alerts if _map_category(a['category']) == cat]
        crit_ratio  = sum(1 for a in cat_alerts if a['severity'] == 'critical') / max(len(cat_alerts), 1)
        pred_severity = 'CRITICAL' if crit_ratio > 0.5 else 'HIGH' if crit_ratio > 0.25 else 'MEDIUM'

        predictions.append({
            "attack_type":  cat,
            "probability":  probability,
            "confidence":   round(min(0.95, base_prob * 2 + 0.4), 2),
            "time_window":  f"Next {next_hours}h",
            "next_hours":   next_hours,
            "severity":     pred_severity,
            "based_on":     count,
            "trend":        "↑ increasing" if trend_boost > 0 else "↓ decreasing",
        })

    # Sort by probability
    predictions.sort(key=lambda x: x['probability'], reverse=True)

    # ── 6. Overall risk score (0-100) ──────────────────────────────────────
    crit_weight  = sum(1 for a in recent if a['severity'] == 'critical') * 10
    high_weight  = sum(1 for a in recent if a['severity'] == 'high') * 5
    volume_score = min(len(recent) * 3, 30)
    trend_score  = 20 if trend == 'escalating' else 0
    risk_score   = min(100, crit_weight + high_weight + volume_score + trend_score)

    # ── 7. Next likely attack ──────────────────────────────────────────────
    next_attack = predictions[0] if predictions else None

    return {
        "status":       "ok",
        "generated_at": now.isoformat(),
        "total_analyzed": total,
        "predictions":  predictions[:5],
        "risk_score":   risk_score,
        "peak_hours":   peak_hours,
        "top_sources":  top_sources,
        "trend":        trend,
        "next_attack":  next_attack,
        "summary": (
            f"Based on {total} alerts in the last 48h, "
            f"threat level is {trend}. "
            f"Highest risk: {next_attack['attack_type']} "
            f"({int(next_attack['probability']*100)}% probability in {next_attack['time_window']})."
            if next_attack else "Insufficient data for prediction."
        ),
    }