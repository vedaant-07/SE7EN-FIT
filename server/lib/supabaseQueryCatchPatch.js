import { createClient } from '@supabase/supabase-js';

// Supabase PostgREST builders are Promise-like but do not expose `.catch()` on some versions.
// Older SE7EN FIT backend code used `.catch()` on query builders in auth/audit paths.
// This compatibility patch makes those paths safe without changing route behavior.
export function patchSupabaseQueryCatch() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) return;
  const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const sample = client.from('__se7enfit_patch_probe__').select('*');
  let target = Object.getPrototypeOf(sample);
  for (let i = 0; i < 10 && target; i += 1) {
    if (typeof target.then === 'function' || typeof sample.then === 'function') {
      if (typeof target.catch !== 'function') {
        Object.defineProperty(target, 'catch', {
          configurable: true,
          writable: true,
          value(onRejected) {
            return Promise.resolve(this).catch(onRejected);
          },
        });
      }
      return;
    }
    target = Object.getPrototypeOf(target);
  }
}

patchSupabaseQueryCatch();
