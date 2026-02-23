# iptv_fetch

Module that fetches all 11 IPTV-ORG API JSON endpoints and compiles them into local files.

## Location

`app/iptv_fetch.py`

## What it does

1. Downloads all API endpoints (channels, streams, logos, guides, categories, languages, countries, subdivisions, cities, regions, timezones).
2. Saves compiled data to `data/compiled.json`.
3. Builds `data/temp_channel_list.json` — channels that have at least one stream, with name, logo, group, languages, and stream URLs.

## Functions

| Function | Description |
|----------|-------------|
| `compile_all()` | Fetches all API endpoints, writes `compiled.json`, returns dict |
| `build_temp_channel_list(compiled)` | Builds channel list from compiled data, writes `temp_channel_list.json` |
| `load_compiled()` | Loads `compiled.json` (returns None if missing/corrupt) |
| `load_temp_list()` | Loads `temp_channel_list.json` (returns None if missing/corrupt) |

## Called by

- `app/app.py` — `/api/fetch`, `/api/reset`, `/api/channels`, `/api/countries`, `/api/languages`
