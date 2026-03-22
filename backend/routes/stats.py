"""
GET /api/stats   — aggregate counts for charts and dashboard widgets
"""

from flask import jsonify, Blueprint
from store import alert_store

stats_bp = Blueprint("stats", __name__)


@stats_bp.route("/", methods=["GET"])
def get_stats():
    stats = alert_store.get_stats()
    return jsonify(stats), 200