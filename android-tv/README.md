# GLS TV — Android phone and TV apps

One Android project produces two purpose-built apps backed by the live GLS TV site.

| Variant | Package | Experience |
|---|---|---|
| TV | `site.glstv.tv` | Landscape, immersive, D-pad/remote-first, opens QR sign-in |
| Mobile | `site.glstv.mobile` | Touch-first phone app, receives QR pairing links |

The TV does not need a camera. It displays a QR code; the viewer scans it with a signed-in phone, approves the TV, and the TV completes sign-in.

## Requirements

- Android Studio with JDK 17
- Android SDK 35
- Android TV emulator or physical TV/stick for remote testing
- Phone/emulator for the mobile pairing flow

Open the `android-tv/` folder in Android Studio and let Gradle sync. This checkout does not include the generated Gradle wrapper binary; Android Studio can use its configured Gradle installation or generate a wrapper.

## Build variants

Select a variant in **Build > Select Build Variant**:

- `tvDebug` / `tvRelease`
- `mobileDebug` / `mobileRelease`

With a generated Gradle wrapper, command-line builds are:

```powershell
gradlew.bat assembleTvDebug
gradlew.bat assembleMobileDebug
gradlew.bat bundleTvRelease
gradlew.bat bundleMobileRelease
```

Typical APK outputs:

- `app/build/outputs/apk/tv/debug/app-tv-debug.apk`
- `app/build/outputs/apk/mobile/debug/app-mobile-debug.apk`
- `app/build/outputs/apk/tv/release/app-tv-release.apk`
- `app/build/outputs/apk/mobile/release/app-mobile-release.apk`

Override the production site for a preview build with `-PglsBaseUrl=https://your-preview.vercel.app`.

## Test QR sign-in

1. Install and open the TV variant. It starts at `/auth?tv=1&next=/profiles`.
2. Choose **Scan QR to sign in** if the QR is not already visible.
3. Scan the code with the phone camera. The verified `https://glstv.site/...` link opens the mobile app when installed, or the browser otherwise.
4. Sign in on the phone and approve the TV.
5. Confirm the TV continues to profile selection and that Back closes overlays/player before leaving the app.

The web app owns the short-lived device code, approval, polling, and session exchange. The Android apps never place passwords in the QR code.

## Offline recovery

If the initial page cannot load or production returns a server error, the app displays a native GLS TV recovery screen instead of the browser error page. **Try again** reloads the last safe GLS URL and is focusable from a TV remote. Account and saved-list data remain server-side.

## Remote and media controls

The TV shell normalizes common Android TV, soundbar, and Bluetooth controls. Play/Pause and Stop control playback; Rewind/Fast-forward seek on-demand video; Channel Up/Down and Previous/Next switch live channels when adjacent channels are available. Android Media Session metadata, playback state, and on-demand progress are also exposed to system and lock-screen controls.

## Verified app links

Android requires `https://glstv.site/.well-known/assetlinks.json` before pairing links can open directly in the mobile app without a chooser. Use `assetlinks.json.example` as the template and replace each SHA-256 placeholder with the certificate fingerprint used to sign that package. Do not deploy the placeholders.

## Release signing

Copy `keystore.properties.example` to `keystore.properties` and enter the release keystore values. Never commit the keystore, its passwords, or `keystore.properties`. Keep the same key for updates or Android will treat the build as a different app.

## TV quality checklist

- Navigate every visible control using only D-pad, Select, Back, Play/Pause, and Menu.
- Verify focus never disappears off-screen and the focused tile is obvious at sofa distance.
- Confirm QR sign-in on a fresh install and session restoration after restart.
- Test 720p, 1080p, and 4K TV layouts plus a small phone.
- Confirm HTML5 fullscreen exits before Back navigates away.
- Test expired/invalid device codes and offline recovery.

The current workstation does not have Java, Android SDK, Gradle, or ADB installed, so final APK compilation and device testing must be done in Android Studio or CI.
