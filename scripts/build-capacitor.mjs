import { spawnSync } from 'node:child_process';
import process from 'node:process';

const isWindows = process.platform === 'win32';
const command = isWindows ? 'npx.cmd' : 'npx';
const env = {
  ...process.env,
  VITE_CAPACITOR_NATIVE: 'true',
};

const result = spawnSync(command, ['vite', 'build'], {
  stdio: 'inherit',
  env,
  shell: false,
});

process.exit(result.status ?? 1);
