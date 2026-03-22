"""
Suricata Log Forwarder
Reads eve.json and forwards alerts to the Render backend.
"""

import json
import requests
import time
import os

LOG_PATH   = os.environ.get("SURICATA_LOG_PATH", "/var/log/suricata/eve.json")
BACKEND    = os.environ.get("BACKEND_URL", "https://netraith-backend.onrender.com")
API_KEY    = os.environ.get("SECRET_KEY", "netraith-dev-secret-change-in-prod")

def forward_alert(alert: dict):
    try:
        response = requests.post(
            f"{BACKEND}/api/alerts/ingest",
            json=alert,
            headers={"X-Secret-Key": API_KEY},
            timeout=5
        )
        print(f"[Forwarder] Sent alert → {response.status_code}")
    except Exception as e:
        print(f"[Forwarder] Error sending alert: {e}")

def tail_log(path: str):
    print(f"[Forwarder] Watching {path}")
    with open(path) as f:
        f.seek(0, 2)  # jump to end of file
        while True:
            line = f.readline()
            if line:
                try:
                    event = json.loads(line)
                    if event.get("event_type") == "alert":
                        print(f"[Forwarder] Alert detected: {event.get('alert', {}).get('signature')}")
                        forward_alert(event)
                except json.JSONDecodeError:
                    pass
            else:
                time.sleep(0.5)

if __name__ == "__main__":
    while True:
        try:
            tail_log(LOG_PATH)
        except FileNotFoundError:
            print(f"[Forwarder] Waiting for {LOG_PATH}...")
            time.sleep(5)
        except Exception as e:
            print(f"[Forwarder] Unexpected error: {e}")
            time.sleep(5)
