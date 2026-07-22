import { base44 } from '@/api/base44Client';

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'https://se7en-fit-api.onrender.com/api'
).replace(/\/+$/, '');
const TOKEN_KEY = 'se7enfit_auth_token';
const REQUEST_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS || 15000);

function localDateKey() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function request(path, options = {}) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), options.timeoutMs || REQUEST_TIMEOUT_MS);
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const response = await fetch(`${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Date': localDateKey(),
        'X-Client-Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
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

export const engagementClient = {
  getOverview() {
    return request('/engagement/overview');
  },
  joinChallenge(challengeId) {
    return request(`/engagement/challenges/${encodeURIComponent(challengeId)}/join`, { method: 'POST' });
  },
  checkInChallenge(challengeId, date = localDateKey()) {
    return request(`/engagement/challenges/${encodeURIComponent(challengeId)}/check-in`, {
      method: 'POST',
      body: { date },
    });
  },
  async getLeaderboard(scope = 'global') {
    const query = new URLSearchParams({ scope });
    const result = await request(`/engagement/leaderboard?${query.toString()}`);
    if (scope !== 'global') return result;
    try {
      const prizes = await base44.entities.LeaderboardPrize.list('rank', 100);
      return {
        ...result,
        prizes: prizes
          .filter((prize) => !prize.gym_id && prize.active !== false && prize.status !== 'inactive')
          .sort((a, b) => Number(a.rank || 0) - Number(b.rank || 0))
          .slice(0, 3)
          .map((prize) => ({
            rank: Number(prize.rank || 1),
            title: prize.title,
            reward: prize.description || prize.reward,
            coins: Number(prize.coins || 0),
          })),
      };
    } catch {
      return result;
    }
  },
  async getAdminGyms() {
    const response = await request('/admin/gyms');
    return Array.isArray(response) ? response : (response?.items || []);
  },
};
