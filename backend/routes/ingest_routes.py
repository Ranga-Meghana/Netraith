"""
Alert Ingest Route
Receives alerts from the Suricata forwarder.
"""

from flask import Blueprint, request, jsonify, current_app
from database import save_alert
from config import Config
import uuid
from datetime import datetime, timezone

ingest_bp = Blueprint("ingest", __name__)

@ingest_bp.route("/ingest", methods=["POST"])
def ingest_alert():
    # Simple secret key check
    key = request.headers.get("X-Secret-Key")
    if key != Config.SECRET_KEY:
        return jsonify({"error": "Unauthorized"}), 401

    raw = request.get_json()
    if not raw:
        return jsonify({"error": "No data"}), 400

    alert = {
        "id":        raw.get("flow_id", str(uuid.uuid4())),
        "timestamp": raw.get("timestamp", datetime.now(timezone.utc).isoformat()),
        "severity":  _map_severity(raw.get("alert", {}).get("severity", 3)),
        "src_ip":    raw.get("src_ip"),
        "dest_ip":   raw.get("dest_ip"),
        "src_port":  raw.get("src_port"),
        "dest_port": raw.get("dest_port"),
        "proto":     raw.get("proto"),
        "signature": raw.get("alert", {}).get("signature", "Unknown"),
        "category":  raw.get("alert", {}).get("category", "Generic"),
        "action":    raw.get("alert", {}).get("action", "allowed"),
        "simulated": False,
        "insider":   False,
        "geoip":     {},
    }

    save_alert(alert)

    # Emit via WebSocket to live dashboard
    socketio = current_app.extensions.get("socketio")
    if socketio:
        socketio.emit("new_alert", alert)

    return jsonify({"status": "ok"}), 200

def _map_severity(level: int) -> str:
    if level == 1: return "critical"
    if level == 2: return "high"
    if level == 3: return "medium"
    return "low"
