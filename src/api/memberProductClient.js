import { base44 } from '@/api/base44Client';
import { getRefreshToken, refreshAuthSession } from '@/lib/authSessionSecurity';

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'https://se7en-fit-api.onrender.com/api'
).replace(/\/+$/, '');
const DEFAULT_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS || 20000);

function requestId(prefix = 'request') {
  const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  return `${prefix}:${id}`;
}

function messageFromPayload(payload, fallback) {
  if (payload && typeof payload === 'object') return payload.error || payload.message || fallback;
  if (typeof payload === 'string' && payload.trim()) return payload.trim();
  return fallback;
}

async function rawRequest(path, {
  method = 'GET',
  body,
  formData,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  retryAuth = true,
} = {}) {
  const token = base44.auth.getToken?.();
  if (!token) {
    const error = new Error('Your session expired. Please log in again.');
    error.status = 401;
    error.code = 'auth_required';
    throw error;
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(formData ? {} : { 'Content-Type': 'application/json' }),
        'X-Client-Date': new Date().toLocaleDateString('en-CA'),
        'X-Client-Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      },
      body: formData || (body === undefined ? undefined : JSON.stringify(body)),
      signal: controller.signal,
    });

    if (response.status === 401 && retryAuth && getRefreshToken()) {
      await refreshAuthSession();
      return rawRequest(path, { method, body, formData, timeoutMs, retryAuth: false });
    }

    const isJson = response.headers.get('content-type')?.includes('application/json');
    const payload = isJson
      ? await response.json().catch(() => null)
      : await response.text().catch(() => null);

    if (!response.ok) {
      const error = new Error(messageFromPayload(payload, `Request failed (${response.status})`));
      error.status = response.status;
      error.code = payload?.code;
      error.details = payload?.details;
      error.body = payload;
      throw error;
    }
    return payload;
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error('The server is taking too long to respond. Please try again.');
      timeoutError.isTimeout = true;
      timeoutError.isNetworkError = true;
      throw timeoutError;
    }
    if (error instanceof TypeError && !error.status) {
      const networkError = new Error('You appear to be offline. Reconnect and try again.');
      networkError.isNetworkError = true;
      throw networkError;
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

function query(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  });
  const value = search.toString();
  return value ? `?${value}` : '';
}

export const memberProductClient = {
  newRequestId: requestId,

  getOverview: (date) => rawRequest(`/member/overview${query({ date })}`, { timeoutMs: 30000 }),

  getNutritionSummary: (date) => rawRequest(`/member/nutrition/summary${query({ date })}`),
  addNutritionLog: (payload) => rawRequest('/member/nutrition/logs', { method: 'POST', body: payload }),
  deleteNutritionLog: (logId) => rawRequest(`/member/nutrition/logs/${encodeURIComponent(logId)}`, { method: 'DELETE' }),

  getAiHistory: (conversationId = 'ai_trainer_default') =>
    rawRequest(`/member/ai/history${query({ conversation_id: conversationId })}`),
  sendAiMessage: ({ message, conversationId = 'ai_trainer_default', requestId: value = requestId('coach') }) =>
    rawRequest('/member/ai/coach', {
      method: 'POST',
      body: { message, conversation_id: conversationId, request_id: value },
      timeoutMs: 60000,
    }),
  clearAiHistory: (conversationId = 'ai_trainer_default') =>
    rawRequest(`/member/ai/history${query({ conversation_id: conversationId })}`, { method: 'DELETE' }),
  updateAiMessage: (messageId, content) =>
    rawRequest(`/member/ai/messages/${encodeURIComponent(messageId)}`, { method: 'PATCH', body: { content } }),
  deleteAiMessage: (messageId) =>
    rawRequest(`/member/ai/messages/${encodeURIComponent(messageId)}`, { method: 'DELETE' }),

  analyzeFood: ({ file, mealType = 'meal', requestId: value = requestId('food') }) => {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('meal_type', mealType);
    formData.append('request_id', value);
    return rawRequest('/member/food-scan/analyze', { method: 'POST', formData, timeoutMs: 70000 });
  },
  confirmFood: (scanId, payload) =>
    rawRequest(`/member/food-scan/${encodeURIComponent(scanId)}/confirm`, { method: 'POST', body: payload }),

  getWorkoutPlan: () => rawRequest('/member/workout-plan', { timeoutMs: 30000 }),
  generateWorkoutPlan: (value = requestId('workout')) =>
    rawRequest('/member/workout-plan/generate', { method: 'POST', body: { request_id: value }, timeoutMs: 90000 }),
  completeWorkoutDay: (planId, payload) =>
    rawRequest(`/member/workout-plan/${encodeURIComponent(planId)}/complete`, { method: 'POST', body: payload }),
};
