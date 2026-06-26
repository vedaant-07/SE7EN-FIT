const STORAGE_PREFIX = 'se7enfit_';

const nowIso = () => new Date().toISOString();
const wait = (value) => Promise.resolve(value);

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

const makeEntity = (name, seed = []) => ({
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

const currentUser = () => {
  const raw = localStorage.getItem(`${STORAGE_PREFIX}user`);
  if (raw) return JSON.parse(raw);
  const user = {
    id: 'local-user',
    email: 'user@se7en.fit',
    full_name: 'SE7EN FIT User',
    role: 'user'
  };
  localStorage.setItem(`${STORAGE_PREFIX}user`, JSON.stringify(user));
  return user;
};

const seed = {
  UserProfile: [
    {
      id: 'profile-local-user',
      user_id: 'local-user',
      full_name: 'SE7EN FIT User',
      fitness_goal: 'Build muscle and stay consistent',
      level: 'beginner',
      points: 1240,
      created_date: nowIso()
    }
  ],
  GymOwner: [
    {
      id: 'owner-local-user',
      user_id: 'local-user',
      gym_name: 'SE7EN FIT Demo Gym',
      onboarding_complete: true,
      created_date: nowIso()
    }
  ],
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
    InvokeLLM: async ({ prompt } = {}) => ({
      response: 'SE7EN FIT local AI mode is active. Connect your own backend or AI API for production responses.',
      text: 'SE7EN FIT local AI mode is active. Connect your own backend or AI API for production responses.',
      prompt
    }),
    SendEmail: async () => ({ success: true }),
    UploadFile: async ({ file } = {}) => ({ url: file ? URL.createObjectURL(file) : '' }),
    GenerateImage: async () => ({ url: '' }),
    ExtractDataFromUploadedFile: async () => ({ data: null })
  }
};

export const base44 = {
  auth: {
    async isAuthenticated() {
      return localStorage.getItem(`${STORAGE_PREFIX}auth`) === 'true';
    },
    async me() {
      return currentUser();
    },
    async loginViaEmailPassword(email) {
      const user = { ...currentUser(), email: email || 'user@se7en.fit' };
      localStorage.setItem(`${STORAGE_PREFIX}user`, JSON.stringify(user));
      localStorage.setItem(`${STORAGE_PREFIX}auth`, 'true');
      return user;
    },
    loginWithProvider() {
      localStorage.setItem(`${STORAGE_PREFIX}auth`, 'true');
      return currentUser();
    },
    logout() {
      localStorage.removeItem(`${STORAGE_PREFIX}auth`);
    },
    redirectToLogin() {
      window.location.href = '/welcome';
    }
  },
  entities: entityProxy,
  integrations,
  functions: new Proxy({}, {
    get() {
      return async () => wait({ ok: true });
    }
  })
};
