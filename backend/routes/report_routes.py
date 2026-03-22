"""
Report API Routes
POST /api/report/generate  → returns PDF bytes
GET  /api/report/generate  → returns PDF bytes (same)
"""

from flask import Blueprint, make_response, jsonify
from report_generator import generate_report
from datetime import datetime, timezone

report_bp = Blueprint("report", __name__)

@report_bp.route("/generate", methods=["GET", "POST"])
def generate():
    try:
        pdf_bytes = generate_report()
        ts        = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        filename  = f"netraith_incident_report_{ts}.pdf"

        response = make_response(pdf_bytes)
        response.headers['Content-Type']        = 'application/pdf'
        response.headers['Content-Disposition'] = f'attachment; filename="{filename}"'
        response.headers['Content-Length']      = len(pdf_bytes)
        return response

    except Exception as e:
        import traceback
        return jsonify({
            "error":   str(e),
            "detail":  traceback.format_exc()
        }), 500