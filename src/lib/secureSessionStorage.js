import { Capacitor, registerPlugin } from '@capacitor/core';

const SecureStorage = registerPlugin('SE7ENSecureStorage');
const memory = new Map();
const isNativeAndroid = () => Capacitor.isNativePlatform?.() && Capacitor.getPlatform?.() === 'android';

export const SESSION_KEYS = {
  accessToken: 'se7enfit_auth_token',
  refreshToken: 'se7enfit_refresh_token',
  expiresAt: 'se7enfit_auth_expires_at',
};

function webValue(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function getSessionValue(key) {
  if (memory.has(key)) return memory.get(key);
  if (!isNativeAndroid()) {
    const value = webValue(key);
    if (value !== null) memory.set(key, value);
    return value;
  }
  return null;
}

export async function hydrateSessionValues(keys = Object.values(SESSION_KEYS)) {
  if (!isNativeAndroid()) {
    for (const key of keys) {
      const value = webValue(key);
      if (value !== null) memory.set(key, value);
    }
    return;
  }

  await Promise.all(keys.map(async (key) => {
    try {
      const result = await SecureStorage.get({ key });
      if (typeof result?.value === 'string' && result.value) memory.set(key, result.value);
      else memory.delete(key);
    } catch (error) {
      memory.delete(key);
      console.warn(`[secure-session] Could not hydrate ${key}:`, error?.message || error);
    }
  }));
}

export function setSessionValue(key, value) {
  if (value === undefined || value === null || value === '') {
    removeSessionValue(key);
    return;
  }
  const text = String(value);
  memory.set(key, text);

  if (isNativeAndroid()) {
    // Never mirror native bearer/refresh credentials into WebView localStorage.
    localStorage.removeItem(key);
    void SecureStorage.set({ key, value: text }).catch((error) => {
      console.error(`[secure-session] Could not persist ${key}:`, error?.message || error);
    });
    return;
  }

  localStorage.setItem(key, text);
}

export function removeSessionValue(key) {
  memory.delete(key);
  try { localStorage.removeItem(key); } catch {}
  if (isNativeAndroid()) {
    void SecureStorage.remove({ key }).catch(() => undefined);
  }
}

export async function clearSecureSession() {
  for (const key of Object.values(SESSION_KEYS)) {
    memory.delete(key);
    try { localStorage.removeItem(key); } catch {}
  }
  if (isNativeAndroid()) {
    await SecureStorage.clear().catch(() => undefined);
  }
}

export function migrateLegacyNativeCredentials() {
  if (!isNativeAndroid()) return;
  for (const key of Object.values(SESSION_KEYS)) {
    const legacy = webValue(key);
    if (!legacy) continue;
    setSessionValue(key, legacy);
    try { localStorage.removeItem(key); } catch {}
  }
}
