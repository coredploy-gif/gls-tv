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
- **Live series channels:** Featured 24/7 row (The L Word, Star Trek, …) — intentionally live.

### How to add more real VOD series later

1. Prefer adding to `src/data/curated-vod-series.ts` (`CURATED_VOD_SERIES`) with **`isLive: false`** and a finite MP4 / VOD HLS URL.
2. Genre tags (`Drama`, `Comedy`, `Sci-Fi`, …) drive rows on `/series`.
3. Obtain a **playable VOD URL** (not a 24/7 live playlist).
4. Optional later: episode picker UI — catalog already has optional season/episode counts.
5. Keep Eadmin `stream_seeds` for **live** slots; do not mark live sliding-window HLS as VOD.

### What does *not* fix L Word scrubbing

- Building the Android TV APK — same web player / same `isLive` flag.
- Renaming the tile to “series” only — `type: "series"` + `isLive: true` is still live.

---

## Product copy guideline

- Label seeded drama packs as **24/7 / Live series channel**.
- Label open anthologies as **On demand**.
- Never promise episode-level Netflix UX for a linear FAST URL.
