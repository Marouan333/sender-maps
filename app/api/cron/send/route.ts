import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const WA_URL = process.env.WA_SERVICE_URL!;
const WA_SECRET = process.env.WA_SERVICE_SECRET!;
const MESSAGE_TEMPLATE =
  process.env.MESSAGE_TEMPLATE ??
  "Bonjour {{name}},\n\nJ'ai pris l'initiative de concevoir un site web premium spécialement pour votre entreprise.\n\nJe peux vous envoyer gratuitement un lien de prévisualisation, sans aucun engagement. S'il vous plaît, vous pourrez l'acquérir. Sinon, vous n'avez rien à payer.\n\nSouhaitez-vous recevoir le lien de prévisualisation ?";
const SEND_START_HOUR = parseInt(process.env.SEND_START_HOUR ?? '8', 10);
const SEND_END_HOUR = parseInt(process.env.SEND_END_HOUR ?? '18', 10);
const CRON_SECRET = process.env.CRON_SECRET;

const MIN_GAP_MS = (3 * 60 - 30) * 1000;
const JITTER_MS = 60_000;

function sbFetch(path: string, init?: RequestInit) {
  return fetch(`${SB_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(init?.headers ?? {}),
    },
  });
}

function isWithinSendWindow(timezone: string): boolean {
  const now = new Date();
  const localHour = parseInt(
    new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: timezone }).format(now)
  );
  return localHour >= SEND_START_HOUR && localHour < SEND_END_HOUR;
}

export async function GET(req: NextRequest) {
  if (CRON_SECRET) {
    const header = req.headers.get('authorization');
    const query = req.nextUrl.searchParams.get('secret');
    if (header !== `Bearer ${CRON_SECRET}` && query !== CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  // Rate limit: check last sent log
  const logRes = await sbFetch('sent_log?select=sent_at&order=sent_at.desc&limit=1');
  const logs: { sent_at: string }[] = await logRes.json();
  const lastLog = logs?.[0] ?? null;
  if (lastLog) {
    const elapsed = Date.now() - new Date(lastLog.sent_at).getTime();
    const required = MIN_GAP_MS + Math.random() * JITTER_MS;
    if (elapsed < required) {
      return NextResponse.json({ skipped: 'rate_limit', elapsed, required });
    }
  }

  // Get active campaigns
  const campRes = await sbFetch('campaigns?select=id,timezone&status=eq.active');
  const activeCampaigns: { id: string; timezone: string }[] = await campRes.json();
  if (!activeCampaigns?.length) return NextResponse.json({ skipped: 'no_active_campaigns' });

  const ids = activeCampaigns.map((c) => `"${c.id}"`).join(',');

  // Oldest pending lead in those campaigns
  const leadRes = await sbFetch(
    `leads?select=id,name,phone,campaign_id&status=eq.pending&campaign_id=in.(${ids})&order=created_at.asc&limit=1`
  );
  const leadArr: { id: string; name: string; phone: string; campaign_id: string }[] =
    await leadRes.json();
  const lead = leadArr?.[0] ?? null;
  if (!lead) return NextResponse.json({ skipped: 'no_pending_leads' });

  const campaign = activeCampaigns.find((c) => c.id === lead.campaign_id);
  const tz = campaign?.timezone ?? 'UTC';
  if (!isWithinSendWindow(tz)) {
    return NextResponse.json({ skipped: 'outside_window', timezone: tz });
  }

  // Skip if already sent
  const dupRes = await sbFetch(
    `sent_log?select=id&lead_id=eq.${lead.id}`,
    { headers: { Prefer: 'count=exact' } }
  );
  const dupData = await dupRes.json();
  if (dupData?.length > 0) {
    await sbFetch(`leads?id=eq.${lead.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'sent' }),
      headers: { Prefer: 'return=minimal' },
    });
    return NextResponse.json({ skipped: 'already_sent', lead_id: lead.id });
  }

  const message = MESSAGE_TEMPLATE.replace('{{name}}', lead.name);

  try {
    const waRes = await fetch(`${WA_URL}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Secret': WA_SECRET },
      body: JSON.stringify({ phone: lead.phone, message }),
    });
    const waJson = await waRes.json();

    if (!waRes.ok || !waJson.success) {
      await sbFetch(`leads?id=eq.${lead.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'failed' }),
        headers: { Prefer: 'return=minimal' },
      });
      return NextResponse.json({ error: 'WA send failed', detail: waJson }, { status: 502 });
    }

    await Promise.all([
      sbFetch('sent_log', { method: 'POST', body: JSON.stringify({ lead_id: lead.id }) }),
      sbFetch(`leads?id=eq.${lead.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'sent' }),
        headers: { Prefer: 'return=minimal' },
      }),
    ]);

    return NextResponse.json({ sent: true, lead_id: lead.id, phone: lead.phone });
  } catch (e) {
    await sbFetch(`leads?id=eq.${lead.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'failed' }),
      headers: { Prefer: 'return=minimal' },
    });
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
