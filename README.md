# GLS TV

Cinematic streaming PWA — Live TV, Series, and Movies.

## Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) (or 3001 if busy).

### Refresh IPTV playlists

```bash
npm run iptv:sync
```

Pulls Sports + US from iptv-org, dedupes, writes `src/data/generated/*.json`.

### TMDB movies (categorised)

Copy `.env.local.example` → `.env.local` and set `TMDB_API_KEY`.

## Structure

- `/` — Landing
- `/profiles` — Who's watching
- `/browse` — Home rows
- `/live` → country → category → channels
- `/movies`, `/series`, `/search`, `/my-list`
- `/watch/[slug]` — Player (MP4 + HLS)

Catalog seed is public-domain / Creative Commons / open streams only (`src/data/catalog.ts`).

## Playback

Live HLS runs **~60 seconds behind the live edge** on purpose — still live, much smoother (fewer buffers).

Start with **Verified** tiles (green **OK** badge) or open:
http://localhost:3001/watch/dw-english

## Supabase

Project: `gls-tv` (`fzzfazrinsyfwhylberv`)

Tables: `channels`, `profiles`, `user_playlists`, `subscriptions`

Copy `.env.local.example` → `.env.local` (already set locally).
