"""SQLite database for IPTV channel review state (config, works, doesnt_work, not_my_language, hidden)."""

from __future__ import annotations

import os
import sqlite3
from typing import Dict, List, Optional, Set

DATA_DIR = os.environ.get("DATA_DIR", os.path.join(os.path.dirname(__file__), "..", "data"))
DB_PATH = os.path.join(DATA_DIR, "iptv.db")


def _conn() -> sqlite3.Connection:
    os.makedirs(DATA_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db() -> None:
    with _conn() as c:
        c.execute("CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT NOT NULL)")
        c.execute("""CREATE TABLE IF NOT EXISTS channel_status (
            channel_id TEXT PRIMARY KEY,
            status TEXT NOT NULL,
            language TEXT DEFAULT ''
        )""")


# --- Config ---

def get_config() -> Dict[str, str]:
    with _conn() as c:
        rows = c.execute("SELECT key, value FROM config").fetchall()
    out = {"testing_country": "", "desired_language": ""}
    for r in rows:
        out[r["key"]] = r["value"]
    return out


def set_config(key: str, value: str) -> None:
    with _conn() as c:
        c.execute("INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", (key, value))


# --- Channel status ---

def mark_channel(channel_id: str, status: str, language: str = "") -> None:
    """Set a channel's status: 'works', 'doesnt_work', 'not_my_language', 'hidden', 'ignored'."""
    with _conn() as c:
        c.execute(
            "INSERT INTO channel_status (channel_id, status, language) VALUES (?, ?, ?) ON CONFLICT(channel_id) DO UPDATE SET status=excluded.status, language=excluded.language",
            (channel_id, status, language),
        )


def get_excluded_ids() -> Set[str]:
    """IDs that should be hidden from the UI: doesnt_work, not_my_language, hidden."""
    with _conn() as c:
        rows = c.execute("SELECT channel_id FROM channel_status WHERE status IN ('doesnt_work', 'not_my_language', 'hidden')").fetchall()
    return {r["channel_id"] for r in rows}


def get_works_ids() -> Set[str]:
    with _conn() as c:
        rows = c.execute("SELECT channel_id FROM channel_status WHERE status='works'").fetchall()
    return {r["channel_id"] for r in rows}


def get_works_list() -> List[Dict[str, str]]:
    """Return list of {id, language} for all 'works' channels."""
    with _conn() as c:
        rows = c.execute("SELECT channel_id, language FROM channel_status WHERE status='works'").fetchall()
    return [{"id": r["channel_id"], "language": r["language"] or ""} for r in rows]


def get_channel_status(channel_id: str) -> Optional[str]:
    with _conn() as c:
        row = c.execute("SELECT status FROM channel_status WHERE channel_id=?", (channel_id,)).fetchone()
    return row["status"] if row else None


def get_status_map() -> Dict[str, str]:
    """Return {channel_id: status} for all channels with a status."""
    with _conn() as c:
        rows = c.execute("SELECT channel_id, status FROM channel_status").fetchall()
    return {r["channel_id"]: r["status"] for r in rows}


def get_works_count() -> int:
    with _conn() as c:
        row = c.execute("SELECT COUNT(*) as cnt FROM channel_status WHERE status='works'").fetchone()
    return row["cnt"] if row else 0


def get_all_known_ids() -> Set[str]:
    """Every channel_id that has ANY status (works, doesnt_work, not_my_language, hidden)."""
    with _conn() as c:
        rows = c.execute("SELECT channel_id FROM channel_status").fetchall()
    return {r["channel_id"] for r in rows}


def reset_all() -> None:
    """Clear all channel statuses. Keeps config."""
    with _conn() as c:
        c.execute("DELETE FROM channel_status")
