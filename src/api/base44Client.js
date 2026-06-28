const STORAGE_PREFIX = 'se7enfit_';

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'https://se7en-fit-api.onrender.com/api'
).replace(/\/+$/, '');

const REQUEST_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS || 15000);
const TOKEN_KEY = `${STORAGE_PREFIX}auth_token`;
const USER_KEY = `${STORAGE_PREFIX}user`;
const LEGACY_AUTH_KEY = `${STORAGE_PREFIX}auth`;

const nowIso = () => new Date().toISOString();
const wait = (value) => Promise.resolve(value);

const getToken = () => localStorage.getItem(TOKEN_KEY);

const setToken = (token) => {
  if (!token) return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(LEGACY_AUTH_KEY, 'true');
};

const clearToken = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(LEGACY_AUTH_KEY);
};

export const normalizeRole = (role) => {
  const value = String(role || 'user')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  if (['owner', 'gym_owner', 'gymowner'].includes(value)) return 'gym_owner';
  if (['admin', 'super_admin', 'superadmin'].includes(value)) return 'super_admin';
  if (['nagarsevak', 'nagar_sevak', 'nagar_sewak'].includes(value)) return 'nagarsevak';

  return 'user';
};

const normalizeUser = (user = {}) => {
  const normalized = {
    ...user,
    role: normalizeRole(user.role),
    dbRole: user.dbRole || user.role,
  };

  normalized.full_name =
    normalized.full_name ||
    normalized.name ||
    normalized.owner_name ||
    normalized.email?.split('@')?.[0] ||
    'SE7EN FIT User';

  return normalized;
};

const cacheUser = (user) => {
  const normalized = normalizeUser(user);
  localStorage.setItem(USER_KEY, JSON.stringify(normalized));
  return normalized;
};

const readCachedUser = () => {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? normalizeUser(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
};

const clearUser = () => {
  localStorage.removeItem(USER_KEY);
};

const makeQueryString = (params = {}) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.set(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : '';
};

function makeTimeoutError() {
  const error = new Error('Server is taking too long to respond. Please try again in a few seconds.');
  error.isTimeout = true;
  error.isNetworkError = true;
  return error;
}

async function apiRequest(path, options = {}) {
  const {
    method = 'GET',
    body,
    auth = true,
    headers: extraHeaders = {},
    timeoutMs = REQUEST_TIMEOUT_MS,
  } = options;

  const headers = {
    'Content-Type': 'application/json',
    ...extraHeaders,
  };

  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller && timeoutMs > 0
    ? window.setTimeout(() => controller.abort(), timeoutMs)
    : null;

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller?.signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw makeTimeoutError();
    const networkError = new Error('Network error. Backend is not reachable.');
    networkError.isNetworkError = true;
    throw networkError;
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const data = isJson
    ? await response.json().catch(() => null)
    : await response.text().catch(() => null);

  if (!response.ok) {
    const message =
      (data && typeof data === 'object' && (data.message || data.error)) ||
      (typeof data === 'string' && data) ||
      `Request failed (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    error.body = data;
    throw error;
  }

  return data;
}

async function apiUpload(path, formData, options = {}) {
  const token = getToken();
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? window.setTimeout(() => controller.abort(), options.timeoutMs || 60000) : null;
  try {
    const response = await fetch(`${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
      signal: controller?.signal,
    });
    const isJson = response.headers.get('content-type')?.includes('application/json');
    const data = isJson ? await response.json().catch(() => null) : await response.text().catch(() => null);
    if (!response.ok) {
      const error = new Error((data && typeof data === 'object' && (data.message || data.error)) || 'Upload failed');
      error.status = response.status;
      throw error;
    }
    return data;
  } catch (error) {
    if (error?.name === 'AbortError') throw makeTimeoutError();
    throw error;
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }
}

const storeSession = (session = {}) => {
  const token = session.access_token || session.token;
  if (!token) throw new Error('No access token returned from server');

  setToken(token);

  if (session.user) {
    return cacheUser(session.user);
  }

  return readCachedUser();
};

const getStore = (name) => {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${name}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const setStore = (name, rows) => {
  localStorage.setItem(`${STORAGE_PREFIX}${name}`, JSON.stringify(rows));
  return rows;
};

const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const matches = (row, query = {}) => Object.entries(query).every(([key, value]) => row?.[key] === value);

const makeLocalEntity = (name, seed = []) => ({
  async list(sortBy = '-created_date', limit) {
    const existing = getStore(name);
    const rows = existing.length ? existing : setStore(name, seed.map((item) => ({ ...item })));
    const sorted = [...rows].sort((a, b) => {
      if (sortBy === '-created_date') return String(b.created_date || '').localeCompare(String(a.created_date || ''));
      if (sortBy === 'created_date') return String(a.created_date || '').localeCompare(String(b.created_date || ''));
      return 0;
    });
    return typeof limit === 'number' ? sorted.slice(0, limit) : sorted;
  },
  async filter(query = {}, sortBy = '-created_date', limit) {
    const rows = await this.list(sortBy);
    const filtered = rows.filter((row) => matches(row, query));
    return typeof limit === 'number' ? filtered.slice(0, limit) : filtered;
  },
  async get(id) {
    return getStore(name).find((row) => row.id === id) || null;
  },
  async create(data = {}) {
    const rows = getStore(name);
    const row = { id: makeId(), created_date: nowIso(), updated_date: nowIso(), ...data };
    setStore(name, [row, ...rows]);
    return row;
  },
  async update(id, data = {}) {
    const rows = getStore(name);
    let updated = null;
    const next = rows.map((row) => {
      if (row.id !== id) return row;
      updated = { ...row, ...data, updated_date: nowIso() };
      return updated;
    });
    setStore(name, next);
    return updated;
  },
  async delete(id) {
    setStore(name, getStore(name).filter((row) => row.id !== id));
    return true;
  }
});

const makeRemoteEntity = (name) => ({
  async list(sortBy = '-created_date', limit) {
    const query = makeQueryString({ sortBy, limit });
    const rows = await apiRequest(`/entities/${encodeURIComponent(name)}${query}`);
    return Array.isArray(rows) ? rows : [];
  },
  async filter(filter = {}, sortBy = '-created_date', limit) {
    const query = makeQueryString({ filter, sortBy, limit });
    const rows = await apiRequest(`/entities/${encodeURIComponent(name)}${query}`);
    return Array.isArray(rows) ? rows : [];
  },
  async get(id) {
    return apiRequest(`/entities/${encodeURIComponent(name)}/${encodeURIComponent(id)}`);
  },
  async create(data = {}) {
    return apiRequest(`/entities/${encodeURIComponent(name)}`, {
      method: 'POST',
      body: data,
    });
  },
  async update(id, data = {}) {
    return apiRequest(`/entities/${encodeURIComponent(name)}/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: data,
    });
  },
  async delete(id) {
    await apiRequest(`/entities/${encodeURIComponent(name)}/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    return true;
  }
});

const shouldUseLocalEntityFallback = (error) => {
  if (import.meta.env.VITE_USE_LOCAL_ENTITIES === 'true') return true;
  if (error?.isNetworkError) return true;
  if ([404, 501].includes(error?.status)) return true;
  return false;
};

const makeEntity = (name, seed = []) => {
  const local = makeLocalEntity(name, seed);
  const remote = makeRemoteEntity(name);

  const run = async (method, args) => {
    try {
      return await remote[method](...args);
    } catch (error) {
      if (shouldUseLocalEntityFallback(error)) {
        console.warn(`[SE7EN FIT] Falling back to local entity store for ${name}.${method}:`, error.message);
        return local[method](...args);
      }
      throw error;
    }
  };

  return {
    list: (...args) => run('list', args),
    filter: (...args) => run('filter', args),
    get: (...args) => run('get', args),
    create: (...args) => run('create', args),
    update: (...args) => run('update', args),
    delete: (...args) => run('delete', args),
  };
};

const seed = {
  UserProfile: [],
  GymOwner: [],
  WorkoutLog: [],
  NutritionLog: [],
  WaterLog: [],
  StepLog: [],
  SleepLog: [],
  WeightLog: [],
  BodyMeasurement: [],
  CardioLog: [],
  HabitLog: [],
  MoodLog: [],
  Challenge: [],
  Reward: [],
  GymMember: [],
  Attendance: [],
  Lead: [],
  Review: [],
  Referral: [],
  Announcement: []
};

const entityProxy = new Proxy({}, {
  get(target, prop) {
    if (!target[prop]) target[prop] = makeEntity(prop, seed[prop] || []);
    return target[prop];
  }
});

const integrations = {
  Core: {
    InvokeLLM: async ({ prompt, context } = {}) => {
      const response = await apiRequest('/ai/trainer', {
        method: 'POST',
        body: { message: prompt || '', context: context || {} },
      });
      return { response: response.reply || response.text || '', text: response.reply || response.text || '', message: response.message };
    },
    SendEmail: async () => ({ success: true }),
    UploadFile: async ({ file, purpose = 'community' } = {}) => {
      if (!file) return { url: '' };
      const form = new FormData();
      form.append('file', file);
      form.append('purpose', purpose);
      const response = await apiUpload('/uploads/media', form);
      const asset = response.asset || response.item || response;
      return { url: asset.public_url || response.public_url || '', asset };
    },
    GenerateImage: async () => ({ url: '' }),
    ExtractDataFromUploadedFile: async () => ({ data: null })
  }
};

const loadGoogleIdentityScript = () => new Promise((resolve, reject) => {
  if (window.google?.accounts?.id) {
    resolve();
    return;
  }

  const existing = document.querySelector('script[data-google-identity]');
  if (existing) {
    existing.addEventListener('load', resolve, { once: true });
    existing.addEventListener('error', reject, { once: true });
    return;
  }

  const script = document.createElement('script');
  script.src = 'https://accounts.google.com/gsi/client';
  script.async = true;
  script.defer = true;
  script.dataset.googleIdentity = 'true';
  script.onload = resolve;
  script.onerror = () => reject(new Error('Google login script failed to load'));
  document.head.appendChild(script);
});

const auth = {
  async isAuthenticated() {
    if (!getToken()) return false;

    try {
      await this.me();
      return true;
    } catch {
      clearToken();
      clearUser();
      return false;
    }
  },

  async me() {
    const response = await apiRequest('/auth/me');
    const user = response.user || response;
    return cacheUser(user);
  },

  async loginViaEmailPassword(email, password, role = 'user') {
    const session = await apiRequest('/auth/login', {
      method: 'POST',
      auth: false,
      body: {
        email: String(email || '').trim().toLowerCase(),
        password,
        role,
      },
    });

    if (session?.requires_otp) return session;
    return storeSession(session);
  },

  async register(payload = {}) {
    const session = await apiRequest('/auth/register', {
      method: 'POST',
      auth: false,
      body: {
        ...payload,
        email: String(payload.email || '').trim().toLowerCase(),
        role: payload.role || 'user',
        phone: payload.phone || payload.mobile || undefined,
        mobile: payload.mobile || payload.phone || undefined,
      },
    });

    if (session?.token || session?.access_token) {
      const user = storeSession(session);
      return { access_token: session.access_token || session.token, user };
    }

    return session;
  },

  async verifyOtp({ email, otpCode }) {
    const session = await apiRequest('/auth/verify-otp', {
      method: 'POST',
      auth: false,
      body: {
        email: String(email || '').trim().toLowerCase(),
        otp_code: otpCode,
        otpCode,
      },
    });

    return {
      access_token: session.access_token || session.token,
      user: storeSession(session),
    };
  },

  async resendOtp(email) {
    return apiRequest('/auth/resend-otp', {
      method: 'POST',
      auth: false,
      body: { email: String(email || '').trim().toLowerCase() },
    });
  },

  async loginWithProvider(provider = 'google', role = 'user') {
    if (provider !== 'google') {
      throw new Error(`${provider} login is not supported`);
    }

    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new Error('Google login is not configured. Add VITE_GOOGLE_CLIENT_ID.');
    }

    await loadGoogleIdentityScript();

    return new Promise((resolve, reject) => {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response) => {
          try {
            if (!response.credential) {
              reject(new Error('Google did not return an ID token'));
              return;
            }

            const session = await apiRequest('/auth/google', {
              method: 'POST',
              auth: false,
              body: { idToken: response.credential, role },
            });

            resolve(storeSession(session));
          } catch (error) {
            reject(error);
          }
        },
      });

      window.google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed?.() || notification.isSkippedMoment?.()) {
          reject(new Error('Google login was cancelled or blocked'));
        }
      });
    });
  },

  setToken,
  getToken,
  getCachedUser() {
    return readCachedUser();
  },

  logout() {
    clearToken();
    clearUser();
  },

  redirectToLogin() {
    window.location.href = '/welcome';
  }
};

const gymOwner = {
  async getMine() {
    return apiRequest('/gym-owners/me');
  },

  async upsert(data = {}) {
    return apiRequest('/gym-owners/me', {
      method: 'PUT',
      body: data,
    });
  },

  async completeOnboarding(data = {}) {
    return apiRequest('/gym-owners/onboarding', {
      method: 'POST',
      body: data,
    });
  }
};

export const base44 = {
  auth,
  gymOwner,
  entities: entityProxy,
  integrations,
  functions: new Proxy({}, {
    get() {
      return async () => wait({ ok: true });
    }
  })
};
