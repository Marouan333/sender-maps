export interface PlaceLead {
  name: string;
  phone: string | null;
  address: string;
  website: string | null;
}

// ── Geocode city to GPS coords (for Serper pagination) ────────────────────────

async function getGpsCoords(city: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1`,
      { headers: { 'User-Agent': 'sender-maps/1.0' } }
    );
    const json = await res.json();
    if (!json[0]) return null;
    const { lat, lon } = json[0];
    // Serper ll format: @lat,lon,zoom
    return `@${lat},${lon},14z`;
  } catch {
    return null;
  }
}

// ── Serper.dev ────────────────────────────────────────────────────────────────

async function serperMapsSearch(
  query: string,
  page = 1,
  ll?: string
): Promise<PlaceLead[]> {
  const body: Record<string, unknown> = { q: query, page };
  if (ll && page > 1) body.ll = ll;

  const res = await fetch('https://google.serper.dev/maps', {
    method: 'POST',
    headers: {
      'X-API-KEY': process.env.SERPER_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
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

async function serpapiMapsSearch(
  query: string,
  start = 0
): Promise<{ leads: PlaceLead[]; hasMore: boolean }> {
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

export async function fetchPlaces(city: string, businessType: string): Promise<PlaceLead[]> {
  const query = `${businessType} in ${city}`;

  if (process.env.SERPER_API_KEY) {
    const ll = await getGpsCoords(city);
    const all: PlaceLead[] = [];
    for (let page = 1; page <= 5; page++) {
      try {
        const results = await serperMapsSearch(query, page, ll ?? undefined);
        all.push(...results);
        if (results.length < 10) break;
      } catch {
        break; // stop on error, return what we have
      }
    }
    return all;
  }

  if (process.env.SERPAPI_KEY) {
    const all: PlaceLead[] = [];
    let start = 0;
    for (let i = 0; i < 5; i++) {
      const { leads, hasMore } = await serpapiMapsSearch(query, start);
      all.push(...leads);
      if (!hasMore) break;
      start += 20;
    }
    return all;
  }

  throw new Error('Set either SERPER_API_KEY or SERPAPI_KEY in environment variables.');
}
