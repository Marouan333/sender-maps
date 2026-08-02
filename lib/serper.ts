export interface PlaceLead {
  name: string;
  phone: string | null;
  address: string;
  website: string | null;
}

// ── Serper.dev ────────────────────────────────────────────────────────────────

async function serperMapsSearch(query: string, page = 1): Promise<PlaceLead[]> {
  const res = await fetch('https://google.serper.dev/maps', {
    method: 'POST',
    headers: {
      'X-API-KEY': process.env.SERPER_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ q: query, page }),
  });

  if (!res.ok) throw new Error(`Serper error ${res.status}: ${await res.text()}`);

  const json = await res.json();
  const places: PlaceLead[] = [];

  for (const p of json.places ?? []) {
    places.push({
      name: p.title ?? '',
      phone: p.phoneNumber ? p.phoneNumber.replace(/\D/g, '') : null,
      address: p.address ?? '',
      website: p.website ?? null,
    });
  }

  return places;
}

// ── SerpAPI ───────────────────────────────────────────────────────────────────

async function serpapiMapsSearch(query: string, start = 0): Promise<{
  leads: PlaceLead[];
  hasMore: boolean;
}> {
  const params = new URLSearchParams({
    engine: 'google_maps',
    q: query,
    type: 'search',
    start: String(start),
    api_key: process.env.SERPAPI_KEY!,
  });

  const res = await fetch(`https://serpapi.com/search.json?${params}`);
  if (!res.ok) throw new Error(`SerpAPI error ${res.status}: ${await res.text()}`);

  const json = await res.json();
  const leads: PlaceLead[] = [];

  for (const p of json.local_results ?? []) {
    leads.push({
      name: p.title ?? '',
      phone: p.phone ? p.phone.replace(/\D/g, '') : null,
      address: p.address ?? '',
      website: p.website ?? null,
    });
  }

  return { leads, hasMore: !!json.serpapi_pagination?.next };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetch all map results for a business type + city.
 * Automatically picks the configured provider:
 *   SERPER_API_KEY  → Serper.dev  (up to 3 pages × ~20 results = ~60)
 *   SERPAPI_KEY     → SerpAPI     (paginated until no more results or 60 cap)
 */
export async function fetchPlaces(city: string, businessType: string): Promise<PlaceLead[]> {
  const query = `${businessType} in ${city}`;

  if (process.env.SERPER_API_KEY) {
    // Serper maps pagination requires GPS coords for page > 1 — single page only
    return await serperMapsSearch(query, 1);
  }

  if (process.env.SERPAPI_KEY) {
    const all: PlaceLead[] = [];
    let start = 0;
    for (let i = 0; i < 3; i++) {
      const { leads, hasMore } = await serpapiMapsSearch(query, start);
      all.push(...leads);
      if (!hasMore) break;
      start += 20;
    }
    return all;
  }

  throw new Error('Set either SERPER_API_KEY or SERPAPI_KEY in environment variables.');
}
