import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

function escapeCsv(value: string | null | undefined): string {
  if (value == null) return '';
  const s = String(value);
  if (s.includes('"') || s.includes(',') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(req: NextRequest) {
  const campaignId = req.nextUrl.searchParams.get('campaign_id');

  let query = supabase
    .from('leads')
    .select('name, phone, address, website, status, created_at')
    .order('created_at', { ascending: true });

  if (campaignId) query = query.eq('campaign_id', campaignId);

  const { data: leads, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const header = ['Name', 'Phone', 'Address', 'Website', 'Status'].join(',');
  const rows = (leads ?? []).map((l) =>
    [l.name, l.phone, l.address, l.website, l.status].map(escapeCsv).join(',')
  );
  const csv = [header, ...rows].join('\r\n');

  const filename = campaignId ? `leads-${campaignId}.csv` : 'leads-all.csv';

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
