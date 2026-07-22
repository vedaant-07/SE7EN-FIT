import { readFile, writeFile } from 'node:fs/promises';
import process from 'node:process';

const manifestPath = new URL('../android/app/src/main/AndroidManifest.xml', import.meta.url);
const permissions = [
  '<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />',
  '<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />',
  '<uses-feature android:name="android.hardware.location.gps" android:required="false" />',
];

try {
  let manifest = await readFile(manifestPath, 'utf8');
  const missing = permissions.filter((entry) => !manifest.includes(entry));
  if (missing.length) {
    manifest = manifest.replace(/(<manifest\b[^>]*>)/, `$1\n    ${missing.join('\n    ')}`);
    await writeFile(manifestPath, manifest);
  }
  console.log(`Android location permissions ready (${missing.length} added).`);
} catch (error) {
  console.error(`Could not prepare AndroidManifest.xml: ${error.message}`);
  process.exit(1);
}
