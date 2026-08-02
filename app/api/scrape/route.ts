import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { fetchPlaces } from '@/lib/serper';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { campaign_id } = await req.json();
  if (!campaign_id) return NextResponse.json({ error: 'campaign_id required' }, { status: 400 });

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaign_id)
    .single();

  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

  let totalInserted = 0;
  const errors: string[] = [];

  for (const businessType of campaign.business_types as string[]) {
    try {
      const places = await fetchPlaces(campaign.city, businessType);
      if (places.length === 0) continue;

      // Filter out places with no phone, then check for existing phones
      const withPhone = places.filter((p) => p.phone);
      if (withPhone.length === 0) continue;

      const phones = withPhone.map((p) => p.phone as string);
      const { data: existing } = await supabase
        .from('leads')
        .select('phone')
        .in('phone', phones);

      const existingPhones = new Set((existing ?? []).map((r) => r.phone));
      const seenInBatch = new Set<string>();
      const newRows = withPhone
        .filter((p) => {
          const ph = p.phone as string;
          if (existingPhones.has(ph) || seenInBatch.has(ph)) return false;
          seenInBatch.add(ph);
          return true;
        })
        .map((p) => ({
          campaign_id,
          name: p.name,
          phone: p.phone,
          address: p.address,
          website: p.website,
          status: 'pending',
        }));

      if (newRows.length === 0) continue;

      const { error } = await supabase.from('leads').insert(newRows);
      if (error) errors.push(`${businessType}: ${error.message}`);
      else totalInserted += newRows.length;
    } catch (e) {
      errors.push(`${businessType}: ${(e as Error).message}`);
    }
  }

  return NextResponse.json({ inserted: totalInserted, errors });
}
