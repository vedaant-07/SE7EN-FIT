import express from 'express';

const missingProductionRoutes = [
  '/api/auth/refresh',
  '/api/auth/password-reset/request',
  '/api/auth/password-reset/confirm',
];

function register(app) {
  if (app.__se7enfitDirectAuthSecurityRoutes) return;
  app.__se7enfitDirectAuthSecurityRoutes = true;

  // authSecurityPreload patches app.post and replaces these placeholders with
  // the hardened handlers. The production server did not previously declare
  // these paths, so the patched handlers were never registered.
  for (const path of missingProductionRoutes) {
    app.post(path, (_req, res) => res.status(500).json({ error: 'Secure authentication route was not initialized.' }));
  }

  // These routes are appended during app.listen, after the legacy server error
  // middleware, so they require a final JSON error boundary of their own.
  app.use((error, _req, res, next) => {
    if (!error) return next();
    const status = Number(error?.status || 500);
    if (res.headersSent) return next(error);
    if (status >= 500) console.error('[auth-security-direct] request failed:', error);
    return res.status(status).json({
      error: status >= 500 ? 'The authentication service could not complete this request.' : String(error?.message || 'Authentication request failed.'),
      code: error?.code || 'authentication_failed',
    });
  });
}

const originalListen = express.application.listen;
express.application.listen = function listenWithDirectAuthSecurityRoutes(...args) {
  register(this);
  return originalListen.apply(this, args);
};
