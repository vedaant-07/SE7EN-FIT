import { base44 } from '@/api/base44Client';
import { getRefreshToken, refreshAuthSession } from '@/lib/authSessionSecurity';

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'https://se7en-fit-api.onrender.com/api'
).replace(/\/+$/, '');
const DEFAULT_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS || 15000);

function messageFromBody(body, fallback) {
  if (body && typeof body === 'object') return body.error || body.message || fallback;
  if (typeof body === 'string' && body.trim()) return body.trim();
  return fallback;
}

function queryString(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
  });
  const text = query.toString();
  return text ? `?${text}` : '';
}

async function rawRequest(path, { method = 'GET', body, timeoutMs = DEFAULT_TIMEOUT_MS, retryAuth = true, responseType = 'json' } = {}) {
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
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        'X-Client-Date': new Date().toLocaleDateString('en-CA'),
        'X-Client-Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });

    if (response.status === 401 && retryAuth && getRefreshToken()) {
      await refreshAuthSession();
      return rawRequest(path, { method, body, timeoutMs, retryAuth: false, responseType });
    }

    if (responseType === 'blob' && response.ok) return response.blob();
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

const request = (path, options) => rawRequest(path, options);

export const platformClient = {
  getWorkspace: () => request('/workspace', { timeoutMs: 30000 }),
  getCollection: (resource, params = {}) => request(`/collections/${encodeURIComponent(resource)}${queryString(params)}`, { timeoutMs: 25000 }),
  updateProfile: (data) => request('/profile', { method: 'PATCH', body: data }),

  addManualMember: (data) => request('/manual-members', { method: 'POST', body: data }),
  updateManualMember: (id, data) => request(`/manual-members/${encodeURIComponent(id)}`, { method: 'PATCH', body: data }),
  archiveManualMember: (id) => request(`/manual-members/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  updateMember: (memberType, id, data) => request(`/members/${encodeURIComponent(memberType)}/${encodeURIComponent(id)}`, { method: 'PATCH', body: data }),

  checkIn: (data) => request('/attendance/check-in', { method: 'POST', body: data }),
  checkOut: (id) => request(`/attendance/${encodeURIComponent(id)}/check-out`, { method: 'PATCH' }),
  updateAttendance: (id, data) => request(`/attendance/${encodeURIComponent(id)}`, { method: 'PATCH', body: data }),
  deleteAttendance: (id) => request(`/attendance/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  addEquipment: (data) => request('/equipment', { method: 'POST', body: data }),
  updateEquipment: (id, data) => request(`/equipment/${encodeURIComponent(id)}`, { method: 'PATCH', body: data }),
  deleteEquipment: (id) => request(`/equipment/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  addLead: (data) => request('/leads', { method: 'POST', body: data }),
  updateLead: (id, data) => request(`/leads/${encodeURIComponent(id)}`, { method: 'PATCH', body: data }),
  deleteLead: (id) => request(`/leads/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  addPayment: (data) => request('/payments', { method: 'POST', body: data }),
  updatePayment: (id, data) => request(`/payments/${encodeURIComponent(id)}`, { method: 'PATCH', body: data }),

  addAnnouncement: (data) => request('/announcements', { method: 'POST', body: data }),
  updateAnnouncement: (id, data) => request(`/announcements/${encodeURIComponent(id)}`, { method: 'PATCH', body: data }),
  deleteAnnouncement: (id) => request(`/announcements/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  addPlan: (data) => request('/plans', { method: 'POST', body: data }),
  updatePlan: (id, data) => request(`/plans/${encodeURIComponent(id)}`, { method: 'PATCH', body: data }),
  archivePlan: (id) => request(`/plans/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  listStaffInvitations: () => request('/staff/invitations'),
  inviteStaff: (data) => request('/staff/invitations', { method: 'POST', body: data }),
  revokeStaffInvitation: (id) => request(`/staff/invitations/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  acceptStaffInvitation: (token) => request('/staff/invitations/accept', { method: 'POST', body: { token } }),
  updateStaff: (id, data) => request(`/staff/${encodeURIComponent(id)}`, { method: 'PATCH', body: data }),
  removeStaff: (id) => request(`/staff/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  getCommissions: () => request('/commissions'),
  exportCsv: (resource, params = {}) => rawRequest(`/export/${encodeURIComponent(resource)}${queryString(params)}`, { responseType: 'blob', timeoutMs: 60000 }),
};