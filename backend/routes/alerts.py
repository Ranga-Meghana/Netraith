"""
GET /api/alerts          — list recent alerts (with optional filters)
DELETE /api/alerts       — clear all alerts
"""

from flask import Blueprint, request, jsonify
from store import alert_store

alerts_bp = Blueprint("alerts", __name__)


@alerts_bp.route("/", methods=["GET"])
def get_alerts():
    limit    = int(request.args.get("limit", 50))
    severity = request.args.get("severity")          # low | medium | high | critical

    alerts = alert_store.get_alerts(limit=limit, severity=severity)
    return jsonify({"alerts": alerts, "count": len(alerts)}), 200


@alerts_bp.route("/", methods=["DELETE"])
def clear_alerts():
    alert_store.clear()
    return jsonify({"message": "Alert store cleared."}), 200