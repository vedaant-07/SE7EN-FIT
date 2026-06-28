import React, { createContext, useState, useContext, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { base44 } from '@/api/base44Client';

const AuthContext = createContext();
const isNativeCapacitor = import.meta.env.MODE === 'capacitor' || Capacitor.isNativePlatform() || (typeof window !== 'undefined' && window.location.hostname === 'localhost' && !window.location.port);

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

  const completeStartup = async () => {
    let currentUser = null;

    if (base44.auth.getToken()) {
      try {
        currentUser = await base44.auth.me();
      } catch (error) {
        console.warn('[Auth] startup auth check failed:', error?.message || error);
        base44.auth.logout();
        currentUser = null;
      }
    }

    setUser(currentUser);
    setIsAuthenticated(Boolean(currentUser));
    setAuthChecked(true);
    setAuthError(null);
    setAppPublicSettings({ id: 'se7enfit-local', public_settings: {} });
    setIsLoadingPublicSettings(false);
    setIsLoadingAuth(false);
  };

  const checkAppState = async () => {
    try {
      await completeStartup();
    } catch (error) {
      console.error('App startup failed:', error);
      setUser(null);
      setIsAuthenticated(false);
      setAuthError(null);
      setAppPublicSettings({ id: 'se7enfit-local', public_settings: {} });
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  };

  const checkUserAuth = async () => {
    try {
      setIsLoadingAuth(true);
      let currentUser = null;

      if (base44.auth.getToken()) {
        try {
          currentUser = await base44.auth.me();
        } catch (error) {
          console.warn('[Auth] user auth check failed:', error?.message || error);
          base44.auth.logout();
          currentUser = null;
        }
      }

      setUser(currentUser);
      setIsAuthenticated(Boolean(currentUser));
      setAuthError(null);
    } catch (error) {
      console.error('User auth check failed:', error);
      setUser(null);
      setIsAuthenticated(false);
      setAuthError(null);
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