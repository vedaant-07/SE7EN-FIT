import { base44 } from '@/api/base44Client';

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'https://se7en-fit-api.onrender.com/api'
).replace(/\/+$/, '');
const DEFAULT_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS || 15000);

function messageFromBody(body, fallback) {
  if (body && typeof body === 'object') return body.error || body.message || fallback;
  if (typeof body === 'string' && body.trim()) return body.trim();
  return fallback;
}

async function request(path, { method = 'GET', body, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const token = base44.auth.getToken?.();
  if (!token) {
    const error = new Error('Your session expired. Please log in again.');
    error.status = 401;
    throw error;
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API_BASE_URL}/gym-owner/platform${path.startsWith('/') ? path : `/${path}`}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Client-Date': new Date().toLocaleDateString('en-CA'),
        'X-Client-Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    const isJson = response.headers.get('content-type')?.includes('application/json');
    const payload = isJson ? await response.json().catch(() => null) : await response.text().catch(() => null);
    if (!response.ok) {
      const error = new Error(messageFromBody(payload, `Request failed (${response.status})`));
      error.status = response.status;
      error.code = payload?.code;
      error.body = payload;
      throw error;
    }
    return payload;
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error('Server is taking too long to respond. Please try again.');
      timeoutError.isTimeout = true;
      throw timeoutError;
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

export const platformClient = {
  getWorkspace: () => request('/workspace', { timeoutMs: 25000 }),
  updateProfile: (data) => request('/profile', { method: 'PATCH', body: data }),
  addManualMember: (data) => request('/manual-members', { method: 'POST', body: data }),
  updateMember: (memberType, id, data) => request(`/members/${encodeURIComponent(memberType)}/${encodeURIComponent(id)}`, { method: 'PATCH', body: data }),
  checkIn: (data) => request('/attendance/check-in', { method: 'POST', body: data }),
  checkOut: (id) => request(`/attendance/${encodeURIComponent(id)}/check-out`, { method: 'PATCH' }),
  addEquipment: (data) => request('/equipment', { method: 'POST', body: data }),
  updateEquipment: (id, data) => request(`/equipment/${encodeURIComponent(id)}`, { method: 'PATCH', body: data }),
  deleteEquipment: (id) => request(`/equipment/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  addLead: (data) => request('/leads', { method: 'POST', body: data }),
  updateLead: (id, data) => request(`/leads/${encodeURIComponent(id)}`, { method: 'PATCH', body: data }),
  addPayment: (data) => request('/payments', { method: 'POST', body: data }),
  addAnnouncement: (data) => request('/announcements', { method: 'POST', body: data }),
  updateAnnouncement: (id, data) => request(`/announcements/${encodeURIComponent(id)}`, { method: 'PATCH', body: data }),
  getCommissions: () => request('/commissions'),
};
