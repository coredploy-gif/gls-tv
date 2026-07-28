# Series: live 24/7 vs on-demand VOD

## Why The L Word feels like live TV

**The L Word** (and Star Trek / Walking Dead tiles under Featured series channels) are **24/7 FAST-style linear channels**, not episode libraries.

| | Live series channel | On-demand series (VOD) |
|--|---------------------|-------------------------|
| Catalog | `CURATED_SERIES_SEEDS` in `src/data/curated-public-fast.ts` | Public anthologies in `src/data/catalog.ts` |
| Flag | `isLive: true` | `isLive: false` |
| Source | Live HLS via Eadmin `stream_seeds` | Finite MP4 / VOD HLS |
| Player | Live edge, “Back to live”, limited scrub | Pause, seek bar, rewind/FF |
| UX | Like a TV channel looping the show | Like Netflix episode playback |

Player chrome only shows the scrub bar when `isLive` is false (`PlayerChrome.tsx`).

---

## Can we add “more like The L Word” but normal (pause / rewind)?

**Short answer:** Yes for **open / licensed VOD files**. Not by flipping The L Word’s live FAST feed to pretend it is Netflix VOD.

Commercial titles (The L Word, etc.) need **rights-cleared on-demand files** (or a licensed partner API). GLS must not host or deep-link pirated episode packs.

### What works today

- **On demand (pause/rewind):** `/series` opens with **On demand · featured** and genre rows (Drama, Comedy, Sci-Fi, Horror, Animation, Kids, Classic, Adventure) from `CURATED_VOD_SERIES` (`isLive: false`).
- **GLS TV Originals:** `src/data/curated-gls-originals.ts` — your adult animation + kids cartoons on the **GLS TV Originals** row.
- **Live series channels:** Featured 24/7 row (The L Word, Star Trek, …) — intentionally live.

### How to add your own Originals / VOD

1. Host each episode as **MP4 or VOD HLS** on a CDN (Cloudflare R2, Bunny, S3, etc.).
2. Edit `src/data/curated-gls-originals.ts` — set title, poster, and `url`. Use `audience: "adult"` or `"kids"`.
3. Keep **`isLive: false`** so pause/rewind works.
4. Deploy — titles appear on `/series` (and kids ones on `/kids`).
5. Quick teaser without a code deploy: `/admin/links` → Staff pick (category Series or Kids).
6. Other open VOD shelves: `src/data/curated-vod-series.ts`.
7. Keep Eadmin `stream_seeds` for **live** slots only.

### What does *not* fix L Word scrubbing

- Building the Android TV APK — same web player / same `isLive` flag.
- Renaming the tile to “series” only — `type: "series"` + `isLive: true` is still live.

---

## Product copy guideline

- Label seeded drama packs as **24/7 / Live series channel**.
- Label open anthologies as **On demand**.
- Never promise episode-level Netflix UX for a linear FAST URL.
