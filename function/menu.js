const fs = require('fs');
const path = require('path');

module.exports = {
    trigger: 'menu',
    execute: async (sock, m, args, { settings }) => {
        const remoteJid = m.key.remoteJid;
        const pushName = m.pushName || "User";
        
        // 1. Baca Folder Function secara Dinamis
        const functionsDir = __dirname; 
        const files = fs.readdirSync(functionsDir).filter(file => file.endsWith('.js'));
        
        // 2. Buat Tampilan Menu
        let text = `🤖 *${settings.botName.toUpperCase()}*\n`;
        text += `👋 Hi, *${pushName}*\n`;
        text += `🕹️ Mode: *${settings.mode.toUpperCase()}*\n`;
        text += `⏳ Time: ${new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' })}\n`;
        text += `📊 Total Fitur: ${files.length}\n`;
        text += `_________________________\n\n`;
        
        // 3. Loop file untuk menampilkan command
        text += `*LIST COMMAND:*\n`;
        files.sort().forEach((file) => {
            const cmdName = file.replace('.js', '');
            text += `› .${cmdName}\n`;
        });

        text += `\n_________________________\n`;
        text += `_Type .<command> to use_`;

        // 4. Kirim Menu
        await sock.sendMessage(remoteJid, { 
            text: text,
            contextInfo: {
                externalAdReply: {
                    title: "Zeroends Bot",
                    body: "Main menu", 
                    thumbnailUrl: "https://img.freepik.com/free-vector/chatbot-chat-message-vectorart_78370-4104.jpg", 
                    sourceUrl: "https://github.com/Zeroends",
                    mediaType: 1,
                    renderLargerThumbnail: true
                }
            }
        }, { quoted: m });
    }
};
