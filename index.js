const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino = require('pino');
const http = require('http');
const QRCode = require('qrcode');

let latestQR = null; // We’ll store the QR here

// 1. Web server to show QR on /qr
const PORT = process.env.PORT || 3000;
http.createServer(async (req, res) => {
    if (req.url === '/qr' && latestQR) {
        // Show QR as image
        const qrImage = await QRCode.toDataURL(latestQR);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
            <h1>EZED X TECH</h1>
            <p>Scan this with WhatsApp > Linked Devices</p>
            <img src="${qrImage}" style="width:300px;height:300px"/>
            <p>Refresh if it expired</p>
        `);
    } else {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('EZED X TECH is alive 💀. Go to /qr to scan');
    }
}).listen(PORT, () => console.log(`Web server on port ${PORT}`));

// 2. WhatsApp connection
async function startBot() {
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
            latestQR = qr; // Save it for the web page
            console.log('=== NEW QR GENERATED. GO TO /qr ===');
        }
        if (connection === 'open') {
            latestQR = null; // Clear QR once logged in
            console.log('✅ EZED X TECH CONNECTED');
        }
        if (connection === 'close') {
            const code = lastDisconnect.error?.output?.statusCode;
            if (code!== DisconnectReason.loggedOut) startBot();
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').toLowerCase().trim();

        let reply = 'Type *menu* 💀';
        if (text === 'menu') reply = '*EZED X TECH* 💀\n\n*menu* *ping* *tech*';
        if (text === 'ping') reply = 'pong 💀 EZED X TECH is live';
        if (text === 'tech') reply = 'QR now on web 🔥';

        await sock.sendMessage(from, { text: reply });
    });
}

startBot();
