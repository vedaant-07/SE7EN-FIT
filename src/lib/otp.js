import { base44 } from '@/api/base44Client';
import { cacheRouteUser } from '@/lib/routing';

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'https://se7en-fit-api.onrender.com/api'
).replace(/\/+$/, '');

async function post(path, body) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.message || data?.error || `Request failed (${response.status})`);
    error.status = response.status;
    error.body = data;
    throw error;
  }
  return data;
}

export async function verifyOtpWithPurpose({ email, otpCode, purpose = 'login' }) {
  const session = await post('/auth/verify-otp', { email, otp_code: otpCode, otpCode, purpose });
  const token = session.access_token || session.token;
  if (token) base44.auth.setToken(token);
  const user = cacheRouteUser(session.user || base44.auth.getCachedUser?.() || {});
  return { ...session, user };
}

export async function resendOtpWithPurpose(email, purpose = 'login') {
  return post('/auth/resend-otp', { email, purpose });
}
