const RENDER_FRONTEND_ORIGINS = [
  'https://gym-owner-website.onrender.com',
  'https://se7enfit-gym-owner.onrender.com',
  'https://aesthetic-canvas-grid.onrender.com',
  'https://se7en-fit-web.onrender.com',
  'https://se7en-fit.onrender.com',
  'https://se7enfit-admin.onrender.com',
  'https://super-admin-station.onrender.com',
];

const LOCAL_FRONTEND_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
];

const isProduction = process.env.NODE_ENV === 'production';
const defaults = isProduction
  ? RENDER_FRONTEND_ORIGINS
  : [...RENDER_FRONTEND_ORIGINS, ...LOCAL_FRONTEND_ORIGINS];

const configured = String(process.env.FRONTEND_ORIGIN || '').trim();

if (!configured || configured === '*') {
  if (isProduction && configured === '*') {
    console.warn('[security] FRONTEND_ORIGIN="*" is not allowed in production; using the approved origin allowlist.');
  }
  process.env.FRONTEND_ORIGIN = defaults.join(',');
} else {
  const current = configured
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
    .filter((origin) => !isProduction || !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin));
  process.env.FRONTEND_ORIGIN = Array.from(new Set([...current, ...defaults])).join(',');
}
