import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource-variable/inter/wght.css'
import '@fontsource-variable/space-grotesk/wght.css'
import '@/index.css'
import { initializeSecureSessionStorage } from '@/lib/secureSessionStorage'

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('SE7EN FIT root element is missing');

const root = ReactDOM.createRoot(rootElement);
const path = window.location.pathname;

function renderFallback(message, actionPath = '/login/gym-owner', actionLabel = 'Login Again') {
  root.render(
    <div style={{ minHeight: '100vh', background: '#000', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'Inter Variable, system-ui, sans-serif' }}>
      <div style={{ maxWidth: 380, textAlign: 'center' }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, marginBottom: 10 }}>SE7EN FIT</h1>
        <p style={{ color: '#f87171', marginBottom: 16 }}>{message}</p>
        <button onClick={() => { window.location.href = actionPath; }} style={{ width: '100%', height: 46, borderRadius: 12, background: '#22c55e', color: '#000', fontWeight: 800 }}>{actionLabel}</button>
      </div>
    </div>
  );
}

// A production web build should never leave users on an unexplained black screen.
// If React has not painted anything shortly after startup, show a recoverable error.
const bootWatchdog = window.setTimeout(() => {
  if (!rootElement.hasChildNodes()) {
    console.error('[SE7EN FIT] web bootstrap produced no UI');
    renderFallback('The web app could not start. Please reload the latest deployed version.', window.location.pathname, 'Reload');
  }
}, 8000);

async function bootstrap() {
  try {
    // Android bearer/refresh credentials are migrated from any older WebView
    // storage and hydrated from the native Keystore before auth code is loaded.
    await initializeSecureSessionStorage();
  } catch (error) {
    window.clearTimeout(bootWatchdog);
    console.error('[SE7EN FIT] secure session initialization failed:', error);
    renderFallback('Secure session storage could not initialize. Please restart the app.', '/welcome', 'Restart Login');
    return;
  }

  if (path === '/gym-owner/dashboard') {
    import('@/pages/GymOwnerDashboardStandalone.jsx')
      .then(({ default: GymOwnerDashboardStandalone }) => {
        window.clearTimeout(bootWatchdog);
        root.render(<GymOwnerDashboardStandalone />);
      })
      .catch((error) => {
        window.clearTimeout(bootWatchdog);
        console.error('[SE7EN FIT] standalone owner dashboard failed:', error);
        renderFallback('Dashboard could not load. Please redeploy the latest frontend build.');
      });
  } else if (path === '/gym-owner/onboarding') {
    import('@/pages/GymOwnerOnboardingStandalone.jsx')
      .then(({ default: GymOwnerOnboardingStandalone }) => {
        window.clearTimeout(bootWatchdog);
        root.render(<GymOwnerOnboardingStandalone />);
      })
      .catch((error) => {
        window.clearTimeout(bootWatchdog);
        console.error('[SE7EN FIT] standalone owner onboarding failed:', error);
        renderFallback('Gym setup could not load. Please redeploy the latest frontend build.', '/login/gym-owner', 'Login Again');
      });
  } else {
    import('@/App.jsx')
      .then(({ default: App }) => {
        window.clearTimeout(bootWatchdog);
        root.render(<App />);
      })
      .catch((error) => {
        window.clearTimeout(bootWatchdog);
        console.error('[SE7EN FIT] app failed:', error);
        renderFallback('App could not load. Please refresh or redeploy the latest build.', window.location.pathname, 'Reload');
      });
  }
}

void bootstrap();
