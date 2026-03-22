"""
AI Analysis Service
Generates human-readable threat summaries.

Two modes:
  1. Rule-based (always works, no API key needed)
  2. OpenAI GPT (set OPENAI_API_KEY in config / env)
"""

import re
from config import Config

# ── Rule-based patterns ────────────────────────────────────────────────────────
_RULES = [
    (r"brute.?force|ssh.*failed|multiple.*login", "critical",
     "Brute force attack detected — multiple failed authentication attempts from {src_ip}. "
     "Consider blocking this IP immediately."),

    (r"port.?scan|nmap|masscan",               "high",
     "Port scan detected from {src_ip}. The attacker is mapping your open services. "
     "Check for follow-up exploitation attempts."),

    (r"sql.?inject",                            "critical",
     "SQL Injection attempt detected from {src_ip} targeting {dest_ip}:{dest_port}. "
     "Verify your application's input sanitisation."),

    (r"ddos|flood|syn.*flood",                 "critical",
     "DDoS / flood attack detected from {src_ip}. "
     "Rate limiting and upstream filtering are recommended."),

    (r"xss|cross.?site",                       "high",
     "Cross-Site Scripting (XSS) attempt from {src_ip}. "
     "Sanitise all user-supplied output in your web application."),

    (r"recon|reconnaissance|scan",             "medium",
     "Reconnaissance activity from {src_ip}. "
     "No immediate threat, but monitor for follow-up attacks."),

    (r"malware|trojan|backdoor|c2|c&c",        "critical",
     "Potential malware / C2 communication detected involving {src_ip}. "
     "Isolate the affected host and run a full AV scan."),

    (r"dos|denial.?of.?service",               "high",
     "Denial-of-Service attempt detected from {src_ip}. "
     "Review your rate-limiting and firewall rules."),
]


def _rule_summary(alert: dict) -> dict:
    sig = alert.get("signature", "").lower()
    cat = alert.get("category",  "").lower()
    text = sig + " " + cat

    for pattern, risk, template in _RULES:
        if re.search(pattern, text, re.IGNORECASE):
            return {
                "summary":      template.format(**alert),
                "risk_level":   risk,
                "confidence":   "rule-based",
                "recommended":  _recommend(risk),
            }

    return {
        "summary":    f"Security event detected from {alert.get('src_ip','?')} "
                      f"— signature: \"{alert.get('signature','Unknown')}\". "
                      f"Review this alert manually.",
        "risk_level": alert.get("severity", "low"),
        "confidence": "rule-based",
        "recommended": _recommend(alert.get("severity", "low")),
    }


def _recommend(risk: str) -> str:
    return {
        "critical": "Block IP immediately, alert SOC, investigate affected hosts.",
        "high":     "Monitor closely, consider temporary block, check logs.",
        "medium":   "Log and monitor. Investigate if activity persists.",
        "low":      "No action required. Archive for baseline analysis.",
    }.get(risk, "Review manually.")


def _openai_summary(alert: dict) -> dict:
    """Call OpenAI if an API key is configured."""
    try:
        import openai
        openai.api_key = Config.OPENAI_API_KEY
        prompt = (
            f"You are a senior cybersecurity analyst. "
            f"Summarise this Suricata alert in 2 sentences and rate the risk:\n"
            f"{alert}"
        )
        resp = openai.ChatCompletion.create(
            model=Config.AI_MODEL,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=150,
        )
        return {
            "summary":    resp.choices[0].message.content.strip(),
            "risk_level": alert.get("severity", "low"),
            "confidence": "ai-powered",
            "recommended": _recommend(alert.get("severity", "low")),
        }
    except Exception as e:
        print(f"[AI] OpenAI call failed ({e}), falling back to rules.")
        return _rule_summary(alert)


def analyse(alert: dict) -> dict:
    """Return an AI/rule-based analysis dict for a given alert."""
    if Config.OPENAI_API_KEY:
        return _openai_summary(alert)
    return _rule_summary(alert)


def batch_analyse(alerts: list[dict]) -> dict:
    """
    Aggregate analysis across a list of alerts.
    Returns a high-level threat overview.
    """
    if not alerts:
        return {"overview": "No alerts to analyse.", "threat_level": "none"}

    counts = {}
    for a in alerts:
        s = a.get("severity", "low")
        counts[s] = counts.get(s, 0) + 1

    dominant = max(counts, key=counts.get)
    total    = len(alerts)

    return {
        "overview":      (
            f"Analysed {total} alert(s). "
            f"Dominant severity: {dominant.upper()} ({counts[dominant]} events). "
            f"Breakdown — " +
            ", ".join(f"{k}: {v}" for k, v in counts.items()) + "."
        ),
        "threat_level":  dominant,
        "breakdown":     counts,
        "recommended":   _recommend(dominant),
    }