# Sender Maps

WhatsApp outreach tool: picks city + business types, scrapes Google Maps for businesses
without a website, and drip-sends WhatsApp messages at one per 3 minutes.

---

## Setup (30 minutes)

### 1. Supabase

1. Create a project at supabase.com.
2. Open the SQL editor and paste the contents of `supabase/schema.sql`. Run it.
3. Copy **Project URL** and **service_role secret** from Settings > API.

### 2. WhatsApp service on Railway

1. Push the `wa-service/` folder to its own GitHub repo (or a subdirectory).
2. Create a new Railway project, point it at that repo.
3. Set these environment variables in Railway:
   - `WA_SERVICE_SECRET` — any long random string (same value on Vercel)
   - `PORT` — Railway sets this automatically; leave it unset or `3001`
4. Deploy. Railway builds and runs `node index.js`.
5. After deploy, visit `https://your-app.up.railway.app/qr?` (add `X-Secret` header or
   proxy via the Vercel `/api/whatsapp/qr` page) and scan the QR code with WhatsApp.
6. The session is saved to `./wa-session` via LocalAuth and survives restarts.

> Railway does NOT persist the filesystem by default. To keep the session alive across
> deploys, attach a Railway Volume at `/app/wa-session`.

### 3. Vercel (Next.js app)

1. Push this repo to GitHub.
2. Import it in vercel.com.
3. Add these environment variables:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
WA_SERVICE_URL=https://your-app.up.railway.app
WA_SERVICE_SECRET=same-secret-as-railway
MESSAGE_TEMPLATE=Hi {{name}}, I noticed your business doesn't have a website yet...
SEND_START_HOUR=8
SEND_END_HOUR=18
CRON_SECRET=another-long-random-string
```

4. Deploy. Vercel Cron fires `/api/cron/send` every minute automatically.

### 4. Done

- Open the Vercel URL. Click **+ New campaign**.
- Enter a city, business types (e.g. `restaurant`, `salon`), timezone.
- Scraping starts immediately in the background (takes 2-5 min per business type).
- Messages begin sending once leads appear and the clock is inside your window.
- Watch progress on the dashboard — stats update on page refresh.

---

## Architecture

```
Browser
  └─ Next.js on Vercel
        ├─ /api/campaigns      CRUD campaigns
        ├─ /api/scrape          Playwright + @sparticuz/chromium → Google Maps
        ├─ /api/cron/send       Vercel Cron (every 1 min) → Railway WA service
        └─ /api/whatsapp/qr    Proxies QR from Railway

Railway
  └─ wa-service (Node + whatsapp-web.js)
        ├─ GET  /qr            Returns base64 QR image or { ready: true }
        ├─ POST /send          Sends a WhatsApp message
        └─ GET  /status        Connection status

Supabase (PostgreSQL)
  ├─ campaigns
  ├─ leads        (unique index on phone — no duplicates)
  └─ sent_log
```

---

## Sending rate

One message every 3 minutes (+/- 30 seconds random jitter). The cron runs every minute
but skips if the elapsed time since the last send is less than the required gap.

## Deduplication

The `leads.phone` column has a `UNIQUE` index. A phone number is never inserted twice,
even across different campaigns. The cron also checks `sent_log` before each send.

## Timezone

Each campaign stores its own timezone. The cron checks whether the current time in that
timezone is within `SEND_START_HOUR`–`SEND_END_HOUR` before sending.
