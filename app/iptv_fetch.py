#!/usr/bin/env python3
"""
Fetch all IPTV-ORG API JSONs and compile into a single file.
Build temp channel list (channels with at least one stream).
"""

from __future__ import annotations

import json
import os
from typing import Any, Dict, List

import requests

API_BASE = "https://iptv-org.github.io/api"
COMPILED_KEYS = (
    "channels", "streams", "logos", "guides", "categories", "languages",
    "countries", "subdivisions", "cities", "regions", "timezones",
)
DATA_DIR = os.environ.get("DATA_DIR", os.path.join(os.path.dirname(__file__), "..", "data"))
COMPILED_PATH = os.path.join(DATA_DIR, "compiled.json")
TEMP_LIST_PATH = os.path.join(DATA_DIR, "temp_channel_list.json")


def fetch_json(url: str) -> Any:
    """Fetch JSON from URL. Returns [] on failure."""
    try:
        r = requests.get(url, timeout=30)
        r.raise_for_status()
        return r.json()
    except requests.RequestException as e:
        print(f"Error fetching {url}: {e}")
        return []


def compile_all() -> Dict[str, Any]:
    """Fetch all API endpoints and save to data/compiled.json."""
    os.makedirs(DATA_DIR, exist_ok=True)
    compiled: Dict[str, Any] = {}
    for key in COMPILED_KEYS:
        url = f"{API_BASE}/{key}.json"
        print(f"Fetching {key}...")
        data = fetch_json(url)
        compiled[key] = data if isinstance(data, list) else [data]
    with open(COMPILED_PATH, "w", encoding="utf-8") as f:
        json.dump(compiled, f, ensure_ascii=False, indent=0)
    print(f"Saved compiled data to {COMPILED_PATH}")
    return compiled


def build_temp_channel_list(compiled: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Build list of channels that have at least one stream."""
    channels = compiled.get("channels", [])
    streams = compiled.get("streams", [])
    logos = compiled.get("logos", [])

    ch_by_id: Dict[str, dict] = {c["id"]: c for c in channels if c.get("id")}
    logo_by_ch: Dict[str, str] = {}
    for L in logos:
        cid, url = L.get("channel"), L.get("url")
        if cid and url and cid not in logo_by_ch:
            logo_by_ch[cid] = url

    streams_by_ch: Dict[str, List[str]] = {}
    for s in streams:
        ch_id, url = s.get("channel"), s.get("url")
        if ch_id and url:
            streams_by_ch.setdefault(ch_id, []).append(url)

    temp_list: List[Dict[str, Any]] = []
    for ch_id, urls in streams_by_ch.items():
        ch = ch_by_id.get(ch_id, {})
        name = (ch.get("name") or ch_id or "").strip()
        group = (ch.get("country") or ch.get("category") or "").strip()
        logo = (logo_by_ch.get(ch_id) or ch.get("logo") or "").strip()
        temp_list.append({
            "id": ch_id,
            "name": name,
            "logo": logo,
            "group": group,
            "languages": ch.get("languages") or [],
            "streams": urls,
        })

    os.makedirs(DATA_DIR, exist_ok=True)
    with open(TEMP_LIST_PATH, "w", encoding="utf-8") as f:
        json.dump(temp_list, f, ensure_ascii=False, indent=0)
    print(f"Saved temp channel list ({len(temp_list)} channels with streams) to {TEMP_LIST_PATH}")
    return temp_list


def load_compiled() -> Dict[str, Any] | None:
    """Load compiled.json if it exists. Returns None on missing or corrupt file."""
    if not os.path.isfile(COMPILED_PATH):
        return None
    try:
        with open(COMPILED_PATH, encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return None


def load_temp_list() -> List[Dict[str, Any]] | None:
    """Load temp_channel_list.json if it exists. Returns None on missing or corrupt file."""
    if not os.path.isfile(TEMP_LIST_PATH):
        return None
    try:
        with open(TEMP_LIST_PATH, encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return None
