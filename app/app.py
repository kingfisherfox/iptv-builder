#!/usr/bin/env python3
"""
IPTV channel review web app.
SQLite DB for state; compiled JSON for channel data.
"""

from __future__ import annotations

import os
import re

import pycountry
from flask import Flask, Response, jsonify, request, send_from_directory

import app.iptv_fetch as iptv_fetch
from app.db import (
    get_config, get_excluded_ids, get_status_map, get_works_count,
    get_works_list, init_db, mark_channel, reset_all, set_config,
)

app = Flask(__name__, static_folder="static", static_url_path="")
DATA_DIR = os.environ.get("DATA_DIR", os.path.join(os.path.dirname(__file__), "..", "data"))

ALL_LANGUAGE_CODES = {lang.alpha_3.lower() for lang in pycountry.languages if hasattr(lang, "alpha_3")}

with app.app_context():
    init_db()


def _esc_m3u(s: str) -> str:
    return s.replace("\\", "\\\\").replace('"', '\\"')


def _slugify(name: str) -> str:
    return re.sub(r'[^a-z0-9]+', '_', name.strip().lower()).strip('_')


def _country_slug(config: dict, compiled: dict) -> str:
    code = (config.get("testing_country") or "").strip().upper()
    if not code:
        return "unknown"
    for c in (compiled.get("countries") or []):
        if (c.get("code") or "").upper() == code:
            return _slugify(c.get("name") or code)
    return _slugify(code)


def _language_slug(config: dict, compiled: dict) -> str:
    code = (config.get("desired_language") or "").strip().lower()
    if not code:
        return "all"
    for lang in (compiled.get("languages") or []):
        if (lang.get("code") or "").lower() == code:
            return _slugify(lang.get("name") or code)
    return _slugify(code)


def _build_m3u_content() -> str:
    works = get_works_list()
    if not works:
        return "#EXTM3U\n"
    temp_list = iptv_fetch.load_temp_list()
    compiled = iptv_fetch.load_compiled()
    if not temp_list or not compiled:
        return "#EXTM3U\n"
    ch_map = {c["id"]: c for c in temp_list}
    guides = compiled.get("guides") or []

    lines = ["#EXTM3U"]
    for w in works:
        ch = ch_map.get(w["id"])
        if not ch or not ch.get("streams"):
            continue
        stream_url = ch["streams"][0]
        name = (ch.get("name") or w["id"] or "").strip()
        logo = (ch.get("logo") or "").strip()
        group = (ch.get("group") or "").strip()
        attrs = [f'tvg-id="{_esc_m3u(w["id"])}"', f'tvg-name="{_esc_m3u(name)}"']
        if logo:
            attrs.append(f'tvg-logo="{_esc_m3u(logo)}"')
        if group:
            attrs.append(f'group-title="{_esc_m3u(group)}"')
        guide_url = None
        for g in guides:
            if (g.get("channel") or "") == w["id"]:
                guide_url = g.get("url") or g.get("feed")
                if guide_url and isinstance(guide_url, str):
                    break
        if guide_url:
            attrs.append(f'tvg-guide="{_esc_m3u(guide_url)}"')
        lines.append(f"#EXTINF:-1 {' '.join(attrs)},{name}")
        lines.append(stream_url)
    return "\n".join(lines) + "\n"


# --- Routes ---

@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


@app.route("/api/ready")
def api_ready():
    return jsonify({"ready": os.path.isfile(iptv_fetch.TEMP_LIST_PATH)})


@app.route("/api/fetch", methods=["POST"])
def api_fetch():
    try:
        compiled = iptv_fetch.compile_all()
        iptv_fetch.build_temp_channel_list(compiled)
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


@app.route("/api/countries")
def api_countries():
    compiled = iptv_fetch.load_compiled()
    if not compiled:
        return jsonify([])
    return jsonify([{"code": c.get("code"), "name": c.get("name")} for c in (compiled.get("countries") or []) if c.get("code")])


@app.route("/api/languages")
def api_languages():
    compiled = iptv_fetch.load_compiled()
    temp_list = iptv_fetch.load_temp_list()
    if not compiled:
        return jsonify([])
    codes_in_use = set()
    if temp_list:
        for ch in temp_list:
            for code in ch.get("languages") or []:
                if code:
                    codes_in_use.add(code.strip().lower())
    if not codes_in_use:
        codes_in_use = ALL_LANGUAGE_CODES
    out = [{"code": c.get("code"), "name": c.get("name")} for c in (compiled.get("languages") or []) if c.get("code") and c["code"].lower() in codes_in_use]
    out.sort(key=lambda x: (x.get("name") or "").lower())
    return jsonify(out)


@app.route("/api/config", methods=["GET", "POST"])
def api_config():
    if request.method == "POST":
        data = request.get_json() or {}
        if "testing_country" in data:
            set_config("testing_country", data["testing_country"] or "")
        if "desired_language" in data:
            set_config("desired_language", data["desired_language"] or "")
    cfg = get_config()
    return jsonify({"testing_country": cfg["testing_country"], "desired_language": cfg["desired_language"]})


@app.route("/api/channels")
def api_channels():
    temp_list = iptv_fetch.load_temp_list()
    if not temp_list:
        return jsonify([])
    language = request.args.get("language", "").strip().lower()
    excluded = get_excluded_ids()
    status_map = get_status_map()

    out = []
    for ch in temp_list:
        ch_id = ch.get("id", "")
        if ch_id in excluded:
            continue
        if language:
            langs = [x.lower() for x in (ch.get("languages") or []) if x]
            if langs and language not in langs:
                continue
        out.append({
            "id": ch_id,
            "name": ch.get("name"),
            "logo": ch.get("logo"),
            "group": ch.get("group"),
            "languages": ch.get("languages") or [],
            "streams": ch.get("streams") or [],
            "status": status_map.get(ch_id),
        })
    return jsonify(out)


@app.route("/api/channels/<channel_id>/works", methods=["POST"])
def api_mark_works(channel_id):
    cfg = get_config()
    mark_channel(channel_id, "works", language=cfg.get("desired_language") or "")
    return jsonify({"ok": True})


@app.route("/api/channels/<channel_id>/doesnt-work", methods=["POST"])
def api_mark_doesnt_work(channel_id):
    mark_channel(channel_id, "doesnt_work")
    return jsonify({"ok": True})


@app.route("/api/channels/<channel_id>/not-my-language", methods=["POST"])
def api_mark_not_my_language(channel_id):
    mark_channel(channel_id, "not_my_language")
    return jsonify({"ok": True})


@app.route("/api/channels/<channel_id>/ignore", methods=["POST"])
def api_mark_ignore(channel_id):
    mark_channel(channel_id, "ignored")
    return jsonify({"ok": True})


@app.route("/api/channels/<channel_id>/hide", methods=["POST"])
def api_hide_channel(channel_id):
    mark_channel(channel_id, "hidden")
    return jsonify({"ok": True})


@app.route("/api/reset", methods=["POST"])
def api_reset():
    reset_all()
    try:
        compiled = iptv_fetch.compile_all()
        iptv_fetch.build_temp_channel_list(compiled)
    except Exception:
        pass
    return jsonify({"ok": True})


@app.route("/api/works-count")
def api_works_count():
    return jsonify({"count": get_works_count()})


@app.route("/api/download-m3u")
def api_download_m3u():
    cfg = get_config()
    compiled = iptv_fetch.load_compiled()
    country = _country_slug(cfg, compiled) if compiled else "unknown"
    language = _language_slug(cfg, compiled) if compiled else "all"
    filename = f"works_in_{country}_in_{language}.m3u"
    content = _build_m3u_content()
    return Response(content, mimetype="application/octet-stream", headers={"Content-Disposition": f"attachment; filename={filename}"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
