"""
Netraith Backend Configuration
Edit these values to match your environment.
"""

import os

class Config:
    # ── Flask ─────────────────────────────────────────────────────────────────
    SECRET_KEY = os.environ.get("SECRET_KEY", "netraith-dev-secret-change-in-prod")
    DEBUG      = os.environ.get("FLASK_DEBUG", "true").lower() == "true"

    # ── CORS ──────────────────────────────────────────────────────────────────
    # Add your React dev server origin here
    ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173").split(",")

    # ── Suricata ──────────────────────────────────────────────────────────────
    # Path to Suricata's eve.json output file (Linux default shown)
    SURICATA_LOG_PATH = os.environ.get(
        "SURICATA_LOG_PATH", "/var/log/suricata/eve.json"
    )

    # ── In-memory alert store ─────────────────────────────────────────────────
    # Max number of alerts to keep in memory (acts as a ring buffer)
    MAX_ALERTS_IN_MEMORY = int(os.environ.get("MAX_ALERTS_IN_MEMORY", 500))

    # ── AI Analysis ───────────────────────────────────────────────────────────
    # Set to your OpenAI / local LLM endpoint, or leave blank to use rule-based summaries
    OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
    AI_MODEL       = os.environ.get("AI_MODEL", "gpt-3.5-turbo")