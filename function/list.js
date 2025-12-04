const { loadData } = require('../lib/ai_store');

module.exports = {
    trigger: 'list',
    execute: async (sock, m, args, { isOwner }) => {
        if (args[0]?.toLowerCase() !== 'api') return;
        if (!isOwner) return sock.sendMessage(m.key.remoteJid, { text: '❌ Khusus Owner.' }, { quoted: m });

        const db = loadData();
        if (db.apiKeys.length === 0) return sock.sendMessage(m.key.remoteJid, { text: 'Belum ada API Key tersimpan.' }, { quoted: m });

        let text = `🔑 *LIST API KEY GEMINI*\n\n`;
        db.apiKeys.forEach((key, index) => {
            // Sensor key biar aman kalau ke-share screenshot
            const masked = key.slice(0, 5) + '...' + key.slice(-4);
            text += `${index + 1}. ${masked}\n`;
        });

        await sock.sendMessage(m.key.remoteJid, { text }, { quoted: m });
    }
};
