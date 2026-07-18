# GLS TV — Android TV APK

Professional **leanback WebView shell** for Android TV / Google TV.  
Loads the live GLS site (`https://glstv.site`) with `?tv=1` forced — same QR login, D-pad focus, and catalog as the web app, with a real TV launcher icon.

## Requirements

- [Android Studio](https://developer.android.com/studio) (Ladybug / 2024.2+ recommended)
- JDK 17 (bundled with Android Studio)
- Android SDK 35 + an Android TV emulator **or** a physical stick with USB/network debugging

This machine may not have the SDK installed — open the `android-tv/` folder in Android Studio on a build PC.

## Open & build

1. **File → Open** → select `android-tv/` (not the Next.js repo root).
2. Let Gradle sync (first sync downloads the wrapper + deps).
3. Create an **Android TV** virtual device (API 30+) or plug in a stick (`adb devices`).
4. Run **app** (debug) or build release:

```bash
cd android-tv
# Debug APK
./gradlew assembleDebug

# Release APK (needs keystore.properties — see below)
./gradlew assembleRelease
```

Outputs:

- Debug: `app/build/outputs/apk/debug/app-debug.apk`
- Release: `app/build/outputs/apk/release/app-release.apk`

### Staging / local URL

```bash
./gradlew assembleDebug -PglsBaseUrl=https://your-preview.vercel.app
```

## Signing (release / sideload)

```bash
keytool -genkey -v -keystore gls-tv-release.jks -alias glstv \
  -keyalg RSA -keysize 2048 -validity 10000
```

Copy `keystore.properties.example` → `keystore.properties` and fill paths/passwords.  
**Never commit** `.jks` or `keystore.properties`.

## Sideload on a TV stick

```bash
adb connect <tv-ip>:5555
adb install -r app/build/outputs/apk/release/app-release.apk
```

Find **GLS TV** on the Android TV home / Apps row (leanback banner).

## What this APK includes

| Feature | Detail |
|---------|--------|
| Package | `site.glstv.tv` |
| Launcher | `LEANBACK_LAUNCHER` + phone `LAUNCHER` for testing |
| Banner | `tv_banner` 320×180 leanback asset |
| Start URL | `https://glstv.site/browse?tv=1` |
| UA suffix | `GLSTV-AndroidTV/1.0` (web detects TV mode) |
| Back | Web history, then exit; exits HTML5 fullscreen first |
| Media | Autoplay allowed; immersive landscape |
| Security | HTTPS only (`usesCleartextTraffic=false`) |

## What stays on the web

Catalog, player, membership, QR TV login, remote focus CSS — all in Next.js.  
Update the site → every installed APK picks it up (no store resubmit for content).

## Play Store / Google TV (later)

1. Build AAB: `./gradlew bundleRelease`
2. Play Console → TV screenshots + banner + TV checklist
3. Expect streaming / aggregator policy review

See also: `docs/ANDROID-TV-APK-PLAN.md`
