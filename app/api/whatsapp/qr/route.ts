import { NextResponse } from 'next/server';

const WA_URL = process.env.WA_SERVICE_URL!;
const WA_SECRET = process.env.WA_SERVICE_SECRET!;

export async function GET() {
  try {
    const res = await fetch(`${WA_URL}/qr`, {
      headers: { 'X-Secret': WA_SECRET },
      cache: 'no-store',
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'WA service error' }, { status: 502 });
    }

    const data = await res.json();

    if (data.ready) {
      return NextResponse.json({ ready: true, number: data.number });
    }

    // Return HTML page that shows the QR and auto-refreshes every 5s
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>WhatsApp QR</title>
  <style>
    body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center;
           justify-content: center; min-height: 100vh; margin: 0; background: #f0f5f0; }
    img { border: 4px solid #25d366; border-radius: 12px; width: 260px; height: 260px; }
    h2 { color: #128c7e; margin-bottom: 16px; }
    p { color: #555; margin-top: 12px; font-size: 14px; }
  </style>
  <meta http-equiv="refresh" content="5" />
</head>
<body>
  <h2>Scan with WhatsApp</h2>
  ${data.qr ? `<img src="${data.qr}" alt="QR code" />` : '<p>Waiting for QR code...</p>'}
  <p>Page refreshes every 5 seconds</p>
</body>
</html>`;

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html' },
    });
  } catch {
    return NextResponse.json({ error: 'Could not reach WA service' }, { status: 502 });
  }
}
