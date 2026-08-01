import { base44 } from '@/api/base44Client';
import { getRefreshToken, refreshAuthSession } from '@/lib/authSessionSecurity';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'https://se7en-fit-api.onrender.com/api').replace(/\/+$/, '');
const DEFAULT_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS || 15000);

function messageFromBody(body, fallback) {
  if (body && typeof body === 'object') return body.error || body.message || fallback;
  if (typeof body === 'string' && body.trim()) return body.trim();
  return fallback;
}

async function request(path, { method = 'GET', body, timeoutMs = DEFAULT_TIMEOUT_MS, retryAuth = true } = {}) {
  const token = base44.auth.getToken?.();
  if (!token) {
    const error = new Error('Your session expired. Please log in again.');
    error.status = 401;
    throw error;
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });

    if (response.status === 401 && retryAuth && getRefreshToken()) {
      await refreshAuthSession();
      return request(path, { method, body, timeoutMs, retryAuth: false });
    }

    const isJson = response.headers.get('content-type')?.includes('application/json');
    const payload = isJson ? await response.json().catch(() => null) : await response.text().catch(() => null);
    if (!response.ok) {
      const error = new Error(messageFromBody(payload, `Billing request failed (${response.status})`));
      error.status = response.status;
      error.code = payload?.code;
      error.fields = payload?.fields;
      throw error;
    }
    return payload;
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error('Billing is taking too long to respond. Please try again.');
      timeoutError.code = 'timeout';
      throw timeoutError;
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

export const billingClient = {
  getCatalog: () => request('/billing/catalog'),
  getMemberBilling: () => request('/billing/me', { timeoutMs: 25000 }),
};
