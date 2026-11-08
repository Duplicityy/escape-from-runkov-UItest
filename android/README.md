# Android app

This project packages the finished game inside a landscape Android APK. It
requires Android 8.0 or newer and an up-to-date Android System WebView with
WebGL 2 support. Accounts and multiplayer use the game's existing HTTPS/WSS
services; the maps, models, icons and other game files are bundled locally.

## Build

Build a signed APK from the repository root:

```
npm ci
npm run apk
```

This needs Node.js 20+, Python 3, JDK 17+, Android SDK 35 and Build Tools 35.0.0.
Set `ANDROID_HOME` to the SDK directory. The Gradle wrapper obtains Gradle 8.11.1.
The build downloads and validates the pinned runtime assets, builds the game,
assembles Android, aligns the package and signs it. The finished APK and SHA-256
checksum are in `artifacts/android/`.

The first build creates an update signing key in the ignored `android/.signing/`
directory. Back up that directory privately; later updates must use the same
key. `RUNKOV_ANDROID_KEYSTORE` and `RUNKOV_ANDROID_PASSWORD_FILE` can select an
existing compatible key and password file; the key alias is `runkov`. Secrets
are never committed or passed as command-line password values.

For an unsigned development build after `npm run fetch-assets` and `npm run build`:

```
cd android
./gradlew assembleRelease
```

The unsigned result is `app/build/outputs/apk/release/app-release-unsigned.apk`.
`python3 scripts/build-apk.py --sign-only` aligns and signs an existing release.

The complete runtime set is 2,686 files, 2.60 GiB uncompressed; the APK is about
541 MiB after ZIP compression. `scripts/runtime-assets.json` pins paths, sizes
and hashes. `npm run fetch-assets -- --verify-only` checks the local set without
network access. Optional music recordings absent from the original deployment
are not fabricated or required.

The build reads `../dist` directly as its asset source. Do not disable GLB ZIP
compression: all maps and equipment models make the uncompressed asset set
larger than a standalone APK should be. No web files are downloaded on launch.

## Native controllers

Android's input system handles USB-C/OTG wired controllers and Bluetooth
controllers through the same HID APIs. `GamepadBridge` recognizes controller
input sources rather than a vendor name, supports both common right-stick and
trigger axis conventions, and maps the input to standard gamepad state. It
does not synthesize keyboard events or require direct USB-device permissions.

The bridge publishes `window.__runkovAndroidGamepads`; the game polls this
alongside browser gamepads. Device removal and app pause clear held input.
Physical Android Back calls `window.__runkovNativeBack()` before exiting;
backgrounding calls `window.__runkovNativePause()` to pause the game.

## Local origin and safety

The game loads from
`https://appassets.androidplatform.net/assets/www/index.html`, mapped to APK
assets by the app's request interceptor. This keeps relative asset paths and
secure-context browser APIs working without file-origin privileges. Missing
assets return 404, range requests are supported for audio, cleartext traffic is
disabled, and external links open in the user's browser. The app does not
expose a general-purpose JavaScript-to-Java interface.
