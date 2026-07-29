const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'https://se7en-fit-api.onrender.com/api'
).replace(/\/+$/, '');
const TOKEN_KEY = 'se7enfit_auth_token';
const REQUEST_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS || 15000);

async function request(path, options = {}) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), options.timeoutMs || REQUEST_TIMEOUT_MS);
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const response = await fetch(`${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error(data?.error || data?.message || 'Something went wrong. Please try again.');
      error.status = response.status;
      error.body = data;
      throw error;
    }
    return data?.item ?? data;
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error('The server is taking too long. Please try again.');
      timeoutError.isNetworkError = true;
      throw timeoutError;
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

export const gymBattleClient = {
  getOverview() {
    return request('/gym-battles/overview');
  },
  createBattle(payload) {
    return request('/gym-battles', { method: 'POST', body: payload });
  },
  respond(battleId, response) {
    return request(`/gym-battles/${encodeURIComponent(battleId)}/respond`, {
      method: 'POST',
      body: { response },
    });
  },
  refresh(battleId) {
    return request(`/gym-battles/${encodeURIComponent(battleId)}/refresh`, { method: 'POST' });
  },
};
