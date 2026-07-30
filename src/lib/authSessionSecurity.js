import { base44 } from '@/api/base44Client';
import { cacheRouteUser } from '@/lib/routing';

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'https://se7en-fit-api.onrender.com/api'
).replace(/\/+$/, '');

const REFRESH_TOKEN_KEY = 'se7enfit_refresh_token';
const EXPIRES_AT_KEY = 'se7enfit_auth_expires_at';

function normaliseError(data, status, fallback) {
  const message = data && typeof data === 'object'
    ? data.message || data.error
    : typeof data === 'string'
      ? data
      : '';
  const error = new Error(message || fallback || `Request failed (${status})`);
  error.status = status;
  error.body = data;
  return error;
}

async function request(path, { method = 'POST', body, token, timeoutMs = 15000 } = {}) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? window.setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller?.signal,
    });
    const isJson = response.headers.get('content-type')?.includes('application/json');
    const data = isJson
      ? await response.json().catch(() => null)
      : await response.text().catch(() => null);
    if (!response.ok) throw normaliseError(data, response.status, 'Authentication request failed.');
    return data;
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error('Server is taking too long to respond. Please try again.');
      timeoutError.isNetworkError = true;
      throw timeoutError;
    }
    throw error;
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function clearStoredSession() {
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(EXPIRES_AT_KEY);
  base44.auth.logout();
}

export function storeAuthSession(session = {}) {
  const accessToken = session.access_token || session.token;
  if (!accessToken) throw new Error('No access token returned from server.');

  base44.auth.setToken(accessToken);
  if (session.refresh_token) localStorage.setItem(REFRESH_TOKEN_KEY, session.refresh_token);
  if (session.expires_at) localStorage.setItem(EXPIRES_AT_KEY, String(session.expires_at));

  const user = cacheRouteUser(session.user || base44.auth.getCachedUser?.() || {});
  return { ...session, access_token: accessToken, token: accessToken, user };
}

export async function refreshAuthSession() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    clearStoredSession();
    const error = new Error('Session expired. Please log in again.');
    error.status = 401;
    throw error;
  }

  try {
    const session = await request('/auth/refresh', {
      body: { refresh_token: refreshToken },
    });
    return storeAuthSession(session);
  } catch (error) {
    if (error?.status === 400 || error?.status === 401 || error?.status === 403) clearStoredSession();
    throw error;
  }
}

export async function getVerifiedCurrentUser() {
  try {
    return await base44.auth.me();
  } catch (error) {
    if (error?.status !== 401 || !getRefreshToken()) throw error;
    const refreshed = await refreshAuthSession();
    return refreshed.user || await base44.auth.me();
  }
}

export async function verifyAuthOtp({ email, otpCode, purpose = 'login' }) {
  const session = await request('/auth/verify-otp', {
    body: {
      email: String(email || '').trim().toLowerCase(),
      otp_code: otpCode,
      otpCode,
      purpose,
    },
  });
  return storeAuthSession(session);
}

export async function resendAuthOtp(email, purpose = 'login') {
  return request('/auth/resend-otp', {
    body: { email: String(email || '').trim().toLowerCase(), purpose },
  });
}

export async function requestPasswordReset(email) {
  return request('/auth/password-reset/request', {
    body: { email: String(email || '').trim().toLowerCase() },
  });
}

export async function confirmPasswordReset({ resetToken, newPassword }) {
  return request('/auth/password-reset/confirm', {
    body: { reset_token: resetToken, new_password: newPassword },
  });
}

export async function endAuthSession(scope = 'local') {
  const token = base44.auth.getToken();
  try {
    if (token) {
      await request('/auth/logout', {
        token,
        body: { scope: scope === 'global' ? 'global' : 'local' },
      });
    }
  } finally {
    clearStoredSession();
  }
}
