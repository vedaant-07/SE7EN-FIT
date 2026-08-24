package com.se7enfit.app;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "SE7ENActivityTracker")
public class SE7ENActivityTrackerPlugin extends Plugin {
  private SharedPreferences prefs() {
    return getContext().getSharedPreferences(SE7ENActivityTrackingService.PREFS, Context.MODE_PRIVATE);
  }

  private boolean hasLocationPermission() {
    return ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
      ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
  }

  private boolean hasActivityPermission() {
    return Build.VERSION.SDK_INT < Build.VERSION_CODES.Q ||
      ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACTIVITY_RECOGNITION) == PackageManager.PERMISSION_GRANTED;
  }

  private boolean countsSteps(String activity) {
    return !"cycling".equals(activity);
  }

  private String sanitizeActivity(String value) {
    if ("running".equals(value) || "cycling".equals(value) || "hiking".equals(value)) return value;
    return "walking";
  }

  private Intent command(String action) {
    Intent intent = new Intent(getContext(), SE7ENActivityTrackingService.class);
    intent.setAction(action);
    return intent;
  }

  @PluginMethod
  public void start(PluginCall call) {
    String activity = sanitizeActivity(call.getString("activity", "walking"));
    String sessionId = call.getString("sessionId", "").trim();
    if (sessionId.isEmpty()) {
      call.reject("sessionId is required.");
      return;
    }
    if (!hasLocationPermission()) {
      call.reject("Location permission is required for activity tracking.");
      return;
    }
    if (countsSteps(activity) && !hasActivityPermission()) {
      call.reject("Activity recognition permission is required for step tracking.");
      return;
    }

    Intent intent = command(SE7ENActivityTrackingService.ACTION_START)
      .putExtra(SE7ENActivityTrackingService.EXTRA_SESSION_ID, sessionId)
      .putExtra(SE7ENActivityTrackingService.EXTRA_ACTIVITY, activity);
    ContextCompat.startForegroundService(getContext(), intent);
    resolveAfterCommand(call, 200L);
  }

  @PluginMethod
  public void pause(PluginCall call) {
    getContext().startService(command(SE7ENActivityTrackingService.ACTION_PAUSE));
    resolveAfterCommand(call, 150L);
  }

  @PluginMethod
  public void resume(PluginCall call) {
    if (!hasLocationPermission()) {
      call.reject("Location permission is required to resume tracking.");
      return;
    }
    ContextCompat.startForegroundService(getContext(), command(SE7ENActivityTrackingService.ACTION_RESUME));
    resolveAfterCommand(call, 150L);
  }

  @PluginMethod
  public void finish(PluginCall call) {
    getContext().startService(command(SE7ENActivityTrackingService.ACTION_FINISH));
    resolveAfterCommand(call, 250L);
  }

  @PluginMethod
  public void discard(PluginCall call) {
    getContext().startService(command(SE7ENActivityTrackingService.ACTION_DISCARD));
    new Handler(Looper.getMainLooper()).postDelayed(() -> call.resolve(snapshot()), 150L);
  }

  @PluginMethod
  public void getSnapshot(PluginCall call) {
    call.resolve(snapshot());
  }

  private void resolveAfterCommand(PluginCall call, long delayMs) {
    new Handler(Looper.getMainLooper()).postDelayed(() -> call.resolve(snapshot()), delayMs);
  }

  private JSObject snapshot() {
    SharedPreferences prefs = prefs();
    String status = prefs.getString("status", "idle");
    long accumulated = prefs.getLong("accumulated_ms", 0L);
    long activeStarted = prefs.getLong("active_started_elapsed", 0L);
    long elapsed = accumulated;
    if ("active".equals(status) && activeStarted > 0L) {
      elapsed += Math.max(0L, SystemClock.elapsedRealtime() - activeStarted);
    }

    JSObject result = new JSObject();
    result.put("sessionId", prefs.getString("session_id", ""));
    result.put("activity", prefs.getString("activity", "walking"));
    result.put("status", status);
    result.put("startedAtMs", prefs.getLong("started_at_ms", 0L));
    result.put("endedAtMs", prefs.getLong("ended_at_ms", 0L));
    result.put("elapsedMs", Math.max(0L, elapsed));
    result.put("distanceKm", Math.max(0f, prefs.getFloat("distance_km", 0f)));
    result.put("steps", Math.max(0, prefs.getInt("steps", 0)));
    result.put("lastAccuracyM", Math.max(0f, prefs.getFloat("last_accuracy_m", 0f)));
    result.put("acceptedPoints", Math.max(0, prefs.getInt("accepted_points", 0)));
    result.put("routeJson", prefs.getString("route_json", "[]"));
    result.put("locationPermission", hasLocationPermission());
    result.put("activityPermission", hasActivityPermission());
    result.put("backgroundCapable", true);
    return result;
  }
}
