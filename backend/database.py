"""
SQLite persistence layer for Netraith alerts.
Alerts survive backend restarts.
"""

import sqlite3
import json
import os
from datetime import datetime

DB_PATH = os.environ.get("NETRAITH_DB", "netraith.db")

def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS alerts (
                id          TEXT PRIMARY KEY,
                timestamp   TEXT NOT NULL,
                severity    TEXT NOT NULL,
                src_ip      TEXT,
                dest_ip     TEXT,
                src_port    INTEGER,
                dest_port   INTEGER,
                proto       TEXT,
                signature   TEXT,
                category    TEXT,
                action      TEXT,
                simulated   INTEGER DEFAULT 0,
                insider     INTEGER DEFAULT 0,
                geoip       TEXT,
                raw         TEXT
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS ai_explanations (
                alert_id    TEXT PRIMARY KEY,
                explanation TEXT NOT NULL,
                created_at  TEXT NOT NULL
            )
        """)
        conn.commit()

def save_alert(alert: dict):
    with get_conn() as conn:
        conn.execute("""
            INSERT OR IGNORE INTO alerts
            (id, timestamp, severity, src_ip, dest_ip, src_port, dest_port,
             proto, signature, category, action, simulated, insider, geoip, raw)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (
            alert.get("id"),
            alert.get("timestamp"),
            alert.get("severity"),
            alert.get("src_ip"),
            alert.get("dest_ip"),
            alert.get("src_port"),
            alert.get("dest_port"),
            alert.get("proto"),
            alert.get("signature"),
            alert.get("category"),
            alert.get("action"),
            1 if alert.get("simulated") else 0,
            1 if alert.get("insider") else 0,
            json.dumps(alert.get("geoip", {})),
            json.dumps(alert),
        ))
        conn.commit()

def load_recent_alerts(limit: int = 200) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT raw FROM alerts ORDER BY timestamp DESC LIMIT ?", (limit,)
        ).fetchall()
    return [json.loads(r["raw"]) for r in rows]

def save_ai_explanation(alert_id: str, explanation: str):
    with get_conn() as conn:
        conn.execute("""
            INSERT OR REPLACE INTO ai_explanations (alert_id, explanation, created_at)
            VALUES (?, ?, ?)
        """, (alert_id, explanation, datetime.utcnow().isoformat()))
        conn.commit()

def get_ai_explanation(alert_id: str) -> str | None:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT explanation FROM ai_explanations WHERE alert_id = ?", (alert_id,)
        ).fetchone()
    return row["explanation"] if row else None

def get_stats() -> dict:
    with get_conn() as conn:
        total    = conn.execute("SELECT COUNT(*) as c FROM alerts").fetchone()["c"]
        critical = conn.execute("SELECT COUNT(*) as c FROM alerts WHERE severity='critical'").fetchone()["c"]
        insider  = conn.execute("SELECT COUNT(*) as c FROM alerts WHERE insider=1").fetchone()["c"]
        today    = conn.execute(
            "SELECT COUNT(*) as c FROM alerts WHERE timestamp >= date('now')"
        ).fetchone()["c"]
    return {"total": total, "critical": critical, "insider": insider, "today": today}