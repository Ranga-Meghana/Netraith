"""
Alert Store — shared in-memory ring buffer for Suricata alerts.
All routes and the watcher read/write through this module.
"""

from collections import deque
from threading import Lock
from config import Config

_lock  = Lock()
_store = deque(maxlen=Config.MAX_ALERTS_IN_MEMORY)

# Counters for stats endpoint
_severity_counts = {"low": 0, "medium": 0, "high": 0, "critical": 0}
_category_counts = {}
_top_src_ips     = {}

def add_alert(alert: dict) -> None:
    """Push a new alert and update counters."""
    with _lock:
        _store.append(alert)

        sev = alert.get("severity", "low")
        _severity_counts[sev] = _severity_counts.get(sev, 0) + 1

        cat = alert.get("category", "Unknown")
        _category_counts[cat] = _category_counts.get(cat, 0) + 1

        src = alert.get("src_ip", "")
        if src:
            _top_src_ips[src] = _top_src_ips.get(src, 0) + 1


def get_alerts(limit: int = 50, severity: str = None) -> list:
    """Return latest alerts, optionally filtered by severity."""
    with _lock:
        alerts = list(_store)
    if severity:
        alerts = [a for a in alerts if a.get("severity") == severity]
    return list(reversed(alerts))[:limit]


def get_stats() -> dict:
    with _lock:
        top_ips = sorted(_top_src_ips.items(), key=lambda x: x[1], reverse=True)[:10]
        return {
            "total":          len(_store),
            "severity_counts": dict(_severity_counts),
            "category_counts": dict(_category_counts),
            "top_src_ips":    [{"ip": ip, "count": c} for ip, c in top_ips],
        }


def clear() -> None:
    with _lock:
        _store.clear()
        _severity_counts.update({"low": 0, "medium": 0, "high": 0, "critical": 0})
        _category_counts.clear()
        _top_src_ips.clear()