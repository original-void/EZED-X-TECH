const crypto = require('crypto');
global.crypto = crypto;

const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, Browsers, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal');

const AUTH_PATH = './auth_info_ezed';

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_PATH);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level:'info' }),
        browser: Browsers.ubuntu('Chrome'),
        printQRInTerminal: false
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (u) => {
        const { connection, qr, lastDisconnect } = u;
        if (qr) {
            console.log('=== SCAN THIS QR ===');
            qrcode.generate(qr, { small: true });
        }
        if (connection === 'open') {
            console.log('✅ LOGGED IN. Close terminal now. DO NOT PUSH THIS FOLDER TO GITHUB');
            process.exit(0);
        }
        if (connection === 'close' && lastDisconnect.error?.output?.statusCode === DisconnectReason.loggedOut) {
            console.log('Logged out. Delete auth_info_ezed and try again');
            process.exit(1);
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;
        if (msg.message.conversation?.toLowerCase() === 'ping') {
            await sock.sendMessage(msg.key.remoteJid, { text: 'pong 💀 EZED X TECH is live' });
        }
    });
}
startBot();
