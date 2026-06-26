const crypto = require('crypto');
global.crypto = crypto;

const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, Browsers, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const http = require('http');
const fs = require('fs');
const QRCode = require('qrcode');

const PORT = process.env.PORT || 3000;
const AUTH_PATH = 'auth_info_ezed'; // Free plan = ephemeral
let latestQR = null;

http.createServer(async (req, res) => {
    if (req.url === '/qr' && latestQR) {
        const qrImage = await QRCode.toDataURL(latestQR);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<h1>EZED X TECH QR</h1><img src="${qrImage}" style="width:320px;height:320px"/><p>Scan fast. Refresh if expired.</p>`);
    } else {
        res.end('EZED X TECH alive. Go to /qr');
    }
}).listen(PORT, () => console.log(`Web on ${PORT}`));

async function startBot() {
    // 1. Force delete bad session if it exists but isn't registered
    if (fs.existsSync(AUTH_PATH)) {
        const credsFile = `${AUTH_PATH}/creds.json`;
        if (fs.existsSync(credsFile)) {
            const creds = JSON.parse(fs.readFileSync(credsFile, 'utf-8'));
            if (!creds.registered) {
                console.log('Bad session found. Deleting to force new QR...');
                fs.rmSync(AUTH_PATH, { recursive: true, force: true });
            }
        }
    }

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_PATH);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level:'silent' }),
        browser: Browsers.ubuntu('Chrome'),
        printQRInTerminal: false
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (u) => {
        const { connection, qr, lastDisconnect } = u;

        if (qr) {
            latestQR = qr; // Show on /qr
            console.log('=== NEW QR. GO TO /qr NOW ===');
        }
        if (connection === 'open') {
            latestQR = null;
            console.log('✅ EZED X TECH CONNECTED');
        }
        if (connection === 'close') {
            const code = lastDisconnect.error?.output?.statusCode;
            if (code === DisconnectReason.loggedOut) {
                console.log('Logged out. Deleting session...');
                fs.rmSync(AUTH_PATH, { recursive: true, force: true });
            }
            setTimeout(startBot, 3000); // Reconnect
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const from = msg.key.remoteJid;
        const text = (msg.message.conversation || '').toLowerCase().trim();
        if (text === 'ping') await sock.sendMessage(from, { text: 'pong 💀 EZED X TECH is live' });
    });
}
startBot();
