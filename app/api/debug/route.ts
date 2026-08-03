import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Try campaigns FIRST, then sent_log
  const { data: campaigns1 } = await supabase
    .from('campaigns').select('id').eq('status', 'active');

  const { data: logs } = await supabase
    .from('sent_log').select('sent_at').order('sent_at', { ascending: false }).limit(1);

  // Now campaigns again AFTER sent_log
  const { data: campaigns2 } = await supabase
    .from('campaigns').select('id').eq('status', 'active');

  return NextResponse.json({ campaigns1, logs, campaigns2 });
}
