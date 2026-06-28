import React, { useEffect, useRef, useState } from 'react';

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'https://se7en-fit.onrender.com/api'
).replace(/\/+$/, '');

function loadGoogleIdentityScript() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve();
      return;
    }

    const existing = document.querySelector('script[data-google-identity]');
    if (existing) {
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.dataset.googleIdentity = 'true';
    script.onload = resolve;
    script.onerror = () => reject(new Error('Google login script failed to load'));
    document.head.appendChild(script);
  });
}

function normalizeRole(role) {
  const value = String(role || 'user').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (['owner', 'gym_owner', 'gymowner'].includes(value)) return 'gym_owner';
  if (['admin', 'super_admin', 'superadmin'].includes(value)) return 'super_admin';
  return 'user';
}

function cacheSession(session = {}) {
  const token = session.access_token || session.token;
  if (!token) throw new Error('No access token returned from server');
  localStorage.setItem('se7enfit_auth_token', token);
  localStorage.setItem('se7enfit_auth', 'true');

  const user = session.user ? { ...session.user, role: normalizeRole(session.user.role) } : null;
  if (user) localStorage.setItem('se7enfit_user', JSON.stringify(user));
  return user;
}

async function exchangeGoogleCredential(credential, role) {
  const response = await fetch(`${API_BASE_URL}/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: credential, role }),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error || data?.message || `Google login failed (${response.status})`);
  }

  return cacheSession(data);
}

export default function GoogleSignInButton({ role = 'user', onSuccess, onError, disabled }) {
  const containerRef = useRef(null);
  const [ready, setReady] = useState(false);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId) return undefined;

    let mounted = true;

    const render = async () => {
      try {
        await loadGoogleIdentityScript();
        if (!mounted || !containerRef.current) return;

        containerRef.current.innerHTML = '';
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: async (response) => {
            try {
              if (!response.credential) throw new Error('Google did not return an ID token');
              const user = await exchangeGoogleCredential(response.credential, role);
              await onSuccess?.(user);
            } catch (error) {
              onError?.(error);
            }
          },
        });

        window.google.accounts.id.renderButton(containerRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          shape: 'rectangular',
          text: 'continue_with',
          logo_alignment: 'center',
          width: Math.min(360, containerRef.current.offsetWidth || 360),
        });

        setReady(true);
      } catch (error) {
        onError?.(error);
      }
    };

    render();
    return () => { mounted = false; };
  }, [clientId, role, onSuccess, onError]);

  if (!clientId) return null;

  return (
    <div className={`w-full min-h-12 rounded-xl overflow-hidden ${disabled ? 'pointer-events-none opacity-60' : ''}`}>
      <div ref={containerRef} className="w-full flex justify-center" />
      {!ready && (
        <div className="w-full h-12 rounded-xl border border-border flex items-center justify-center text-sm font-medium text-muted-foreground">
          Loading Google...
        </div>
      )}
    </div>
  );
}
