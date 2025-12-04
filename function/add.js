const { loadData, saveData } = require('../lib/ai_store');

module.exports = {
    trigger: 'add',
    execute: async (sock, m, args, { isOwner }) => {
        // Cek apakah subcommand adalah 'api'
        if (args[0]?.toLowerCase() !== 'api') return;
        if (!isOwner) return sock.sendMessage(m.key.remoteJid, { text: '❌ Khusus Owner.' }, { quoted: m });

        const newKey = args[1];
        if (!newKey) return sock.sendMessage(m.key.remoteJid, { text: 'Format: .add api <key_gemini>' }, { quoted: m });

        const db = loadData();
        if (db.apiKeys.includes(newKey)) return sock.sendMessage(m.key.remoteJid, { text: '⚠️ API Key sudah ada.' }, { quoted: m });

        db.apiKeys.push(newKey);
        saveData(db);
        
        await sock.sendMessage(m.key.remoteJid, { text: `✅ Berhasil menambah API Key.\nTotal Key: ${db.apiKeys.length}` }, { quoted: m });
    }
};
