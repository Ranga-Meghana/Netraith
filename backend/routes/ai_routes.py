"""
AI Threat Explanation route — uses Claude API
POST /api/ai/explain  { "alert": {...} }
GET  /api/ai/explain/<alert_id>
GET  /api/ai/stats
"""

import json
import urllib.request
import urllib.error
from flask import Blueprint, request, jsonify, current_app

try:
    from database import save_ai_explanation, get_ai_explanation, get_stats
except ImportError:
    def save_ai_explanation(aid, exp): pass
    def get_ai_explanation(aid): return None
    def get_stats(): return {}

ai_bp = Blueprint("ai_explain", __name__)

CLAUDE_MODEL  = "claude-sonnet-4-20250514"
CLAUDE_URL    = "https://api.anthropic.com/v1/messages"
ANTHROPIC_KEY = "YOUR_API_KEY_HERE"  # Set via env: ANTHROPIC_API_KEY

import os
ANTHROPIC_KEY = os.environ.get("ANTHROPIC_API_KEY", ANTHROPIC_KEY)

SYSTEM_PROMPT = """You are a senior cybersecurity analyst at a SOC (Security Operations Center).
When given a network alert, explain it clearly and concisely in exactly this format:

**ATTACK TYPE:** [1 line — what kind of attack this is]
**HOW IT WORKS:** [2-3 sentences — plain English explanation of the attack mechanism]
**RISK LEVEL:** [Critical/High/Medium/Low] — [1 sentence why]
**IMMEDIATE ACTION:** [2-3 bullet points of specific steps to take right now]
**INVESTIGATION:** [1-2 sentences on what to check/investigate further]

Keep it professional, technical but readable. No fluff. Be direct."""

def call_claude(alert: dict) -> str:
    prompt = f"""Analyze this Suricata IDS alert and explain it:

Signature:  {alert.get('signature', 'Unknown')}
Category:   {alert.get('category', 'Unknown')}
Severity:   {alert.get('severity', 'unknown').upper()}
Source IP:  {alert.get('src_ip', 'Unknown')}
Protocol:   {alert.get('proto', 'Unknown')}
Dest Port:  {alert.get('dest_port', 'Unknown')}
Simulated:  {alert.get('simulated', False)}
Insider:    {alert.get('insider', False)}"""

    payload = json.dumps({
        "model":      CLAUDE_MODEL,
        "max_tokens": 600,
        "system":     SYSTEM_PROMPT,
        "messages":   [{"role": "user", "content": prompt}],
    }).encode()

    req = urllib.request.Request(
        CLAUDE_URL,
        data=payload,
        headers={
            "Content-Type":      "application/json",
            "x-api-key":         ANTHROPIC_KEY,
            "anthropic-version": "2023-06-01",
        },
        method="POST",
    )

    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read())
        return data["content"][0]["text"]


@ai_bp.route("/explain", methods=["POST"])
def explain():
    body  = request.get_json(silent=True) or {}
    alert = body.get("alert", {})
    if not alert:
        return jsonify({"error": "No alert provided"}), 400

    alert_id = alert.get("id", "")

    # Check cache first
    cached = get_ai_explanation(alert_id)
    if cached:
        return jsonify({"explanation": cached, "cached": True}), 200

    try:
        explanation = call_claude(alert)
        save_ai_explanation(alert_id, explanation)
        return jsonify({"explanation": explanation, "cached": False}), 200
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        return jsonify({"error": f"Claude API error: {e.code}", "detail": body}), 502
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@ai_bp.route("/explain/<alert_id>", methods=["GET"])
def get_cached(alert_id: str):
    exp = get_ai_explanation(alert_id)
    if exp:
        return jsonify({"explanation": exp, "cached": True}), 200
    return jsonify({"error": "Not found"}), 404


@ai_bp.route("/stats", methods=["GET"])
def stats():
    return jsonify(get_stats()), 200