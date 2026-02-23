# IPTV Playlist Builder

Build custom M3U playlists from 8,000+ publicly available IPTV channels. Browse, test, and export — no coding required.

Channel data sourced from [iptv-org](https://github.com/iptv-org/iptv).

## Quick start

### Docker Desktop

1. Search for `kingfisherfox/iptv_m3u_builder` and click **Pull**
2. Click **Run** — a dialog will appear
3. Type `8080` in the **Host port** field (next to `:8080/tcp`)
4. Click **Run**
5. Open [http://localhost:8080](http://localhost:8080)

### Command line

```bash
docker run -d -p 8080:8080 -v iptv_data:/app/data --name iptv-builder kingfisherfox/iptv_m3u_builder:latest
```

Open [http://localhost:8080](http://localhost:8080)

## How to use

1. **Wait for channels to load** — the first launch fetches data from the iptv-org API (~1 minute).
2. **Set your country and language**, click **Apply**.
3. **Review channels** — the player loads each stream. Click one of:
   - **Add to list** — saves to your playlist
   - **Ignore** — skip it, won't ask again
   - **Doesn't work** — marks as broken, hidden
   - **Not my language** — hidden
4. **Download M3U** — exports your working channels as a `.m3u` file.
5. **Host it** — upload the file to a public GitHub repo, grab the raw URL, paste it into any IPTV player (VLC, TiviMate, IPTV Smarters, etc.).

## Features

- Auto-advances through channels — minimal clicking
- Filters by language, grouped by country
- Accordion sidebar with channel counts
- Subtitle auto-detection for your language
- Progress saved in SQLite — survives restarts
- Refetch updates channels without losing your progress
- Reset to start fresh

## Volumes

| Path | Purpose |
|------|---------|
| `/app/data` | SQLite database + cached API data. Mount to persist progress. |

## Ports

| Port | Purpose |
|------|---------|
| `8080` | Web UI |

## Source

[GitHub](https://github.com/kingfisherfox/iptv_m3u_builder)
