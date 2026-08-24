package com.se7enfit.app;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import android.os.SystemClock;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Locale;

public class SE7ENActivityTrackingService extends Service implements LocationListener, SensorEventListener {
  public static final String PREFS = "se7enfit_native_activity";
  public static final String ACTION_START = "com.se7enfit.app.TRACK_START";
  public static final String ACTION_PAUSE = "com.se7enfit.app.TRACK_PAUSE";
  public static final String ACTION_RESUME = "com.se7enfit.app.TRACK_RESUME";
  public static final String ACTION_FINISH = "com.se7enfit.app.TRACK_FINISH";
  public static final String ACTION_DISCARD = "com.se7enfit.app.TRACK_DISCARD";
  public static final String EXTRA_ACTIVITY = "activity";
  public static final String EXTRA_SESSION_ID = "session_id";

  private static final String CHANNEL_ID = "se7enfit_activity_tracking";
  private static final int NOTIFICATION_ID = 7007;
  private static final int MAX_ROUTE_POINTS = 2500;

  private SharedPreferences prefs;
  private LocationManager locationManager;
  private SensorManager sensorManager;
  private Sensor stepCounter;
  private Location lastAcceptedLocation;
  private float segmentStepBaseline = -1f;
  private int accumulatedSteps = 0;
  private String activity = "walking";
  private boolean countsSteps = true;

  @Override
  public void onCreate() {
    super.onCreate();
    prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    locationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
    sensorManager = (SensorManager) getSystemService(Context.SENSOR_SERVICE);
    stepCounter = sensorManager == null ? null : sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
    createNotificationChannel();
  }

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    String action = intent == null ? null : intent.getAction();
    if (ACTION_START.equals(action)) {
      startNewSession(intent);
    } else if (ACTION_PAUSE.equals(action)) {
      pauseSession();
    } else if (ACTION_RESUME.equals(action)) {
      resumeSession();
    } else if (ACTION_FINISH.equals(action)) {
      finishSession();
    } else if (ACTION_DISCARD.equals(action)) {
      discardSession();
    } else if ("active".equals(prefs.getString("status", "idle"))) {
      // Android can recreate a foreground service after process pressure.
      restoreActiveSession();
    }
    return START_STICKY;
  }

  private void startNewSession(Intent intent) {
    activity = sanitizeActivity(intent.getStringExtra(EXTRA_ACTIVITY));
    countsSteps = countsSteps(activity);
    String sessionId = intent.getStringExtra(EXTRA_SESSION_ID);
    long nowWall = System.currentTimeMillis();
    long nowElapsed = SystemClock.elapsedRealtime();

    prefs.edit()
      .clear()
      .putString("session_id", sessionId == null ? "" : sessionId)
      .putString("activity", activity)
      .putString("status", "active")
      .putLong("started_at_ms", nowWall)
      .putLong("active_started_elapsed", nowElapsed)
      .putLong("accumulated_ms", 0L)
      .putLong("ended_at_ms", 0L)
      .putFloat("distance_km", 0f)
      .putInt("steps", 0)
      .putInt("accumulated_steps", 0)
      .putString("route_json", "[]")
      .putFloat("last_accuracy_m", 0f)
      .putInt("accepted_points", 0)
      .apply();

    accumulatedSteps = 0;
    segmentStepBaseline = -1f;
    lastAcceptedLocation = null;
    startForeground(NOTIFICATION_ID, buildNotification());
    startSensors();
  }

  private void restoreActiveSession() {
    activity = sanitizeActivity(prefs.getString("activity", "walking"));
    countsSteps = countsSteps(activity);
    accumulatedSteps = prefs.getInt("accumulated_steps", prefs.getInt("steps", 0));
    segmentStepBaseline = -1f;
    lastAcceptedLocation = null;
    startForeground(NOTIFICATION_ID, buildNotification());
    startSensors();
  }

  private void pauseSession() {
    if (!"active".equals(prefs.getString("status", "idle"))) return;
    long accumulated = currentElapsedMs();
    accumulatedSteps = prefs.getInt("steps", accumulatedSteps);
    prefs.edit()
      .putString("status", "paused")
      .putLong("accumulated_ms", accumulated)
      .putLong("active_started_elapsed", 0L)
      .putInt("accumulated_steps", accumulatedSteps)
      .apply();
    stopSensors();
    updateNotification();
  }

  private void resumeSession() {
    if (!"paused".equals(prefs.getString("status", "idle"))) return;
    activity = sanitizeActivity(prefs.getString("activity", "walking"));
    countsSteps = countsSteps(activity);
    accumulatedSteps = prefs.getInt("accumulated_steps", prefs.getInt("steps", 0));
    segmentStepBaseline = -1f;
    lastAcceptedLocation = null;
    prefs.edit()
      .putString("status", "active")
      .putLong("active_started_elapsed", SystemClock.elapsedRealtime())
      .apply();
    startForeground(NOTIFICATION_ID, buildNotification());
    startSensors();
  }

  private void finishSession() {
    String status = prefs.getString("status", "idle");
    if (!"active".equals(status) && !"paused".equals(status)) return;
    long elapsed = currentElapsedMs();
    accumulatedSteps = prefs.getInt("steps", accumulatedSteps);
    prefs.edit()
      .putString("status", "review")
      .putLong("accumulated_ms", elapsed)
      .putLong("active_started_elapsed", 0L)
      .putLong("ended_at_ms", System.currentTimeMillis())
      .putInt("accumulated_steps", accumulatedSteps)
      .apply();
    stopSensors();
    stopForeground(STOP_FOREGROUND_REMOVE);
    stopSelf();
  }

  private void discardSession() {
    stopSensors();
    prefs.edit().clear().apply();
    stopForeground(STOP_FOREGROUND_REMOVE);
    stopSelf();
  }

  private long currentElapsedMs() {
    long accumulated = prefs.getLong("accumulated_ms", 0L);
    if (!"active".equals(prefs.getString("status", "idle"))) return Math.max(0L, accumulated);
    long activeStarted = prefs.getLong("active_started_elapsed", 0L);
    if (activeStarted <= 0L) return Math.max(0L, accumulated);
    return Math.max(0L, accumulated + (SystemClock.elapsedRealtime() - activeStarted));
  }

  private void startSensors() {
    startLocationUpdates();
    if (countsSteps && stepCounter != null && hasActivityPermission()) {
      sensorManager.registerListener(this, stepCounter, SensorManager.SENSOR_DELAY_NORMAL);
    }
  }

  private void stopSensors() {
    try { if (locationManager != null) locationManager.removeUpdates(this); } catch (SecurityException ignored) {}
    if (sensorManager != null) sensorManager.unregisterListener(this);
    segmentStepBaseline = -1f;
    lastAcceptedLocation = null;
  }

  private boolean hasLocationPermission() {
    return ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
      ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
  }

  private boolean hasActivityPermission() {
    return Build.VERSION.SDK_INT < Build.VERSION_CODES.Q ||
      ContextCompat.checkSelfPermission(this, Manifest.permission.ACTIVITY_RECOGNITION) == PackageManager.PERMISSION_GRANTED;
  }

  private void startLocationUpdates() {
    if (locationManager == null || !hasLocationPermission()) return;
    try {
      if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
        locationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 1500L, 1f, this);
      }
      if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
        locationManager.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 3000L, 3f, this);
      }
    } catch (SecurityException ignored) {}
  }

  @Override
  public void onLocationChanged(Location location) {
    if (!"active".equals(prefs.getString("status", "idle"))) return;
    if (location == null || !location.hasAccuracy() || location.getAccuracy() <= 0f || location.getAccuracy() > 50f) return;

    long capturedAt = location.getTime() > 0 ? location.getTime() : System.currentTimeMillis();
    Location previous = lastAcceptedLocation;
    boolean segmentStart = previous == null && routeLength() > 0;

    if (previous != null) {
      long deltaMs = capturedAt - previous.getTime();
      if (deltaMs < 800L || deltaMs > 90000L) return;
      float segmentMeters = previous.distanceTo(location);
      double seconds = deltaMs / 1000.0;
      double impliedSpeed = segmentMeters / Math.max(0.8, seconds);
      float uncertainty = Math.max(previous.getAccuracy(), location.getAccuracy());
      double minimumMovement = Math.max(1.2, Math.min(4.0, uncertainty * 0.08));
      if (segmentMeters < minimumMovement) return;
      if (impliedSpeed > maxSpeedMps(activity) + 1.5) return;
      if (location.hasSpeed() && location.getSpeed() < 0.45f && segmentMeters < Math.max(4.0, uncertainty * 0.28)) return;

      float nextKm = prefs.getFloat("distance_km", 0f) + (segmentMeters / 1000f);
      prefs.edit().putFloat("distance_km", Math.max(0f, nextKm)).apply();
    }

    lastAcceptedLocation = new Location(location);
    appendRoutePoint(location, capturedAt, segmentStart);
    prefs.edit()
      .putFloat("last_accuracy_m", location.getAccuracy())
      .putInt("accepted_points", routeLength())
      .apply();
    updateNotification();
  }

  private void appendRoutePoint(Location location, long capturedAt, boolean segmentStart) {
    try {
      JSONArray route = new JSONArray(prefs.getString("route_json", "[]"));
      while (route.length() >= MAX_ROUTE_POINTS) route.remove(0);
      JSONObject point = new JSONObject();
      point.put("latitude", location.getLatitude());
      point.put("longitude", location.getLongitude());
      point.put("accuracy", location.getAccuracy());
      point.put("captured_ms", capturedAt);
      point.put("segment_start", segmentStart);
      if (location.hasSpeed()) point.put("speed", Math.max(0f, location.getSpeed()));
      route.put(point);
      prefs.edit().putString("route_json", route.toString()).apply();
    } catch (Exception ignored) {}
  }

  private int routeLength() {
    try { return new JSONArray(prefs.getString("route_json", "[]")).length(); }
    catch (Exception ignored) { return 0; }
  }

  @Override
  public void onSensorChanged(SensorEvent event) {
    if (!countsSteps || !"active".equals(prefs.getString("status", "idle"))) return;
    if (event.sensor.getType() != Sensor.TYPE_STEP_COUNTER || event.values.length == 0) return;
    float raw = event.values[0];
    if (segmentStepBaseline < 0f || raw < segmentStepBaseline) segmentStepBaseline = raw;
    int segmentSteps = Math.max(0, Math.round(raw - segmentStepBaseline));
    int totalSteps = Math.max(0, accumulatedSteps + segmentSteps);
    prefs.edit().putInt("steps", totalSteps).apply();
    updateNotification();
  }

  @Override public void onAccuracyChanged(Sensor sensor, int accuracy) {}
  @Override public void onStatusChanged(String provider, int status, Bundle extras) {}
  @Override public void onProviderEnabled(String provider) {}
  @Override public void onProviderDisabled(String provider) {}

  private String sanitizeActivity(String value) {
    if (value == null) return "walking";
    switch (value) {
      case "running":
      case "cycling":
      case "hiking":
      case "walking": return value;
      default: return "walking";
    }
  }

  private boolean countsSteps(String value) {
    return !"cycling".equals(value);
  }

  private double maxSpeedMps(String value) {
    if ("running".equals(value)) return 10.0;
    if ("cycling".equals(value)) return 28.0;
    if ("hiking".equals(value)) return 5.0;
    return 4.5;
  }

  private void createNotificationChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
    NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
    if (manager == null) return;
    NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Activity tracking", NotificationManager.IMPORTANCE_LOW);
    channel.setDescription("Keeps SE7EN FIT route tracking active while your screen is off.");
    manager.createNotificationChannel(channel);
  }

  private Notification buildNotification() {
    float distance = prefs == null ? 0f : prefs.getFloat("distance_km", 0f);
    long seconds = prefs == null ? 0L : currentElapsedMs() / 1000L;
    String content = String.format(Locale.US, "%.2f km • %02d:%02d", distance, seconds / 60L, seconds % 60L);
    return new NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.ic_menu_mylocation)
      .setContentTitle("SE7EN FIT • " + activityLabel(activity))
      .setContentText(content)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setCategory(NotificationCompat.CATEGORY_SERVICE)
      .build();
  }

  private String activityLabel(String value) {
    if ("running".equals(value)) return "Running";
    if ("cycling".equals(value)) return "Cycling";
    if ("hiking".equals(value)) return "Hiking";
    return "Walking";
  }

  private void updateNotification() {
    NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
    if (manager != null && !"review".equals(prefs.getString("status", "idle"))) {
      manager.notify(NOTIFICATION_ID, buildNotification());
    }
  }

  @Nullable
  @Override
  public IBinder onBind(Intent intent) {
    return null;
  }

  @Override
  public void onDestroy() {
    stopSensors();
    super.onDestroy();
  }
}
