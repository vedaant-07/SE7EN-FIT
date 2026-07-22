import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource-variable/inter/wght.css'
import '@fontsource-variable/space-grotesk/wght.css'
import '@/index.css'

const root = ReactDOM.createRoot(document.getElementById('root'));
const path = '';

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

if (path === '/gym-owner/dashboard') {
  import('@/pages/GymOwnerDashboardStandalone.jsx')
    .then(({ default: GymOwnerDashboardStandalone }) => root.render(<GymOwnerDashboardStandalone />))
    .catch((error) => {
      console.error('[SE7EN FIT] standalone owner dashboard failed:', error);
      renderFallback('Dashboard could not load. Please redeploy the latest frontend build.');
    });
} else if (path === '/gym-owner/onboarding') {
  import('@/pages/GymOwnerOnboardingStandalone.jsx')
    .then(({ default: GymOwnerOnboardingStandalone }) => root.render(<GymOwnerOnboardingStandalone />))
    .catch((error) => {
      console.error('[SE7EN FIT] standalone owner onboarding failed:', error);
      renderFallback('Gym setup could not load. Please redeploy the latest frontend build.', '/login/gym-owner', 'Login Again');
    });
} else {
  import('@/App.jsx')
    .then(({ default: App }) => root.render(<App />))
    .catch((error) => {
      console.error('[SE7EN FIT] app failed:', error);
      renderFallback('App could not load. Please refresh or redeploy the latest build.', window.location.pathname, 'Reload');
    });
}
