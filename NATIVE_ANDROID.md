# SE7ENFIT Native Android Build

SE7ENFIT is now configured as a Capacitor Android app. The same React app is bundled inside a native Android WebView and can be built as an APK or AAB.

## Local build

Install dependencies:

```bash
npm install
```

Create Android project first time:

```bash
npm run native:init:android
```

Open in Android Studio:

```bash
npm run native:open:android
```

Build debug APK:

```bash
npm run native:apk:debug
```

Build release AAB:

```bash
npm run native:aab:release
```

## GitHub Actions build

Workflow file: `.github/workflows/android-build.yml`

Go to GitHub Actions and run **Build Android App**. It will upload a debug APK and an unsigned release AAB artifact.

## Native features configured

- Capacitor Android wrapper
- Native camera and gallery picker for Food Scan
- Status bar setup
- Splash screen setup
- Keyboard resize setup
- Android hardware back button handling
- Haptics helper
- Push notification registration hook
- Local notification plugin installed

## Play Store note

For Play Store upload, generate a signed release AAB from Android Studio or add a signing step in GitHub Actions. Push notifications require Firebase setup and `google-services.json` inside the generated Android app.
