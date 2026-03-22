"""
Firewall API Routes
POST /api/firewall/block        { ip, reason, severity, signature }
POST /api/firewall/unblock      { ip }
GET  /api/firewall/blocked      → list of blocked IPs
GET  /api/firewall/stats        → block counts
POST /api/firewall/auto-block   { alert } → auto-decide + block
"""

from flask import Blueprint, request, jsonify, current_app
from firewall import block_ip, unblock_ip, get_blocked_ips, is_blocked, get_block_stats, init_firewall_db

firewall_bp = Blueprint("firewall", __name__)
init_firewall_db()

# Severities that trigger auto-block
AUTO_BLOCK_SEVERITIES = {"critical"}
AUTO_BLOCK_CATEGORIES = {
    "Denial of Service",
    "Web Application Attack",
    "Malware Command and Control",
    "Insider Threat - Data Exfiltration",
    "Insider Threat - Privilege Abuse",
}

@firewall_bp.route("/block", methods=["POST"])
def manual_block():
    body = request.get_json(silent=True) or {}
    ip   = body.get("ip", "").strip()
    if not ip:
        return jsonify({"error": "IP required"}), 400

    result = block_ip(
        ip        = ip,
        reason    = body.get("reason", "Manual block"),
        severity  = body.get("severity", "unknown"),
        signature = body.get("signature", "Manual"),
    )

    # Emit socket event so dashboard updates live
    try:
        sio = current_app.extensions["socketio"]
        sio.emit("ip_blocked", {"ip": ip, "reason": result.get("message")})
    except Exception:
        pass

    return jsonify(result), 200 if result["success"] else 409


@firewall_bp.route("/unblock", methods=["POST"])
def manual_unblock():
    body = request.get_json(silent=True) or {}
    ip   = body.get("ip", "").strip()
    if not ip:
        return jsonify({"error": "IP required"}), 400

    result = unblock_ip(ip)

    try:
        sio = current_app.extensions["socketio"]
        sio.emit("ip_unblocked", {"ip": ip})
    except Exception:
        pass

    return jsonify(result), 200


@firewall_bp.route("/blocked", methods=["GET"])
def list_blocked():
    return jsonify(get_blocked_ips()), 200


@firewall_bp.route("/stats", methods=["GET"])
def stats():
    return jsonify(get_block_stats()), 200


@firewall_bp.route("/auto-block", methods=["POST"])
def auto_block():
    """Called internally when a new alert arrives — decides whether to block."""
    body  = request.get_json(silent=True) or {}
    alert = body.get("alert", {})
    ip    = alert.get("src_ip") or alert.get("srcIp", "")

    if not ip:
        return jsonify({"blocked": False, "reason": "No IP"}), 200

    severity = alert.get("severity", "").lower()
    category = alert.get("category", "")

    should_block = (
        severity in AUTO_BLOCK_SEVERITIES or
        category in AUTO_BLOCK_CATEGORIES
    )

    if not should_block:
        return jsonify({"blocked": False, "reason": "Below threshold"}), 200

    if is_blocked(ip):
        return jsonify({"blocked": False, "reason": "Already blocked"}), 200

    result = block_ip(
        ip        = ip,
        reason    = f"Auto-blocked: {alert.get('signature', 'Unknown')}",
        severity  = severity,
        signature = alert.get("signature", ""),
    )

    if result["success"]:
        try:
            sio = current_app.extensions["socketio"]
            sio.emit("ip_blocked", {
                "ip":        ip,
                "severity":  severity,
                "signature": alert.get("signature"),
                "auto":      True,
            })
        except Exception:
            pass

    return jsonify({**result, "blocked": result["success"]}), 200