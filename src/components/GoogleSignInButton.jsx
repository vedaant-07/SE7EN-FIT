import React, { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';

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

export default function GoogleSignInButton({ role = 'user', onSuccess, onError, disabled }) {
  const containerRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    const render = async () => {
      try {
        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
        if (!clientId) throw new Error('Google login is not configured. Add VITE_GOOGLE_CLIENT_ID.');

        await loadGoogleIdentityScript();
        if (!mounted || !containerRef.current) return;

        containerRef.current.innerHTML = '';
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: async (response) => {
            try {
              if (!response.credential) throw new Error('Google did not return an ID token');
              const user = await base44.auth.loginWithGoogleCredential(response.credential, role);
              await onSuccess?.(user);
            } catch (error) {
              onError?.(error);
            }
          },
          use_fedcm_for_prompt: true,
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
  }, [role, onSuccess, onError]);

  return (
    <div className={`w-full min-h-12 rounded-xl overflow-hidden ${disabled ? 'pointer-events-none opacity-60' : ''}`}>
      <div ref={containerRef} className="w-full flex justify-center" />
      {!ready && (
        <div className="w-full h-12 rounded-xl border border-border flex items-center justify-center text-sm font-medium text-muted-foreground">
          Loading Google…
        </div>
      )}
    </div>
  );
}
