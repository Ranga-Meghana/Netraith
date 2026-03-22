"""
POST /api/simulate/<attack_type>
"""

from flask import Blueprint, request, jsonify, current_app
from services.simulator import inject_and_emit, _ATTACKS

simulate_bp = Blueprint("simulate", __name__)

def _get_socketio():
    return current_app.extensions["socketio"]


@simulate_bp.route("/<attack_type>", methods=["POST"])
def simulate(attack_type: str):
    if attack_type not in _ATTACKS:
        return jsonify({
            "error": f"Unknown attack type '{attack_type}'.",
            "valid": list(_ATTACKS.keys()),
        }), 400

    body  = request.get_json(silent=True) or {}
    count = min(int(body.get("count", 1)), 20)

    alerts = inject_and_emit(attack_type, _get_socketio(), count)

    # ── Save to SQLite ────────────────────────────────────────────────────────
    try:
        from database import save_alert
        for a in alerts:
            # Normalize keys for database (simulator uses src_ip, dest_ip etc.)
            save_alert(a)
    except Exception as e:
        print(f"[Simulate] DB save warning: {e}")

    return jsonify({
        "message": f"Injected {len(alerts)} simulated '{attack_type}' alert(s).",
        "alerts":  alerts,
    }), 201


@simulate_bp.route("/types", methods=["GET"])
def list_types():
    return jsonify({"attack_types": list(_ATTACKS.keys())}), 200