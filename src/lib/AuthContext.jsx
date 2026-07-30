import React, { createContext, useState, useContext, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { base44 } from '@/api/base44Client';
import {
  clearStoredSession,
  endAuthSession,
  getRefreshToken,
  getVerifiedCurrentUser,
} from '@/lib/authSessionSecurity';

const AuthContext = createContext();
const isNativeCapacitor = import.meta.env.MODE === 'capacitor' || Capacitor.isNativePlatform() || (typeof window !== 'undefined' && window.location.hostname === 'localhost' && !window.location.port);
const AUTH_STARTUP_TIMEOUT_MS = 8000;

function withTimeout(promise, ms = AUTH_STARTUP_TIMEOUT_MS) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => {
      const error = new Error('Auth check timed out');
      error.isNetworkError = true;
      reject(error);
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timeoutId));
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings, setAppPublicSettings] = useState(null);

  useEffect(() => {
    checkAppState();
  }, []);

  const finishReady = (currentUser = null) => {
    setUser(currentUser);
    setIsAuthenticated(Boolean(currentUser));
    setAuthChecked(true);
    setAuthError(null);
    setAppPublicSettings({ id: 'se7enfit-local', public_settings: {} });
    setIsLoadingPublicSettings(false);
    setIsLoadingAuth(false);
  };

  const resolveSessionUser = async () => {
    const token = base44.auth.getToken();
    const refreshToken = getRefreshToken();
    const cachedUser = base44.auth.getCachedUser?.();
    if (!token && !refreshToken) return null;

    try {
      return await withTimeout(getVerifiedCurrentUser(), AUTH_STARTUP_TIMEOUT_MS);
    } catch (error) {
      if ([400, 401, 403].includes(error?.status)) {
        clearStoredSession();
        return null;
      }
      if (cachedUser) {
        console.warn('[Auth] server validation unavailable; using cached session until connectivity returns:', error?.message || error);
        return cachedUser;
      }
      throw error;
    }
  };

  const completeStartup = async () => {
    const currentUser = await resolveSessionUser();
    finishReady(currentUser);
  };

  const checkAppState = async () => {
    setIsLoadingAuth(true);
    setIsLoadingPublicSettings(true);
    const safetyTimer = window.setTimeout(() => {
      console.warn('[Auth] startup safety timeout reached; continuing without blocking UI.');
      finishReady(base44.auth.getCachedUser?.() || null);
    }, AUTH_STARTUP_TIMEOUT_MS + 3000);

    try {
      await completeStartup();
    } catch (error) {
      console.error('App startup failed:', error);
      setAuthError(error);
      finishReady(null);
    } finally {
      window.clearTimeout(safetyTimer);
    }
  };

  const checkUserAuth = async () => {
    try {
      setIsLoadingAuth(true);
      const currentUser = await resolveSessionUser();
      setUser(currentUser);
      setIsAuthenticated(Boolean(currentUser));
      setAuthError(null);
      return currentUser;
    } catch (error) {
      console.error('User auth check failed:', error);
      setUser(null);
      setIsAuthenticated(false);
      setAuthError(error);
      return null;
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  };

  const logout = async (scope = 'local') => {
    try {
      await endAuthSession(scope);
    } catch (error) {
      console.warn('[Auth] backend logout could not be confirmed:', error?.message || error);
    } finally {
      setUser(null);
      setIsAuthenticated(false);
      setAuthError(null);
    }
  };

  const navigateToLogin = () => {
    if (isNativeCapacitor) {
      window.location.hash = '#/welcome';
      return;
    }
    window.location.href = '/welcome';
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      authChecked,
      logout,
      navigateToLogin,
      checkUserAuth,
      checkAppState
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
