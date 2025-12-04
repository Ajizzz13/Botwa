const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, makeCacheableSignalKeyStore, jidDecode } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const cfonts = require('cfonts');
const qrcode = require('qrcode'); 
const { isMuted } = require('./lib/mute_store'); // Import Helper Mute

const commands = new Map();
const functionsDir = path.join(__dirname, 'function');
const settingsPath = path.join(__dirname, 'settings.json');
const sessionDir = path.join(__dirname, 'sessions');

const START_TIME = Math.floor(Date.now() / 1000);

let settings = { ownerNumber: ["628xxxxxxxx"], mode: "public", botName: "Zeroends Bot" };

const loadSettings = () => {
    if (fs.existsSync(settingsPath)) {
        try {
            settings = JSON.parse(fs.readFileSync(settingsPath));
            if (typeof settings.ownerNumber === 'string') settings.ownerNumber = [settings.ownerNumber];
        } catch { }
    } else {
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    }
};

const saveSettings = () => fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

const question = (text) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => rl.question(text, (ans) => { rl.close(); resolve(ans); }));
};

const color = (text, code) => `\x1b[${code}m${text}\x1b[0m`;
const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

const decodeJid = (jid) => {
    if (!jid) return jid;
    if (/:\d+@/gi.test(jid)) {
        const decode = jidDecode(jid) || {};
        return (decode.user && decode.server && decode.user + '@' + decode.server) || jid;
    }
    return jid;
};

const loadCommands = () => {
    commands.clear();
    if (!fs.existsSync(functionsDir)) fs.mkdirSync(functionsDir);
    const files = fs.readdirSync(functionsDir).filter(file => file.endsWith('.js'));
    for (const file of files) {
        try {
            delete require.cache[require.resolve(path.join(functionsDir, file))];
            const command = require(path.join(functionsDir, file));
            if (command.trigger && command.execute) commands.set(command.trigger, command);
        } catch (e) { console.error(`[ERR] ${file}:`, e); }
    }
    console.log(`[SYS] Loaded ${commands.size} commands.`);
};

const logger = { level: 'silent', trace:()=>{}, debug:()=>{}, info:()=>{}, warn:()=>{}, error:()=>{}, fatal:()=>{}, child:()=>logger };

async function startMenu() {
    console.clear();
    const colors = ["green", "blue", "magenta", "cyan"];
    cfonts.say("Zero", { font: "block", align: "center", gradient: [pickRandom(colors), pickRandom(colors)] });
    cfonts.say("Ends", { font: "block", align: "center", gradient: [pickRandom(colors), pickRandom(colors)] });
    cfonts.say("By Zeroends", { font: "console", align: "center", colors: [pickRandom(colors)] });

    if (fs.existsSync(path.join(sessionDir, 'creds.json'))) {
        console.log(color('\n[1] New Session (Hapus Sesi Lama)', '31'));
        console.log(color('[2] Continue Session (Lanjut)', '32'));
        const choice = await question(color('Pilih opsi [1/2]: ', '36'));

        if (choice.trim() === '1') {
            fs.rmSync(sessionDir, { recursive: true, force: true });
            console.log(color('[SYS] Sesi lama dihapus.', '90'));
        } else {
            connectToWhatsApp(false); 
            return;
        }
    }

    console.log(color('\n[1] Connect With Pairing Code', '33'));
    console.log(color('[2] Connect With QR Code', '33'));
    const method = await question(color('Pilih metode [1/2]: ', '36'));

    if (method.trim() === '2') {
        connectToWhatsApp(false); 
    } else {
        connectToWhatsApp(true);
    }
}

async function connectToWhatsApp(usePairingCode = false) {
    loadSettings();
    const { state, saveCreds } = await useMultiFileAuthState('sessions');
    loadCommands();

    const sock = makeWASocket({
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        printQRInTerminal: false, 
        logger: logger,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        markOnlineOnConnect: true,
        syncFullHistory: false
    });

    if (usePairingCode && !sock.authState.creds.registered) {
        const phoneNumber = await question(color('\nMasukkan Nomor Bot (e.g 628xxx): ', '32'));
        const code = await sock.requestPairingCode(phoneNumber.trim());
        console.log(color(`\nPairing Code: ${code}\n`, '33'));
    }

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr && !usePairingCode) {
            console.log(color('\n[SYS] Scan QR Code di bawah ini:', '36'));
            qrcode.toString(qr, { type: 'terminal', small: true }, function (err, url) {
                if (!err) console.log(url);
            });
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom) ?
                lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut : true;
            
            console.log(color('[SYS] Connection closed, reconnecting...', '31')); 
            if (shouldReconnect) connectToWhatsApp(usePairingCode);
        } else if (connection === 'open') {
            console.log(color('[SYS] Bot Connected to WhatsApp Server', '32'));
        }
    });

    sock.ev.on('creds.update', async () => {
        await saveCreds();
        console.log(color('[SYS] Session/Encryption Keys Refreshed', '90')); 
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        const m = messages[0];
        if (!m.message) return;

        // --- ANTI LAG ---
        let msgTimestamp = m.messageTimestamp;
        if (typeof msgTimestamp === 'object' && msgTimestamp !== null) {
            msgTimestamp = msgTimestamp.low || msgTimestamp.toNumber ? msgTimestamp.toNumber() : parseInt(msgTimestamp);
        }
        if (msgTimestamp < START_TIME) return;

        // --- LOGIKA MUTE USER (AUTO DELETE) ---
        const senderRaw = m.key.participant || m.key.remoteJid;
        const isGroup = m.key.remoteJid.endsWith('@g.us');
        
        if (isGroup && isMuted(senderRaw)) {
            try {
                // Cek apakah bot admin sebelum mencoba hapus (untuk mencegah crash log)
                // Tapi untuk performa, kita try-catch saja langsung delete
                await sock.sendMessage(m.key.remoteJid, { delete: m.key });
                console.log(color(`[MUTE] Pesan dari ${senderRaw} dihapus otomatis.`, '31'));
                return; // Stop proses agar command tidak jalan
            } catch (e) {
                // Bot bukan admin atau gagal hapus
            }
        }
        // --------------------------------------

        let rawJid = m.key.fromMe ? sock.user.id : (m.key.participant || m.key.remoteJid);
        const senderJid = decodeJid(rawJid);
        const senderNumber = senderJid.split('@')[0];

        const msgType = Object.keys(m.message)[0];
        const body = msgType === 'conversation' ? m.message.conversation :
                     msgType === 'extendedTextMessage' ? m.message.extendedTextMessage.text : 
                     msgType === 'imageMessage' ? m.message.imageMessage.caption : 
                     msgType === 'videoMessage' ? m.message.videoMessage.caption : '';
        
        const pushName = m.pushName || 'Unknown';
        const isOwner = settings.ownerNumber.includes(senderNumber) || m.key.fromMe;
        
        if (settings.mode === 'self' && !isOwner) return;

        const time = new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' });
        console.log(color('\n=========================================', '90'));
        console.log(color(`TIME    : ${time} (WIB)`, '90'));
        console.log(color('NAME    : ', '32') + pushName + (isOwner ? color(' [OWNER]', '33') : ''));
        console.log(color('NUMBER  : ', '33') + senderNumber);
        console.log(color('MESSAGE : ', '36') + (body || color('[Media/Other]', '31')));
        console.log(color('=========================================', '90'));

        if (!body || !/^[./!#]/.test(body)) return;

        const cmdName = body.slice(1).trim().split(/ +/).shift().toLowerCase();
        const args = body.trim().split(/ +/).slice(1);

        if (commands.has(cmdName)) {
            try {
                await commands.get(cmdName).execute(sock, m, args, { settings, saveSettings, isOwner });
            } catch (err) {
                console.error(`[ERR] Command ${cmdName}:`, err);
            }
        }
    });
}

startMenu();
