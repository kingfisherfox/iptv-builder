# IPTV Playlist Builder

A Docker-based web app for building custom M3U playlists from the [iptv-org](https://github.com/iptv-org/iptv) channel database. Browse thousands of publicly available IPTV channels, test which ones work in your region, and export a personalised playlist.

> **Note**: This tool does not include EPG (Electronic Program Guide) data. For programme guides, see the [iptv-org/epg](https://github.com/iptv-org/epg) repository.

## How it works

1. The app pulls channel and stream data from the [iptv-org API](https://iptv-org.github.io/api/).
2. You set your country and preferred language, then review channels one by one.
3. Working channels are saved to a `.m3u` playlist file you can download.
4. Host that file anywhere (GitHub works great) and point your IPTV player at the raw URL.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running

## Quick start (Docker Hub)

No code or IDE required. Just open a terminal and run:

```bash
docker run -d -p 5001:5000 -v iptv_data:/app/data --name iptv-builder kingfisherfox/iptv_m3u_builder:latest
```

Open **http://localhost:5001** in your browser.

To stop it:

```bash
docker stop iptv-builder
```

To start it again later (your progress is saved):

```bash
docker start iptv-builder
```

To update to the latest version:

```bash
docker stop iptv-builder
docker rm iptv-builder
docker pull kingfisherfox/iptv_m3u_builder:latest
docker run -d -p 5001:5000 -v iptv_data:/app/data --name iptv-builder kingfisherfox/iptv_m3u_builder:latest
```

## Quick start (from source)

```bash
git clone https://github.com/kingfisherfox/iptv_m3u_builder.git
cd iptv_m3u_builder
docker compose up --build
```

Open **http://localhost:5001** in your browser.

## Usage

### 1. First launch

The app automatically fetches the full channel list from the iptv-org API on first load. This takes about a minute.

### 2. Configure

Set your **Country** (used for the output filename) and **Language** (filters the channel list), then click **Apply**. The player and review buttons are locked until you do this.

### 3. Review channels

Work through the list top to bottom. For each channel you have four options:

| Button | What it does |
|--------|-------------|
| **Add to list** | Saves the channel to your playlist |
| **Ignore** | Marks it as reviewed but not wanted (stays visible, not in playlist) |
| **Doesn't work** | Marks as broken, hidden from the list |
| **Not my language** | Marks as wrong language, hidden from the list |

The app auto-advances to the next unchecked channel after each action. If you close the browser and come back, it picks up where you left off.

### 4. Download your playlist

Once you have at least one channel added, click **Download M3U**. The file is named `works_in_{country}_in_{language}.m3u`.

### 5. Host your playlist

The easiest way to make your playlist accessible to IPTV players:

1. Create a new GitHub repository (public).
2. Upload your `.m3u` file.
3. Click the file, then click **Raw**.
4. Copy the raw URL — it will look like:
   ```
   https://raw.githubusercontent.com/yourname/yourrepo/main/your_playlist.m3u
   ```
5. Paste that URL into your IPTV player of choice (VLC, TiviMate, IPTV Smarters, etc.).

### 6. Updating

Click **Refetch** to pull the latest channels from the API. Your existing review progress is preserved — only new channels appear. Click **Reset** to start fresh.

## Credits

Channel and stream data provided by [iptv-org](https://github.com/iptv-org/iptv) under the [Unlicense](https://github.com/iptv-org/iptv/blob/master/LICENSE).

## License

MIT
