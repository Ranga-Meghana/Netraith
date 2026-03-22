"""
Netraith Firewall Engine
Auto-blocks malicious IPs via iptables.
Works on Linux (WSL) — called from Flask backend.
"""

import subprocess
import sqlite3
import json
import os
from datetime import datetime

DB_PATH = os.environ.get("NETRAITH_DB", "netraith.db")

# ── DB setup ──────────────────────────────────────────────────────────────────
def init_firewall_db():
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS blocked_ips (
                ip          TEXT PRIMARY KEY,
                reason      TEXT,
                severity    TEXT,
                signature   TEXT,
                blocked_at  TEXT,
                unblocked   INTEGER DEFAULT 0
            )
        """)
        conn.commit()

# ── iptables helpers ──────────────────────────────────────────────────────────
def _run(cmd: list[str]) -> tuple[bool, str]:
    try:
        r = subprocess.run(
            cmd, capture_output=True, text=True, timeout=10
        )
        return r.returncode == 0, r.stdout + r.stderr
    except Exception as e:
        return False, str(e)

def _is_private(ip: str) -> bool:
    """Don't block private/local IPs."""
    prefixes = ('10.', '192.168.', '172.', '127.', '0.', '::1')
    return any(ip.startswith(p) for p in prefixes)

def block_ip(ip: str, reason: str, severity: str, signature: str) -> dict:
    if _is_private(ip):
        return {"success": False, "message": f"{ip} is a private IP — not blocked"}

    # Check already blocked
    with sqlite3.connect(DB_PATH) as conn:
        row = conn.execute(
            "SELECT ip FROM blocked_ips WHERE ip=? AND unblocked=0", (ip,)
        ).fetchone()
        if row:
            return {"success": False, "message": f"{ip} already blocked"}

    # Add iptables rule
    ok, out = _run(["sudo", "iptables", "-A", "INPUT", "-s", ip, "-j", "DROP"])
    ok2, _  = _run(["sudo", "iptables", "-A", "OUTPUT", "-d", ip, "-j", "DROP"])

    # Save to DB regardless (some systems may need manual iptables)
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("""
            INSERT OR REPLACE INTO blocked_ips
            (ip, reason, severity, signature, blocked_at, unblocked)
            VALUES (?,?,?,?,?,0)
        """, (ip, reason, severity, signature, datetime.utcnow().isoformat()))
        conn.commit()

    print(f"[Firewall] Blocked {ip} — {signature} ({severity})")
    return {
        "success": True,
        "ip": ip,
        "message": f"Blocked {ip}",
        "iptables": ok,
        "output": out[:200],
    }

def unblock_ip(ip: str) -> dict:
    _run(["sudo", "iptables", "-D", "INPUT",  "-s", ip, "-j", "DROP"])
    _run(["sudo", "iptables", "-D", "OUTPUT", "-d", ip, "-j", "DROP"])

    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            "UPDATE blocked_ips SET unblocked=1 WHERE ip=?", (ip,)
        )
        conn.commit()

    print(f"[Firewall] Unblocked {ip}")
    return {"success": True, "ip": ip, "message": f"Unblocked {ip}"}

def get_blocked_ips() -> list[dict]:
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute("""
            SELECT ip, reason, severity, signature, blocked_at
            FROM blocked_ips WHERE unblocked=0
            ORDER BY blocked_at DESC
        """).fetchall()
    return [dict(r) for r in rows]

def is_blocked(ip: str) -> bool:
    with sqlite3.connect(DB_PATH) as conn:
        row = conn.execute(
            "SELECT ip FROM blocked_ips WHERE ip=? AND unblocked=0", (ip,)
        ).fetchone()
    return row is not None

def get_block_stats() -> dict:
    with sqlite3.connect(DB_PATH) as conn:
        total    = conn.execute("SELECT COUNT(*) FROM blocked_ips WHERE unblocked=0").fetchone()[0]
        critical = conn.execute("SELECT COUNT(*) FROM blocked_ips WHERE severity='critical' AND unblocked=0").fetchone()[0]
    return {"total_blocked": total, "critical_blocked": critical}