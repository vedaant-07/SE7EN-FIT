import express from 'express';

const requiredPhase5Routes = [
  ['get', '/api/member/overview'],
  ['get', '/api/member/nutrition/summary'],
  ['post', '/api/member/nutrition/logs'],
  ['get', '/api/member/ai/history'],
  ['post', '/api/member/ai/coach'],
  ['post', '/api/member/food-scan/analyze'],
  ['get', '/api/member/workout-plan'],
  ['post', '/api/member/workout-plan/generate'],
];

function routeKey(layer) {
  if (!layer?.route?.path) return null;
  const method = Object.keys(layer.route.methods || {}).find((value) => layer.route.methods[value]);
  return method ? `${method} ${layer.route.path}` : null;
}

function verifyRoutes(app) {
  const registered = new Set((app?._router?.stack || []).map(routeKey).filter(Boolean));
  const missing = requiredPhase5Routes
    .map(([method, path]) => `${method} ${path}`)
    .filter((key) => !registered.has(key));
  if (missing.length) {
    throw new Error(`Phase 5 member routes were not initialized: ${missing.join(', ')}`);
  }
}

const originalListen = express.application.listen;
express.application.listen = function listenWithPhase5RouteVerification(...args) {
  verifyRoutes(this);
  return originalListen.apply(this, args);
};
