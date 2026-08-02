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

      const rows = places.map((p) => ({
        campaign_id,
        name: p.name,
        phone: p.phone,
        address: p.address,
        website: p.website,
        // Businesses that already have a website are skipped from sending
        status: p.website ? 'skipped' : 'pending',
      }));

      // Upsert: if the same place_id was already scraped, update it
      const { error } = await supabase.from('leads').upsert(rows, {
        onConflict: 'phone',
        ignoreDuplicates: true,
      });

      if (error) errors.push(`${businessType}: ${error.message}`);
      else totalInserted += rows.length;
    } catch (e) {
      errors.push(`${businessType}: ${(e as Error).message}`);
    }
  }

  return NextResponse.json({ inserted: totalInserted, errors });
}
