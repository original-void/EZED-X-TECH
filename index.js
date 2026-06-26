const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino = require('pino');
const http = require('http');

// 1. Web server to keep Render awake + for UptimeRobot
const PORT = process.env.PORT || 3000;
http.createServer((_, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('EZED X TECH is alive 💀');
}).listen(PORT, () => console.log(`Web server on port ${PORT}`));

// 2. WhatsApp connection
async function startBot() {
    // IMPORTANT: This path must match your Render Disk Mount Path
    const AUTH_PATH = '/opt/render/project/src/auth_info_ezed';
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_PATH);

    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['EZED X TECH', 'Chrome', '1.0.0'],
        printQRInTerminal: false
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (u) => {
        const { connection, qr, lastDisconnect } = u;

        if (qr) {
            console.log('=== EZED X TECH QR START ===');
            console.log(qr); // Copy this entire string to qrcode.com
            console.log('=== EZED X TECH QR END ===');
        }
        if (connection === 'open') console.log('✅ EZED X TECH CONNECTED');
        if (connection === 'close') {
            const code = lastDisconnect.error?.output?.statusCode;
            console.log('Connection closed. Code:', code);
            if (code!== DisconnectReason.loggedOut) {
                console.log('Reconnecting...');
                startBot();
            } else {
                console.log('Logged out. Delete disk and rescan.');
            }
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').toLowerCase().trim();

        let reply = 'Type *menu* 💀';
        if (text === 'menu') reply = '*EZED X TECH* 💀\n\n*menu* - Show this\n*ping* - Test if alive\n*tech* - Tech tip';
        if (text === 'ping') reply = 'pong 💀 EZED X TECH is live';
        if (text === 'tech') reply = 'Tip: GitHub + Render = 24/7 🔥';

        await sock.sendMessage(from, { text: reply });
    });
}

startBot();
