const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const express = require('express');

const PORT = process.env.PORT ?? 3001;
const SECRET = process.env.WA_SERVICE_SECRET ?? '';

const app = express();
app.use(express.json());

// ── State ────────────────────────────────────────────────────────────────────
let currentQrDataUrl = null;
let isReady = false;
let connectedNumber = null;

// ── Auth middleware ───────────────────────────────────────────────────────────
function checkSecret(req, res, next) {
  if (SECRET && req.headers['x-secret'] !== SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ── WhatsApp client ───────────────────────────────────────────────────────────
const client = new Client({
  authStrategy: new LocalAuth({ dataPath: './wa-session' }),
  puppeteer: {
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
    // Railway's Nixpacks image ships Chromium at this path.
    // If it differs on your host, override with the CHROMIUM_PATH env var.
    executablePath: process.env.CHROMIUM_PATH ?? undefined,
  },
});

client.on('qr', async (qr) => {
  isReady = false;
  currentQrDataUrl = await qrcode.toDataURL(qr);
  console.log('[WA] QR code ready — visit /qr to scan');
});

client.on('ready', () => {
  isReady = true;
  currentQrDataUrl = null;
  connectedNumber = client.info?.wid?.user ?? null;
  console.log(`[WA] Connected as ${connectedNumber}`);
});

client.on('disconnected', (reason) => {
  isReady = false;
  connectedNumber = null;
  console.warn('[WA] Disconnected:', reason);
  // Attempt re-init after a brief delay
  setTimeout(() => client.initialize(), 5_000);
});

client.on('auth_failure', (msg) => {
  console.error('[WA] Auth failure:', msg);
});

client.initialize();

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /status
app.get('/status', checkSecret, (req, res) => {
  res.json({ connected: isReady, number: connectedNumber });
});

// GET /qr  — returns an HTML page so the QR is scannable directly in the browser
app.get('/qr', (req, res) => {
  if (isReady) {
    return res.send(`<html><body style="font-family:sans-serif;text-align:center;padding:40px"><h2>Connected</h2><p>Number: ${connectedNumber}</p></body></html>`);
  }
  if (currentQrDataUrl) {
    return res.send(`<html><body style="background:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><img src="${currentQrDataUrl}" style="width:300px;height:300px"/></body></html>`);
  }
  res.send(`<html><body style="font-family:sans-serif;text-align:center;padding:40px"><p>QR not ready yet — <a href="/qr">refresh</a> in a few seconds</p></body></html>`);
});

// POST /send  { phone: "212612345678", message: "..." }
app.post('/send', checkSecret, async (req, res) => {
  const { phone, message } = req.body;

  if (!phone || !message) {
    return res.status(400).json({ success: false, error: 'phone and message are required' });
  }

  if (!isReady) {
    return res.status(503).json({ success: false, error: 'WhatsApp not connected' });
  }

  // whatsapp-web.js expects the chat id format: "number@c.us"
  const chatId = `${phone}@c.us`;

  try {
    await client.sendMessage(chatId, message);
    console.log(`[WA] Sent to ${phone}`);
    res.json({ success: true });
  } catch (err) {
    console.error(`[WA] Send error to ${phone}:`, err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[WA service] Listening on port ${PORT}`);
});
