# Android TV APK plan (future)

GLS TV is a **Next.js web / PWA** streaming app. The Android TV APK should be a **thin leanback shell** that loads the production site — not a React Native or full native rewrite.

Related web work already in place: TV detect, D-pad `RemoteNavigation`, TV-only QR sign-in (`/auth` + `/auth/tv-pair`), `html[data-tv="1"]` cursor/focus chrome.

---

## Scaffold status

The **`android-tv/`** Kotlin Leanback WebView project is in-repo.

- Package: `site.glstv.tv`
- Open `android-tv/` in Android Studio → sync → Run on TV emulator / stick
- Full build / sideload steps: [`android-tv/README.md`](../android-tv/README.md)

---

## Goals

| Goal | Owner |
|------|--------|
| App icon on Android TV / Google TV home | APK shell |
| Netflix-like D-pad focus (highlight moves, scrub where VOD) | Web app (already started) |
| Hide OS mouse arrow more reliably | Web (`cursor: none`) + WebView settings |
| Phone pairing login on TV | Web QR flow (done) |
| Sideload for members / testers | Phase 1 APK |
| Play Store / Google TV listing | Phase 3 (later) |

**Verdict:** Focus navigation works in browser/PWA/WebView **without** an APK. The APK adds **installability** and better TV chrome; it does not replace web UX.

---

## Recommended approach

**Kotlin Leanback WebView** in repo folder `android-tv/` (suggested):

1. Single Activity with a full-screen `WebView`
2. Load production URL, e.g. `https://glstv.site` (append `?tv=1` if UA detection is flaky)
3. Manifest: `LEANBACK_LAUNCHER`, `android.software.leanback`, touchscreen not required
4. TV banner asset `320×180`
5. Signed release APK for sideload

**Avoid for v1:** Capacitor/Cordova (phone-oriented), React Native / Expo for TV (rebuild UI), Bubblewrap TWA alone on TV (Chrome/TWA support uneven — prefer WebView).

You **cannot** bundle the Next.js SSR app inside the APK. Runtime is always: **shell → HTTPS production site**.

---

## Phases

### Phase 0 — Validate on a real stick (≈1 week)

- Open production (or preview) on Android TV / Fire TV with a remote
- Confirm D-pad focus, QR login, HLS playback, Back key
- Use `/auth?tv=1` and `?tv=1` if detection fails
- Note remaining OS cursor (some browsers draw it regardless of CSS)

### Phase 1 — Sideloadable APK (≈1–2 days)

1. Android Studio → New Project → **TV / Empty Activity**
2. `AndroidManifest.xml`: leanback launcher + banner
3. `WebView` settings: JavaScript, DOM storage, media playback; optional immersive / cursor hide
4. Point at production URL
5. Create release keystore; `./gradlew assembleRelease`
6. Install via ADB / USB for testers

**Deps:** Android Studio, JDK 17, signing keystore, USB or network debugging.

### Phase 2 — Web TV hardening (can overlap Phase 0–1)

- Keep QR sign-in TV-only; polish focus traps and player Back/OK
- Hide non-TV chrome (chat, dense forms) when `isTvLikeDevice()`
- Prefer post-login landing on `/profiles`
- Treat series **live 24/7 FAST** vs **on-demand VOD** correctly (`isLive`) so pause/scrub appear only for VOD

### Phase 3 — Play Store / Google TV (when retention justifies)

- Ship AAB, TV screenshots + banner, Play Console TV checklist
- Expect policy review for streaming / aggregator catalogs
- Digital Asset Links only if you add a TWA path for phones later

---

## What the APK solves vs does not

| Solves | Does not solve alone |
|--------|----------------------|
| Leanback home-screen icon | Spatial focus quality (still web) |
| Sideload / later store packaging | Episode VOD library (needs content + `isLive: false`) |
| Better chance to hide system cursor | Play policy / content rights |
| Deep link into GLS as “an app” | Offline catalog (app is online-first) |

---

## Scaffold checklist (`android-tv/`)

Living todo list: **[ANDROID-TV-TODO.md](./ANDROID-TV-TODO.md)**

- [x] Package id `site.glstv.tv`
- [x] `LEANBACK_LAUNCHER` activity + banner
- [x] WebView → production origin; cleartext blocked (HTTPS only)
- [x] Hardware Back → `WebView.goBack()` or finish activity
- [x] Force `?tv=1` on load + UA suffix
- [ ] Release signing + `assembleRelease` (needs Android Studio on build PC)
- [ ] Sideload test on at least one Chromium Android TV stick
- [x] Document install steps (`android-tv/README.md`)

---

## Effort snapshot

| Work | Size |
|------|------|
| Leanback WebView APK (sideload) | S–M (1–2 days) |
| Web TV polish + QR (mostly done) | M |
| Play Store TV listing | M–L |
| Native / RN rewrite | XL — skip |

---

## Next concrete step

1. Open **`android-tv/`** in [Android Studio](https://developer.android.com/studio) and Run on a TV emulator/stick.  
2. See **[ANDROID-TV-TODO.md](./ANDROID-TV-TODO.md)** for the full checklist.  
Defer Play Store until sideload UX feels right.
