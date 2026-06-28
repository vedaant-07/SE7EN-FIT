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
  let proto = sample;
  for (let i = 0; i < 8 && proto; i += 1) {
    if (typeof proto.then === 'function') {
      if (typeof proto.catch !== 'function') {
        Object.defineProperty(proto, 'catch', {
          configurable: true,
          writable: true,
          value(onRejected) {
            return Promise.resolve(this).catch(onRejected);
          },
        });
      }
      return;
    }
    proto = Object.getPrototypeOf(proto);
  }
}

patchSupabaseQueryCatch();
