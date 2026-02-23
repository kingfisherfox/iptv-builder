# IPTV Channel Review Web App

Web UI to manually review IPTV channels: play a stream, then mark it as **Add to list**, **Ignore**, **Doesn't work**, or **Not my language**. All state persisted in SQLite.

## Workflow

1. **Page loads** — channels auto-fetch from API if not cached, populate sidebar.
2. **Set Country + Language, click Apply** — country sets the output filename, language filters channels. Autoplay activates. Player and buttons are locked until Apply.
3. **Review channels** — work through the list top-to-bottom. Add to list / Ignore / Doesn't work / Not my language. Auto-advances to next unchecked channel.
4. **Download M3U** — enabled once at least 1 channel is in the works list. Filename: `works_in_{country}_in_{language}.m3u`.
5. **Refetch** — re-downloads API data. Existing statuses preserved.
6. **Reset** — drops all statuses, re-fetches everything fresh.

## Features

- **SQLite database** (`data/iptv.db`): config + channel_status tables.
- **Accordion sidebar**: collapsible country groups with channel counts, persistent state.
- **Subtitle support**: auto-enables subtitles matching configured language.
- **Toast notifications** on all actions.
- **pycountry** for full ISO 639-3 language code support.
- **gunicorn** production server (no Flask dev server warning).

## Stack

- **Backend**: Flask + gunicorn (`app/app.py`), SQLite (`app/db.py`), API fetch (`app/iptv_fetch.py`)
- **Frontend**: HTML (`app/static/index.html`), JS (`app/static/ui.js`, `app/static/app.js`), Tailwind CSS (CDN), hls.js
- **Docker**: One service; volume `./data:/app/data` persists JSON data and SQLite DB.

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/ready | `{ "ready": true }` if channel data cached |
| POST | /api/fetch | Fetch + compile from IPTV-ORG API |
| GET | /api/countries | Country list for autocomplete |
| GET | /api/languages | Language list for autocomplete |
| GET/POST | /api/config | Get or set testing_country, desired_language |
| GET | /api/channels?language= | Filtered channel list |
| POST | /api/channels/:id/works | Mark as works |
| POST | /api/channels/:id/ignore | Mark as ignored (tracked, not in M3U) |
| POST | /api/channels/:id/doesnt-work | Mark as doesn't work |
| POST | /api/channels/:id/not-my-language | Mark as not my language |
| POST | /api/channels/:id/hide | Hide channel |
| POST | /api/reset | Clear all statuses + re-fetch |
| GET | /api/works-count | `{ "count": N }` |
| GET | /api/download-m3u | Download M3U file |

## Files

| File | Purpose |
|------|---------|
| `app/app.py` | Flask routes, M3U generation |
| `app/db.py` | SQLite module (config, channel_status) |
| `app/iptv_fetch.py` | API data fetching and compilation |
| `app/static/index.html` | HTML structure |
| `app/static/ui.js` | DOM, rendering, player, navigation |
| `app/static/app.js` | Config, events, init |
