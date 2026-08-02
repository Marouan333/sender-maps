import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Missing Supabase env vars');
    _client = createClient(url, key, { auth: { persistSession: false } });
  }
  return _client;
}

// Proxy that preserves `this` binding on every method call
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabase();
    const value = (client as never)[prop];
    if (typeof value === 'function') return (value as Function).bind(client);
    return value;
  },
});
