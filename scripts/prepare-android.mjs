import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import process from 'node:process';

const manifestPath = new URL('../android/app/src/main/AndroidManifest.xml', import.meta.url);
const javaDir = new URL('../android/app/src/main/java/com/se7enfit/app/', import.meta.url);
const nativeTemplateDir = new URL('../native/android/com/se7enfit/app/', import.meta.url);

const manifestEntries = [
  '<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />',
  '<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />',
  '<uses-permission android:name="android.permission.ACTIVITY_RECOGNITION" />',
  '<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />',
  '<uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />',
  '<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />',
  '<uses-feature android:name="android.hardware.location.gps" android:required="false" />',
  '<uses-feature android:name="android.hardware.sensor.stepcounter" android:required="false" />',
];

const activityService = '        <service android:name=".SE7ENActivityTrackingService" android:exported="false" android:foregroundServiceType="location" />';

const javaFiles = [
  'MainActivity.java',
  'SE7ENHealthPlugin.java',
  'SE7ENSecureStoragePlugin.java',
  'SE7ENActivityTrackerPlugin.java',
  'SE7ENActivityTrackingService.java',
];

try {
  let manifest = await readFile(manifestPath, 'utf8');
  const missing = manifestEntries.filter((entry) => !manifest.includes(entry));
  if (missing.length) {
    manifest = manifest.replace(/(<manifest\b[^>]*>)/, `$1\n    ${missing.join('\n    ')}`);
  }
  if (!manifest.includes('SE7ENActivityTrackingService')) {
    manifest = manifest.replace(/\s*<\/application>/, `\n${activityService}\n    </application>`);
  }
  await writeFile(manifestPath, manifest);

  await mkdir(javaDir, { recursive: true });
  for (const filename of javaFiles) {
    await copyFile(new URL(filename, nativeTemplateDir), new URL(filename, javaDir));
  }

  console.log(`Android native bridge ready (${missing.length} manifest entries added, ${javaFiles.length} Java files installed).`);
} catch (error) {
  console.error(`Could not prepare Android native project: ${error.message}`);
  process.exit(1);
}
