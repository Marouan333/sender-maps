import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Step 1: same as cron — query sent_log first
  const { data: logs, error: logErr } = await supabase
    .from('sent_log')
    .select('sent_at')
    .order('sent_at', { ascending: false })
    .limit(1);

  // Step 2: then query campaigns
  const { data: campaigns, error: campErr } = await supabase
    .from('campaigns')
    .select('id, timezone')
    .eq('status', 'active');

  return NextResponse.json({
    logs,
    logErr,
    campaigns,
    campErr,
    envUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.slice(0, 30),
    envKey: process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 20),
  });
}
