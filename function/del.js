const { loadData, saveData } = require('../lib/ai_store');

module.exports = {
    trigger: 'del',
    execute: async (sock, m, args, { isOwner }) => {
        if (args[0]?.toLowerCase() !== 'api') return;
        if (!isOwner) return sock.sendMessage(m.key.remoteJid, { text: '❌ Khusus Owner.' }, { quoted: m });

        const db = loadData();
        
        // Bisa hapus by index (angka) atau key langsung
        const input = args[1];
        if (!input) return sock.sendMessage(m.key.remoteJid, { text: 'Format: .del api <angka_urutan>' }, { quoted: m });

        const index = parseInt(input) - 1;
        
        if (isNaN(index) || index < 0 || index >= db.apiKeys.length) {
            return sock.sendMessage(m.key.remoteJid, { text: '⚠️ Urutan tidak valid. Cek .list api' }, { quoted: m });
        }

        const deletedKey = db.apiKeys.splice(index, 1);
        saveData(db);

        await sock.sendMessage(m.key.remoteJid, { text: `✅ Berhasil menghapus API Key urutan ke-${index + 1}` }, { quoted: m });
    }
};
