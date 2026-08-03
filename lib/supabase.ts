import { createClient } from '@supabase/supabase-js';

export function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false } });
}

// Named export used across the codebase — creates a fresh client each time
// a property is accessed so no state bleeds between sequential queries.
export const supabase = new Proxy(
  {} as ReturnType<typeof getSupabase>,
  {
    get(_target, prop) {
      const client = getSupabase();
      const value = (client as never)[prop];
      if (typeof value === 'function') return (value as Function).bind(client);
      return value;
    },
  }
);
