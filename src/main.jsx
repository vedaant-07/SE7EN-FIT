import React from 'react'
import ReactDOM from 'react-dom/client'
import '@/index.css'

const root = ReactDOM.createRoot(document.getElementById('root'));

if (window.location.pathname === '/gym-owner/dashboard') {
  import('@/pages/GymOwnerDashboardStandalone.jsx').then(({ default: GymOwnerDashboardStandalone }) => {
    root.render(<GymOwnerDashboardStandalone />);
  }).catch((error) => {
    console.error('[SE7EN FIT] standalone owner dashboard failed:', error);
    root.render(
      <div style={{ minHeight: '100vh', background: '#000', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div style={{ maxWidth: 380, textAlign: 'center' }}>
          <h1 style={{ fontSize: 24, fontWeight: 900, marginBottom: 10 }}>SE7EN FIT</h1>
          <p style={{ color: '#f87171', marginBottom: 16 }}>Dashboard could not load. Please redeploy the latest frontend build.</p>
          <button onClick={() => { window.location.href = '/login/gym-owner'; }} style={{ width: '100%', height: 46, borderRadius: 12, background: '#22c55e', color: '#000', fontWeight: 800 }}>Login Again</button>
        </div>
      </div>
    );
  });
} else {
  import('@/App.jsx').then(({ default: App }) => {
    root.render(<App />);
  }).catch((error) => {
    console.error('[SE7EN FIT] app failed:', error);
    root.render(
      <div style={{ minHeight: '100vh', background: '#000', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div style={{ maxWidth: 380, textAlign: 'center' }}>
          <h1 style={{ fontSize: 24, fontWeight: 900, marginBottom: 10 }}>SE7EN FIT</h1>
          <p style={{ color: '#f87171', marginBottom: 16 }}>App could not load. Please refresh or redeploy the latest build.</p>
          <button onClick={() => window.location.reload()} style={{ width: '100%', height: 46, borderRadius: 12, background: '#22c55e', color: '#000', fontWeight: 800 }}>Reload</button>
        </div>
      </div>
    );
  });
}
