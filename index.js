const crypto = require('crypto');
global.crypto = crypto;

const fs = require('fs');
const express = require('express');
const QRCode = require('qrcode');
const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, Browsers, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');

const app = express();
const PORT = process.env.PORT || 3000;
const AUTH_PATH = 'auth_info_ezed';
let latestQR = null;

app.get('/qr', async (req, res) => {
    if (!latestQR) return res.send('<h1>No QR yet. Refresh in 5s.</h1>');
    const qrImage = await QRCode.toDataURL(latestQR);
    res.send(`<h1>EZED X TECH</h1><img src="${qrImage}" style="width:320px;height:320px"/><p>Scan in 20s or refresh.</p>`);
});
app.get('/', (req, res) => res.send('EZED X TECH alive 💀'));
app.listen(PORT, () => console.log(`Web on ${PORT}`));

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_PATH);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level:'silent' }), // <-- Silent logs
        browser: Browsers.ubuntu('Chrome'),
        printQRInTerminal: false // <-- No QR in logs
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (u) => {
        const { connection, qr, lastDisconnect } = u;
        if (qr) {
            latestQR = qr; // Only store it, don't console.log it
        }
        if (connection === 'open') {
            latestQR = null;
            console.log('✅ EZED X TECH CONNECTED');
        }
        if (connection === 'close') {
            const code = lastDisconnect.error?.output?.statusCode;
            if (code === DisconnectReason.loggedOut) {
                console.log('Logged out. Delete auth_info_ezed folder');
                fs.rmSync(AUTH_PATH, { recursive: true, force: true });
            }
            setTimeout(startBot, 3000);
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;
        if (msg.message.conversation?.toLowerCase() === 'ping') {
            await sock.sendMessage(msg.key.remoteJid, { text: 'pong 💀' });
        }
    });
}
startBot();
