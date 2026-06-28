import React, { createContext, useState, useContext, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { base44 } from '@/api/base44Client';

const AuthContext = createContext();
const isNativeCapacitor = import.meta.env.MODE === 'capacitor' || Capacitor.isNativePlatform() || (typeof window !== 'undefined' && window.location.hostname === 'localhost' && !window.location.port);
const AUTH_STARTUP_TIMEOUT_MS = 8000;

function withTimeout(promise, ms = AUTH_STARTUP_TIMEOUT_MS) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error('Auth check timed out')), ms);
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

  const completeStartup = async () => {
    const token = base44.auth.getToken();
    const cachedUser = base44.auth.getCachedUser?.();

    if (token && cachedUser) {
      finishReady(cachedUser);
      withTimeout(base44.auth.me(), AUTH_STARTUP_TIMEOUT_MS)
        .then((freshUser) => {
          if (freshUser) {
            setUser(freshUser);
            setIsAuthenticated(true);
          }
        })
        .catch((error) => {
          console.warn('[Auth] background session validation skipped:', error?.message || error);
        });
      return;
    }

    if (token) {
      try {
        const currentUser = await withTimeout(base44.auth.me(), AUTH_STARTUP_TIMEOUT_MS);
        finishReady(currentUser);
        return;
      } catch (error) {
        console.warn('[Auth] startup auth check failed:', error?.message || error);
        base44.auth.logout();
      }
    }

    finishReady(null);
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
      finishReady(base44.auth.getCachedUser?.() || null);
    } finally {
      window.clearTimeout(safetyTimer);
    }
  };

  const checkUserAuth = async () => {
    try {
      setIsLoadingAuth(true);
      const token = base44.auth.getToken();
      const cachedUser = base44.auth.getCachedUser?.();

      if (token && cachedUser) {
        setUser(cachedUser);
        setIsAuthenticated(true);
        setAuthError(null);
        setAuthChecked(true);
        setIsLoadingAuth(false);
        return cachedUser;
      }

      if (token) {
        try {
          const currentUser = await withTimeout(base44.auth.me(), AUTH_STARTUP_TIMEOUT_MS);
          setUser(currentUser);
          setIsAuthenticated(Boolean(currentUser));
          setAuthError(null);
          return currentUser;
        } catch (error) {
          console.warn('[Auth] user auth check failed:', error?.message || error);
          base44.auth.logout();
        }
      }

      setUser(null);
      setIsAuthenticated(false);
      setAuthError(null);
      return null;
    } catch (error) {
      console.error('User auth check failed:', error);
      setUser(null);
      setIsAuthenticated(false);
      setAuthError(null);
      return null;
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  };

  const logout = () => {
    base44.auth.logout();
    setUser(null);
    setIsAuthenticated(false);
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
