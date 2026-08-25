# SE7EN FIT Native Activity / Step Setup

SE7EN FIT uses a first-party Capacitor bridge named `SE7ENHealth` for Android step-counter access.

## Current Android implementation

The Android project is generated during native builds. `scripts/prepare-android.mjs` then:

- adds `ACTIVITY_RECOGNITION`, coarse/fine location permissions, and optional GPS/step-counter hardware declarations,
- generates `MainActivity.java`,
- registers the `SE7ENHealth` Capacitor plugin,
- generates `SE7ENHealthPlugin.java`.

The plugin reads Android's hardware `Sensor.TYPE_STEP_COUNTER` instead of treating arbitrary JavaScript motion events as authoritative daily steps.

## JavaScript bridge

`src/lib/healthSync.js` calls `registerPlugin('SE7ENHealth')` and supports:

```txt
requestPermissions
getDailySummary
getStepCounter
getWorkouts
```

`getDailySummary` currently returns Android step-counter information for the current day. `getWorkouts` is intentionally empty until workout-history integration is implemented.

## Important limitations

This is a real hardware step-counter bridge, but it is not yet a replacement for Android Health Connect history:

- `TYPE_STEP_COUNTER` is cumulative since device boot.
- SE7EN FIT stores a daily baseline when it first reads the counter that day.
- Steps that occurred before the first successful SE7EN FIT read of that date cannot be reconstructed from this bridge alone.
- Historical daily step totals require Health Connect (or another trusted historical provider) in a later integration.
- iOS HealthKit is not implemented in this repository yet.
- GPS activity recording is currently foreground-oriented; true screen-off route recording requires an Android foreground location service.

These limitations must be represented honestly in the product. Do not label missing historical data as measured data and do not silently combine manual values with sensor-measured steps.

## Build validation

The Android GitHub Actions workflow creates the Android project, runs the native preparation script, and compiles both an APK and an unsigned AAB on pull requests to `main`.

## Production rule

Measured activity sources must remain identifiable in persisted data. Manual entries, hardware step-counter data, GPS-tracked sessions, and any future Health Connect/HealthKit data must not be silently merged into an indistinguishable source.
