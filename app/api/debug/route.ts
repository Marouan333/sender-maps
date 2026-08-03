import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const env = {
    hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    keyPrefix: process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 20),
  };

  const { data, error } = await supabase
    .from('campaigns')
    .select('id, status, timezone')
    .eq('status', 'active');

  return NextResponse.json({ env, data, error });
}
