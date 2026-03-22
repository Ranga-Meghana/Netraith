"""
Attack Simulator Service — Updated with Insider Threat support
"""

import random
import time
import uuid
from datetime import datetime, timezone

from store import alert_store

_ATTACKS = {
    "sql_injection": {
        "signature": "ET WEB_SERVER SQL Injection Attempt",
        "category":  "Web Application Attack",
        "severity":  "critical",
        "proto":     "TCP",
        "dest_port": 80,
    },
    "port_scan": {
        "signature": "ET SCAN Nmap Scanning Attempt",
        "category":  "Network Scan",
        "severity":  "medium",
        "proto":     "TCP",
        "dest_port": 0,
    },
    "ddos": {
        "signature": "ET DOS Potential DDoS Inbound SYN Flood",
        "category":  "Denial of Service",
        "severity":  "critical",
        "proto":     "TCP",
        "dest_port": 443,
    },
    "brute_force": {
        "signature": "ET SCAN Potential SSH BruteForce Attempt",
        "category":  "Attempted Administrator Privilege Gain",
        "severity":  "high",
        "proto":     "TCP",
        "dest_port": 22,
    },
    "xss": {
        "signature": "ET WEB_SERVER XSS Attempt URI",
        "category":  "Web Application Attack",
        "severity":  "high",
        "proto":     "TCP",
        "dest_port": 8080,
    },
    "malware": {
        "signature": "ET MALWARE Known Ransomware C2 Domain",
        "category":  "Malware Command and Control",
        "severity":  "critical",
        "proto":     "TCP",
        "dest_port": 4444,
    },
    # ── INSIDER THREAT TYPES ──────────────────────────────────────────────────
    "insider_data_exfil": {
        "signature": "ET POLICY Unusual Outbound Data Volume Detected",
        "category":  "Insider Threat - Data Exfiltration",
        "severity":  "critical",
        "proto":     "TCP",
        "dest_port": 443,
    },
    "insider_after_hours": {
        "signature": "ET POLICY After-Hours System Access Detected",
        "category":  "Insider Threat - Unauthorized Access",
        "severity":  "high",
        "proto":     "TCP",
        "dest_port": 22,
    },
    "insider_privilege_abuse": {
        "signature": "ET POLICY Privilege Escalation Attempt - Internal",
        "category":  "Insider Threat - Privilege Abuse",
        "severity":  "critical",
        "proto":     "TCP",
        "dest_port": 3389,
    },
    "insider_mass_download": {
        "signature": "ET POLICY Mass File Download from Internal Server",
        "category":  "Insider Threat - Data Theft",
        "severity":  "high",
        "proto":     "TCP",
        "dest_port": 445,
    },
    "insider_usb": {
        "signature": "ET POLICY USB Mass Storage Device Connected",
        "category":  "Insider Threat - Removable Media",
        "severity":  "medium",
        "proto":     "TCP",
        "dest_port": 0,
    },
}

# Internal IPs for insider threats (look like they come from inside)
_INTERNAL_IPS = [
    "192.168.20.12",  # ws2 — compromised workstation
    "192.168.20.15",  # ws5 — compromised
    "192.168.10.5",   # srv1 — file server insider
    "192.168.20.14",  # ws4
    "10.0.0.23",
]

_GEO_POOL = [
    {"country": "Russia",        "lat": 55.75,  "lon":  37.62},
    {"country": "China",         "lat": 39.91,  "lon": 116.39},
    {"country": "United States", "lat": 37.77,  "lon": -122.42},
    {"country": "Brazil",        "lat": -23.55, "lon": -46.63},
    {"country": "Germany",       "lat": 52.52,  "lon":  13.40},
    {"country": "India",         "lat": 28.61,  "lon":  77.21},
    {"country": "North Korea",   "lat": 39.03,  "lon": 125.75},
    {"country": "Iran",          "lat": 35.69,  "lon":  51.39},
]


def _random_ip(insider: bool = False) -> str:
    if insider:
        return random.choice(_INTERNAL_IPS)
    return "{}.{}.{}.{}".format(
        random.randint(1, 223),
        random.randint(0, 255),
        random.randint(0, 255),
        random.randint(1, 254),
    )


def build_alert(attack_type: str, count: int = 1) -> list[dict]:
    template = _ATTACKS.get(attack_type)
    if not template:
        raise ValueError(f"Unknown attack type: {attack_type}")

    is_insider = "insider" in attack_type
    alerts = []
    for _ in range(count):
        geo  = random.choice(_GEO_POOL)
        port = template["dest_port"] or random.randint(1, 65535)

        alert = {
            "id":        str(uuid.uuid4()),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "severity":  template["severity"],
            "src_ip":    _random_ip(insider=is_insider),
            "src_port":  random.randint(1024, 65535),
            "dest_ip":   "10.0.0." + str(random.randint(1, 50)),
            "dest_port": port,
            "proto":     template["proto"],
            "signature": template["signature"],
            "category":  template["category"],
            "action":    "blocked" if template["severity"] in ("critical", "high") else "allowed",
            "simulated": True,
            "insider":   is_insider,
            "geoip": {
                "country": "Internal Network" if is_insider else geo["country"],
                "lat":     17.4 if is_insider else geo["lat"] + random.uniform(-2, 2),
                "lon":     78.5 if is_insider else geo["lon"] + random.uniform(-2, 2),
            },
        }
        alerts.append(alert)
    return alerts


def inject_and_emit(attack_type: str, socketio, count: int = 1) -> list[dict]:
    alerts = build_alert(attack_type, count)
    for a in alerts:
        alert_store.add_alert(a)
        socketio.emit("new_alert", a)
        if count > 1:
            time.sleep(0.05)
    return alerts