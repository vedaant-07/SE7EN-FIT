package com.se7enfit.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.Map;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

@CapacitorPlugin(name = "SE7ENSecureStorage")
public class SE7ENSecureStoragePlugin extends Plugin {
  private static final String KEYSTORE = "AndroidKeyStore";
  private static final String KEY_ALIAS = "se7enfit_session_v1";
  private static final String PREFS = "se7enfit_secure_session";
  private static final String TRANSFORMATION = "AES/GCM/NoPadding";

  private SharedPreferences prefs() {
    return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
  }

  private SecretKey secretKey() throws Exception {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
      throw new IllegalStateException("Secure storage requires Android 6.0 or newer.");
    }

    KeyStore keyStore = KeyStore.getInstance(KEYSTORE);
    keyStore.load(null);
    if (keyStore.containsAlias(KEY_ALIAS)) {
      return (SecretKey) keyStore.getKey(KEY_ALIAS, null);
    }

    KeyGenerator keyGenerator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE);
    KeyGenParameterSpec spec = new KeyGenParameterSpec.Builder(
      KEY_ALIAS,
      KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
    )
      .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
      .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
      .setRandomizedEncryptionRequired(true)
      .build();
    keyGenerator.init(spec);
    return keyGenerator.generateKey();
  }

  private String encrypt(String plaintext) throws Exception {
    Cipher cipher = Cipher.getInstance(TRANSFORMATION);
    cipher.init(Cipher.ENCRYPT_MODE, secretKey());
    byte[] iv = cipher.getIV();
    byte[] ciphertext = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
    return Base64.encodeToString(iv, Base64.NO_WRAP) + "." + Base64.encodeToString(ciphertext, Base64.NO_WRAP);
  }

  private String decrypt(String encoded) throws Exception {
    String[] parts = encoded.split("\\.", 2);
    if (parts.length != 2) throw new IllegalArgumentException("Invalid secure value.");
    byte[] iv = Base64.decode(parts[0], Base64.NO_WRAP);
    byte[] ciphertext = Base64.decode(parts[1], Base64.NO_WRAP);
    Cipher cipher = Cipher.getInstance(TRANSFORMATION);
    cipher.init(Cipher.DECRYPT_MODE, secretKey(), new GCMParameterSpec(128, iv));
    return new String(cipher.doFinal(ciphertext), StandardCharsets.UTF_8);
  }

  private String safeKey(PluginCall call) {
    String key = call.getString("key", "").trim();
    if (!key.matches("[A-Za-z0-9._:-]{1,100}")) return null;
    return key;
  }

  @PluginMethod
  public void set(PluginCall call) {
    String key = safeKey(call);
    String value = call.getString("value");
    if (key == null || value == null) {
      call.reject("A valid key and value are required.");
      return;
    }
    try {
      prefs().edit().putString(key, encrypt(value)).apply();
      JSObject result = new JSObject();
      result.put("stored", true);
      call.resolve(result);
    } catch (Exception error) {
      call.reject("Could not securely store session data.", error);
    }
  }

  @PluginMethod
  public void get(PluginCall call) {
    String key = safeKey(call);
    if (key == null) {
      call.reject("A valid key is required.");
      return;
    }
    String encoded = prefs().getString(key, null);
    JSObject result = new JSObject();
    if (encoded == null) {
      result.put("value", JSObject.NULL);
      call.resolve(result);
      return;
    }
    try {
      result.put("value", decrypt(encoded));
      call.resolve(result);
    } catch (Exception error) {
      // Corrupt/undecryptable credentials are deleted rather than repeatedly failing startup.
      prefs().edit().remove(key).apply();
      result.put("value", JSObject.NULL);
      result.put("recovered", true);
      call.resolve(result);
    }
  }

  @PluginMethod
  public void remove(PluginCall call) {
    String key = safeKey(call);
    if (key == null) {
      call.reject("A valid key is required.");
      return;
    }
    prefs().edit().remove(key).apply();
    call.resolve();
  }

  @PluginMethod
  public void clear(PluginCall call) {
    prefs().edit().clear().apply();
    call.resolve();
  }

  @PluginMethod
  public void keys(PluginCall call) {
    JSObject result = new JSObject();
    JSObject values = new JSObject();
    for (Map.Entry<String, ?> entry : prefs().getAll().entrySet()) {
      values.put(entry.getKey(), true);
    }
    result.put("keys", values);
    call.resolve(result);
  }
}
