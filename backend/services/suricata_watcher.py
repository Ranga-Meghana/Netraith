"""
Suricata Log Watcher — Updated with Auto-Block
Tails eve.json and emits alerts via Socket.IO.
Critical alerts are auto-blocked via firewall engine.
"""

import json
import os
import time
import threading
from datetime import datetime, timezone

try:
    from database  import save_alert
    from firewall  import block_ip, is_blocked, AUTO_BLOCK_SEVERITIES_SET
except Exception:
    def save_alert(a): pass
    def block_ip(**kwargs): return {"success": False}
    def is_blocked(ip): return False

AUTO_BLOCK_SEVERITIES = {"critical"}
AUTO_BLOCK_CATEGORIES = {
    "Denial of Service",
    "Web Application Attack",
    "Malware Command and Control",
    "Insider Threat - Data Exfiltration",
    "Insider Threat - Privilege Abuse",
}

LOG_PATH = os.environ.get(
    "SURICATA_LOG_PATH",
    "/var/log/suricata/eve.json"
)

class SuricataWatcher:
    def __init__(self, socketio):
        self.socketio = socketio
        self._stop    = threading.Event()

    def start(self):
        print(f"[Watcher] Started tailing {LOG_PATH}")
        while not self._stop.is_set():
            try:
                self._tail()
            except FileNotFoundError:
                print(f"[Watcher] {LOG_PATH} not found — retrying in 5s…")
                time.sleep(5)
            except Exception as e:
                print(f"[Watcher] Error: {e} — retrying in 5s…")
                time.sleep(5)

    def _tail(self):
        with open(LOG_PATH, "r", encoding="utf-8", errors="replace") as f:
            f.seek(0, 2)  # seek to end
            while not self._stop.is_set():
                line = f.readline()
                if not line:
                    time.sleep(0.1)
                    continue
                self._process(line.strip())

    def _process(self, line: str):
        try:
            data = json.loads(line)
        except json.JSONDecodeError:
            return

        if data.get("event_type") != "alert":
            return

        alert_data = data.get("alert", {})
        severity   = self._map_severity(alert_data.get("severity", 3))
        src_ip     = data.get("src_ip", "")

        alert = {
            "id":        f"suri-{data.get('flow_id', int(time.time()*1000))}",
            "timestamp": data.get("timestamp", datetime.now(timezone.utc).isoformat()),
            "severity":  severity,
            "src_ip":    src_ip,
            "dest_ip":   data.get("dest_ip", ""),
            "src_port":  data.get("src_port"),
            "dest_port": data.get("dest_port"),
            "proto":     data.get("proto", ""),
            "signature": alert_data.get("signature", ""),
            "category":  alert_data.get("category", ""),
            "action":    alert_data.get("action", "allowed"),
            "simulated": False,
            "insider":   False,
            "geoip":     {},
        }

        # Save to DB
        try:
            save_alert(alert)
        except Exception:
            pass

        # Auto-block critical IPs
        self._maybe_block(alert)

        # Emit to frontend
        self.socketio.emit("new_alert", alert)

    def _maybe_block(self, alert: dict):
        severity = alert.get("severity", "")
        category = alert.get("category", "")
        ip       = alert.get("src_ip", "")

        if not ip:
            return
        if severity not in AUTO_BLOCK_SEVERITIES and category not in AUTO_BLOCK_CATEGORIES:
            return
        if is_blocked(ip):
            return

        result = block_ip(
            ip        = ip,
            reason    = f"Auto: {alert.get('signature', '')}",
            severity  = severity,
            signature = alert.get("signature", ""),
        )

        if result.get("success"):
            # Notify frontend of the block
            self.socketio.emit("ip_blocked", {
                "ip":        ip,
                "severity":  severity,
                "signature": alert.get("signature"),
                "auto":      True,
                "alert_id":  alert.get("id"),
            })
            print(f"[AutoBlock] Blocked {ip} — {alert.get('signature')}")

    def _map_severity(self, sev) -> str:
        if isinstance(sev, str):
            return sev.lower()
        m = {1: "critical", 2: "high", 3: "medium", 4: "low"}
        return m.get(int(sev), "medium")

    def stop(self):
        self._stop.set()