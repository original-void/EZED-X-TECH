const crypto = require('crypto'); // <-- FIX: Add this line at the top
global.crypto = crypto; // <-- FIX: Make it global for Baileys

const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, Browsers } = require('@whiskeysockets/baileys');
const pino = require('pino');
const http = require('http');

const PORT = process.env.PORT || 3000;
let pairingCode = null;

http.createServer((req, res) => {
    if (req.url === '/code' && pairingCode) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<h1>EZED X TECH</h1><h2 style="font-size:48px">${pairingCode}</h2><p>WhatsApp > Settings > Linked Devices > Link with phone number</p>`);
    } else {
        res.end('EZED X TECH alive. Go to /code');
    }
}).listen(PORT, () => console.log(`Web on ${PORT}`));

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_ezed');
    const sock = makeWASocket({ auth: state, logger: pino({ level:'silent' }), browser: Browsers.ubuntu('Chrome') });

    if (!sock.authState.creds.registered) {
        await new Promise(r => setTimeout(r, 3000));
        const phoneNumber = '254112843071'; // <-- CHANGE THIS TO YOUR BOT NUMBER
        pairingCode = await sock.requestPairingCode(phoneNumber.replace(/\+/g, ''));
        console.log('PAIRING CODE:', pairingCode);
    }

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', (u) => {
        if (u.connection === 'open') { pairingCode = null; console.log('✅ EZED X TECH CONNECTED'); }
        if (u.connection === 'close' && u.lastDisconnect.error?.output?.statusCode!== DisconnectReason.loggedOut) {
            setTimeout(startBot, 3000);
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const from = msg.key.remoteJid;
        const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').toLowerCase().trim();
        if (text === 'ping') await sock.sendMessage(from, { text: 'pong 💀 EZED X TECH is live' });
    });
}
startBot();
