# SE7EN FIT Native Health Setup

The app has a production health sync bridge in `src/lib/healthSync.js`.

## Synced data

- Steps
- Distance
- Active calories
- Running/walking/cycling/treadmill cardio sessions
- Average heart rate when returned by the native provider

## Platform mapping

- iOS uses Apple HealthKit.
- Android uses Health Connect.

The app safely skips sync in browser mode. Manual tracking still works.

## Required native bridge names

The JavaScript layer checks for one of these Capacitor plugin names:

```txt
SE7ENHealth
HealthKit
HealthConnect
Health
```

## Required native methods

```txt
requestPermissions
getDailySummary
getWorkouts
```

`getDailySummary` should return steps, distanceKm, and calories.
`getWorkouts` should return workouts with id, activity, durationMinutes, distanceKm, calories, averageHeartRate, startDate, and endDate.

## Database migration

Run this after the earlier production migrations:

```txt
006_native_health_tracking_fields.sql
```

## Important

The web/backend code is ready. Actual HealthKit or Health Connect access needs the native iOS/Android project to include the native Capacitor health implementation because browser JavaScript cannot read OS health data directly.
