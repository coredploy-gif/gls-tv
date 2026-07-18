# Android TV APK — todo list

Living checklist for the GLS TV Android TV shell (`android-tv/`) and related web TV work.  
Full plan: [ANDROID-TV-APK-PLAN.md](./ANDROID-TV-APK-PLAN.md) · Build steps: [`android-tv/README.md`](../android-tv/README.md)

---

## Done

- [x] Scaffold `android-tv/` Kotlin Leanback WebView project (`site.glstv.tv`)
- [x] LEANBACK_LAUNCHER + phone LAUNCHER, banner, icons, HTTPS-only
- [x] Start URL `https://glstv.site/browse?tv=1` + UA `GLSTV-AndroidTV`
- [x] Web: TV QR sign-in (`/auth` + `/auth/tv-pair`)
- [x] Web: D-pad / pointer→focus + Netflix-style white focus bubbles
- [x] Web: Route 24/7 movie & series FASTs out of Live TV → Movies / Series
- [x] Web: On-demand VOD series shelves
- [x] Docs: APK plan + series live vs VOD
- [x] Fix post-sign-in hang on `/auth` (email + Message GLS) → hard nav to Who’s watching
- [x] Web: Google OAuth on `/auth` and phone `/auth/tv-pair` (TV stays QR-primary); Google behind admin `oauth_google` flag (default off); Apple deferred — see [AUTH-OAUTH-SETUP.md](./AUTH-OAUTH-SETUP.md)

---

## Next — APK software

- [ ] Install Android Studio + SDK on a build PC  
  https://developer.android.com/studio
- [ ] Open `android-tv/` in Android Studio → Gradle sync
- [ ] Run on Android TV emulator **or** physical stick (`adb`)
- [ ] Create release keystore → `keystore.properties` (from example)
- [ ] `assembleRelease` → sideload APK to testers
- [ ] Replace vector `tv_banner` with real **320×180 PNG** brand banner
- [ ] Optional: splash / offline error screen inside WebView
- [ ] Optional: deep links (`glstv.site/watch/...` opens app)

---

## Later — Store

- [ ] `bundleRelease` AAB
- [ ] Play Console TV assets + checklist
- [ ] Policy review for streaming / aggregator listing

---

## Web TV polish (ongoing)

- [ ] Re-test first sign-in → Who’s watching on production (phone + TV)
- [ ] After enabling Google in Supabase **and** Admin → Access (`oauth_google`), re-test OAuth on phone pair + desktop `/auth`
- [ ] Validate focus bubbles on a real stick with `?tv=1` / APK
- [ ] Keep QR login TV-only; email (+ optional Google) fallback for phone and edge cases
- [ ] Apple Sign-In deferred until Apple Developer is ready (`oauth_apple` reserved; UI hidden)
