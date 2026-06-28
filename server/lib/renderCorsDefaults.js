const DEFAULT_FRONTEND_ORIGINS = [
  'https://gym-owner-website.onrender.com',
  'https://se7enfit-gym-owner.onrender.com',
  'https://se7en-fit-web.onrender.com',
  'https://se7en-fit.onrender.com',
  'https://se7enfit-admin.onrender.com',
  'https://super-admin-station.onrender.com',
  'http://localhost:5173',
  'http://localhost:3000',
];

if (!process.env.FRONTEND_ORIGIN || process.env.FRONTEND_ORIGIN.trim() === '') {
  process.env.FRONTEND_ORIGIN = DEFAULT_FRONTEND_ORIGINS.join(',');
} else if (process.env.FRONTEND_ORIGIN !== '*') {
  const current = process.env.FRONTEND_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean);
  const merged = Array.from(new Set([...current, ...DEFAULT_FRONTEND_ORIGINS]));
  process.env.FRONTEND_ORIGIN = merged.join(',');
}
