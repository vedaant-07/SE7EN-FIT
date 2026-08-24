import { mkdir, readFile, writeFile } from 'node:fs/promises';
import process from 'node:process';

const manifestPath = new URL('../android/app/src/main/AndroidManifest.xml', import.meta.url);
const javaDir = new URL('../android/app/src/main/java/com/se7enfit/app/', import.meta.url);
const mainActivityPath = new URL('../android/app/src/main/java/com/se7enfit/app/MainActivity.java', import.meta.url);
const healthPluginPath = new URL('../android/app/src/main/java/com/se7enfit/app/SE7ENHealthPlugin.java', import.meta.url);

const manifestEntries = [
  '<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />',
  '<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />',
  '<uses-permission android:name="android.permission.ACTIVITY_RECOGNITION" />',
  '<uses-feature android:name="android.hardware.location.gps" android:required="false" />',
  '<uses-feature android:name="android.hardware.sensor.stepcounter" android:required="false" />',
];

const mainActivity = `package com.se7enfit.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(SE7ENHealthPlugin.class);
    super.onCreate(savedInstanceState);
  }
}
`;

const healthPlugin = `package com.se7enfit.app;

import android.Manifest;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(
  name = "SE7ENHealth",
  permissions = {
    @Permission(strings = { Manifest.permission.ACTIVITY_RECOGNITION }, alias = "activity")
  }
)
public class SE7ENHealthPlugin extends Plugin {
  private static final String PREFS = "se7enfit_health";
  private static final String BASELINE_PREFIX = "step_baseline_";

  private boolean hasActivityPermission() {
    return Build.VERSION.SDK_INT < Build.VERSION_CODES.Q ||
      ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACTIVITY_RECOGNITION) == PackageManager.PERMISSION_GRANTED;
  }

  private String today() {
    return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
  }

  private JSObject permissionResult(boolean granted) {
    JSObject result = new JSObject();
    result.put("available", hasStepCounter());
    result.put("granted", granted);
    result.put("provider", "android_step_counter");
    return result;
  }

  private boolean hasStepCounter() {
    SensorManager manager = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
    return manager != null && manager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) != null;
  }

  @PluginMethod
  public void requestPermissions(PluginCall call) {
    if (!hasStepCounter()) {
      call.resolve(permissionResult(false));
      return;
    }
    if (hasActivityPermission()) {
      call.resolve(permissionResult(true));
      return;
    }
    requestPermissionForAlias("activity", call, "activityPermissionCallback");
  }

  @PermissionCallback
  public void activityPermissionCallback(PluginCall call) {
    call.resolve(permissionResult(hasActivityPermission()));
  }

  private interface CounterCallback {
    void resolve(float rawCounter);
  }

  private void readRawCounter(PluginCall call, CounterCallback callback) {
    if (!hasActivityPermission()) {
      call.reject("Activity recognition permission is required.");
      return;
    }

    SensorManager manager = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
    Sensor sensor = manager == null ? null : manager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
    if (manager == null || sensor == null) {
      call.reject("This Android device does not expose a hardware step counter.");
      return;
    }

    AtomicBoolean finished = new AtomicBoolean(false);
    Handler handler = new Handler(Looper.getMainLooper());

    SensorEventListener listener = new SensorEventListener() {
      @Override
      public void onSensorChanged(SensorEvent event) {
        if (event.values == null || event.values.length == 0 || !finished.compareAndSet(false, true)) return;
        manager.unregisterListener(this);
        callback.resolve(event.values[0]);
      }

      @Override
      public void onAccuracyChanged(Sensor sensor, int accuracy) {}
    };

    if (!manager.registerListener(listener, sensor, SensorManager.SENSOR_DELAY_NORMAL)) {
      call.reject("Could not start the Android step counter.");
      return;
    }

    handler.postDelayed(() -> {
      if (!finished.compareAndSet(false, true)) return;
      manager.unregisterListener(listener);
      call.reject("Timed out while reading the Android step counter.");
    }, 5000);
  }

  @PluginMethod
  public void getDailySummary(PluginCall call) {
    String requestedDate = call.getString("date", today());
    if (!requestedDate.equals(today())) {
      JSObject result = new JSObject();
      result.put("available", true);
      result.put("provider", "android_step_counter");
      result.put("date", requestedDate);
      result.put("steps", 0);
      result.put("distanceKm", 0);
      result.put("calories", 0);
      result.put("historicalUnavailable", true);
      call.resolve(result);
      return;
    }

    readRawCounter(call, rawCounter -> {
      SharedPreferences prefs = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
      String baselineKey = BASELINE_PREFIX + requestedDate;
      float baseline = prefs.getFloat(baselineKey, Float.NaN);
      if (Float.isNaN(baseline) || rawCounter < baseline) {
        baseline = rawCounter;
        prefs.edit().putFloat(baselineKey, baseline).apply();
      }

      int steps = Math.max(0, Math.round(rawCounter - baseline));
      prefs.edit()
        .putFloat("last_raw_counter", rawCounter)
        .putString("last_read_date", requestedDate)
        .apply();

      JSObject result = new JSObject();
      result.put("available", true);
      result.put("provider", "android_step_counter");
      result.put("date", requestedDate);
      result.put("steps", steps);
      result.put("rawStepCounter", rawCounter);
      result.put("distanceKm", 0);
      result.put("calories", 0);
      result.put("baselineInitialized", true);
      call.resolve(result);
    });
  }

  @PluginMethod
  public void getStepCounter(PluginCall call) {
    readRawCounter(call, rawCounter -> {
      JSObject result = new JSObject();
      result.put("available", true);
      result.put("provider", "android_step_counter");
      result.put("rawStepCounter", rawCounter);
      call.resolve(result);
    });
  }

  @PluginMethod
  public void getWorkouts(PluginCall call) {
    JSObject result = new JSObject();
    result.put("provider", "android_step_counter");
    result.put("workouts", new JSArray());
    call.resolve(result);
  }
}
`;

try {
  let manifest = await readFile(manifestPath, 'utf8');
  const missing = manifestEntries.filter((entry) => !manifest.includes(entry));
  if (missing.length) {
    manifest = manifest.replace(/(<manifest\b[^>]*>)/, `$1\n    ${missing.join('\n    ')}`);
    await writeFile(manifestPath, manifest);
  }

  await mkdir(javaDir, { recursive: true });
  await writeFile(mainActivityPath, mainActivity);
  await writeFile(healthPluginPath, healthPlugin);

  console.log(`Android native bridge ready (${missing.length} manifest entries added).`);
} catch (error) {
  console.error(`Could not prepare Android native project: ${error.message}`);
  process.exit(1);
}
