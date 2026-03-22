"""
POST /api/ai/analyse        — analyse a single alert dict (pass in body)
GET  /api/ai/summary        — batch summary of latest N alerts
"""

from flask import Blueprint, request, jsonify
from services.ai_analysis import analyse, batch_analyse
from store import alert_store

ai_bp = Blueprint("ai", __name__)


@ai_bp.route("/analyse", methods=["POST"])
def analyse_single():
    alert = request.get_json(silent=True)
    if not alert:
        return jsonify({"error": "No alert data provided."}), 400

    result = analyse(alert)
    return jsonify(result), 200


@ai_bp.route("/summary", methods=["GET"])
def batch_summary():
    limit  = int(request.args.get("limit", 50))
    alerts = alert_store.get_alerts(limit=limit)
    result = batch_analyse(alerts)
    return jsonify(result), 200