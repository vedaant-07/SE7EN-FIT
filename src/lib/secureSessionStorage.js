import { Capacitor, registerPlugin } from '@capacitor/core';

const SecureStorage = registerPlugin('SE7ENSecureStorage');
const memory = new Map();
const nativeCredentialKeys = new Set([
  'se7enfit_auth_token',
  'se7enfit_refresh_token',
  'se7enfit_auth_expires_at',
]);

const originalStorageGetItem = Storage.prototype.getItem;
const originalStorageSetItem = Storage.prototype.setItem;
const originalStorageRemoveItem = Storage.prototype.removeItem;
let guardInstalled = false;

const isNativeAndroid = () => Capacitor.isNativePlatform?.() && Capacitor.getPlatform?.() === 'android';

export const SESSION_KEYS = {
  accessToken: 'se7enfit_auth_token',
  refreshToken: 'se7enfit_refresh_token',
  expiresAt: 'se7enfit_auth_expires_at',
};

function directLocalGet(key) {
  try { return originalStorageGetItem.call(localStorage, key); } catch { return null; }
}

function directLocalRemove(key) {
  try { originalStorageRemoveItem.call(localStorage, key); } catch {}
}

function installNativeStorageGuard() {
  if (!isNativeAndroid() || guardInstalled) return;
  guardInstalled = true;

  Storage.prototype.getItem = function guardedGetItem(key) {
    const normalized = String(key);
    if (this === localStorage && nativeCredentialKeys.has(normalized)) {
      return memory.get(normalized) ?? null;
    }
    return originalStorageGetItem.call(this, key);
  };

  Storage.prototype.setItem = function guardedSetItem(key, value) {
    const normalized = String(key);
    if (this === localStorage && nativeCredentialKeys.has(normalized)) {
      const text = String(value);
      memory.set(normalized, text);
      void SecureStorage.set({ key: normalized, value: text }).catch((error) => {
        console.error(`[secure-session] Could not persist ${normalized}:`, error?.message || error);
      });
      directLocalRemove(normalized);
      return;
    }
    return originalStorageSetItem.call(this, key, value);
  };

  Storage.prototype.removeItem = function guardedRemoveItem(key) {
    const normalized = String(key);
    if (this === localStorage && nativeCredentialKeys.has(normalized)) {
      memory.delete(normalized);
      directLocalRemove(normalized);
      void SecureStorage.remove({ key: normalized }).catch(() => undefined);
      return;
    }
    return originalStorageRemoveItem.call(this, key);
  };
}

async function readNativeCredential(key) {
  try {
    const result = await SecureStorage.get({ key });
    return typeof result?.value === 'string' && result.value ? result.value : null;
  } catch (error) {
    console.warn(`[secure-session] Could not read ${key}:`, error?.message || error);
    return null;
  }
}

export async function initializeSecureSessionStorage() {
  if (!isNativeAndroid()) return;

  // One-time migration: move credentials left by older builds out of WebView
  // localStorage before the app imports/authenticates through its API client.
  for (const key of nativeCredentialKeys) {
    const legacy = directLocalGet(key);
    if (legacy) {
      try {
        await SecureStorage.set({ key, value: legacy });
        memory.set(key, legacy);
      } catch (error) {
        console.error(`[secure-session] Could not migrate ${key}:`, error?.message || error);
      } finally {
        directLocalRemove(key);
      }
    }
  }

  for (const key of nativeCredentialKeys) {
    if (memory.has(key)) continue;
    const value = await readNativeCredential(key);
    if (value) memory.set(key, value);
  }

  // Existing app code can keep using localStorage APIs; on Android these
  // credential keys are now served from memory and persisted in Keystore.
  installNativeStorageGuard();
}

export function getSessionValue(key) {
  if (isNativeAndroid() && nativeCredentialKeys.has(key)) return memory.get(key) ?? null;
  return directLocalGet(key);
}

export function setSessionValue(key, value) {
  if (value === undefined || value === null || value === '') {
    removeSessionValue(key);
    return;
  }

  const text = String(value);
  if (isNativeAndroid() && nativeCredentialKeys.has(key)) {
    memory.set(key, text);
    directLocalRemove(key);
    void SecureStorage.set({ key, value: text }).catch((error) => {
      console.error(`[secure-session] Could not persist ${key}:`, error?.message || error);
    });
    return;
  }
  originalStorageSetItem.call(localStorage, key, text);
}

export function removeSessionValue(key) {
  memory.delete(key);
  directLocalRemove(key);
  if (isNativeAndroid() && nativeCredentialKeys.has(key)) {
    void SecureStorage.remove({ key }).catch(() => undefined);
  }
}

export async function clearSecureSession() {
  for (const key of nativeCredentialKeys) {
    memory.delete(key);
    directLocalRemove(key);
  }
  if (isNativeAndroid()) await SecureStorage.clear().catch(() => undefined);
}
