"""
Prediction API Routes
GET /api/predict          → full prediction report
GET /api/predict/summary  → quick risk score + next attack
"""

from flask import Blueprint, jsonify
from predictor import predict

predict_bp = Blueprint("predict", __name__)

@predict_bp.route("/", methods=["GET"])
def get_prediction():
    try:
        result = predict()
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": str(e), "status": "error"}), 500

@predict_bp.route("/summary", methods=["GET"])
def get_summary():
    try:
        result = predict()
        return jsonify({
            "risk_score":  result.get("risk_score", 0),
            "trend":       result.get("trend", "stable"),
            "next_attack": result.get("next_attack"),
            "summary":     result.get("summary", ""),
            "status":      result.get("status"),
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500