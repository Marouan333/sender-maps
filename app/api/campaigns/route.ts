import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const { data: campaigns, error } = await supabase
    .from('campaigns')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!campaigns?.length) return NextResponse.json([]);

  const ids = campaigns.map((c) => c.id);
  const { data: leads } = await supabase
    .from('leads')
    .select('campaign_id, status')
    .in('campaign_id', ids);

  const stats: Record<string, { total: number; sent: number; pending: number; failed: number }> =
    {};
  for (const lead of leads ?? []) {
    if (!stats[lead.campaign_id])
      stats[lead.campaign_id] = { total: 0, sent: 0, pending: 0, failed: 0 };
    stats[lead.campaign_id].total++;
    (stats[lead.campaign_id] as Record<string, number>)[lead.status]++;
  }

  return NextResponse.json(
    campaigns.map((c) => ({
      ...c,
      ...(stats[c.id] ?? { total: 0, sent: 0, pending: 0, failed: 0 }),
    }))
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { city, business_types, timezone } = body;

  if (!city || !Array.isArray(business_types) || business_types.length === 0) {
    return NextResponse.json({ error: 'city and business_types are required' }, { status: 400 });
  }

  const { data: campaign, error } = await supabase
    .from('campaigns')
    .insert({ city, business_types, timezone: timezone ?? 'UTC', status: 'active' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Kick off scrape in the background — fire and forget so the response is instant
  const host = req.headers.get('host') ?? 'localhost:3000';
  const proto = host.startsWith('localhost') ? 'http' : 'https';
  fetch(`${proto}://${host}/api/scrape`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ campaign_id: campaign.id }),
  }).catch(() => null);

  return NextResponse.json(campaign, { status: 201 });
}
