import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Server-only client using the service role key (bypasses RLS)
export const supabase = createClient(url, key, {
  auth: { persistSession: false },
});
