import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const WA_URL = process.env.WA_SERVICE_URL!;
const WA_SECRET = process.env.WA_SERVICE_SECRET!;
const MESSAGE_TEMPLATE =
  process.env.MESSAGE_TEMPLATE ??
  "Bonjour {{name}},\n\nJ'ai pris l'initiative de concevoir un site web premium spécialement pour votre entreprise.\n\nJe peux vous envoyer gratuitement un lien de prévisualisation, sans aucun engagement. S'il vous plaît, vous pourrez l'acquérir. Sinon, vous n'avez rien à payer.\n\nSouhaitez-vous recevoir le lien de prévisualisation ?";
const SEND_START_HOUR = parseInt(process.env.SEND_START_HOUR ?? '8', 10);
const SEND_END_HOUR = parseInt(process.env.SEND_END_HOUR ?? '18', 10);
const CRON_SECRET = process.env.CRON_SECRET;

// Min gap between sends: 3 min ± 30s = 150–210 s
const MIN_GAP_MS = (3 * 60 - 30) * 1000;
const JITTER_MS = 60_000;

function isWithinSendWindow(timezone: string): boolean {
  const now = new Date();
  const localHour = parseInt(
    new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: timezone }).format(
      now
    )
  );
  return localHour >= SEND_START_HOUR && localHour < SEND_END_HOUR;
}

export async function GET(req: NextRequest) {
  // Protect the cron endpoint
  if (CRON_SECRET) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  // Find the most-recently sent log entry to enforce global rate limit
  const { data: lastLog } = await supabase
    .from('sent_log')
    .select('sent_at')
    .order('sent_at', { ascending: false })
    .limit(1)
    .single();

  if (lastLog) {
    const elapsed = Date.now() - new Date(lastLog.sent_at).getTime();
    const required = MIN_GAP_MS + Math.random() * JITTER_MS;
    if (elapsed < required) {
      return NextResponse.json({ skipped: 'rate_limit', elapsed, required });
    }
  }

  // Step 1: get all active campaign IDs and their timezones
  const { data: activeCampaigns } = await supabase
    .from('campaigns')
    .select('id, timezone')
    .eq('status', 'active');

  if (!activeCampaigns?.length) return NextResponse.json({ skipped: 'no_active_campaigns' });

  const activeCampaignIds = activeCampaigns.map((c) => c.id);

  // Step 2: oldest pending lead from those campaigns
  const { data: lead } = await supabase
    .from('leads')
    .select('id, name, phone, campaign_id')
    .eq('status', 'pending')
    .in('campaign_id', activeCampaignIds)
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  if (!lead) return NextResponse.json({ skipped: 'no_pending_leads' });

  const campaign = activeCampaigns.find((c) => c.id === lead.campaign_id);
  const tz = campaign?.timezone ?? 'UTC';
  if (!isWithinSendWindow(tz)) {
    return NextResponse.json({ skipped: 'outside_window', timezone: tz });
  }

  // Double-check: never send to the same phone twice
  const { count } = await supabase
    .from('sent_log')
    .select('id', { count: 'exact', head: true })
    .eq('lead_id', lead.id);

  if ((count ?? 0) > 0) {
    await supabase.from('leads').update({ status: 'sent' }).eq('id', lead.id);
    return NextResponse.json({ skipped: 'already_sent', lead_id: lead.id });
  }

  const message = MESSAGE_TEMPLATE.replace('{{name}}', lead.name);

  try {
    const res = await fetch(`${WA_URL}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Secret': WA_SECRET },
      body: JSON.stringify({ phone: lead.phone, message }),
    });

    const json = await res.json();

    if (!res.ok || !json.success) {
      await supabase.from('leads').update({ status: 'failed' }).eq('id', lead.id);
      return NextResponse.json({ error: 'WA send failed', detail: json }, { status: 502 });
    }

    // Log and mark as sent
    await Promise.all([
      supabase.from('sent_log').insert({ lead_id: lead.id }),
      supabase.from('leads').update({ status: 'sent' }).eq('id', lead.id),
    ]);

    return NextResponse.json({ sent: true, lead_id: lead.id, phone: lead.phone });
  } catch (e) {
    await supabase.from('leads').update({ status: 'failed' }).eq('id', lead.id);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
