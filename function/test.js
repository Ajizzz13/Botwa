const { GoogleGenerativeAI } = require("@google/generative-ai");
const { loadData } = require('../lib/ai_store');

module.exports = {
    trigger: 'test',
    execute: async (sock, m, args, { isOwner }) => {
        if (args[0]?.toLowerCase() !== 'api') return;
        if (!isOwner) return sock.sendMessage(m.key.remoteJid, { text: '❌ Khusus Owner.' }, { quoted: m });

        const db = loadData();
        if (db.apiKeys.length === 0) return sock.sendMessage(m.key.remoteJid, { text: 'Tidak ada API Key untuk dites.' }, { quoted: m });

        await sock.sendMessage(m.key.remoteJid, { text: `⏳ Menguji ${db.apiKeys.length} API Key...` }, { quoted: m });

        let report = `🧪 *HASIL TES API GEMINI*\n\n`;
        
        for (let i = 0; i < db.apiKeys.length; i++) {
            const key = db.apiKeys[i];
            const genAI = new GoogleGenerativeAI(key);
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            
            const start = Date.now();
            try {
                await model.generateContent("Test");
                const latency = Date.now() - start;
                report += `${i + 1}. ✅ Aktif (${latency}ms)\n`;
            } catch (e) {
                report += `${i + 1}. ❌ Mati/Limit (${e.message.split(' ')[0]})\n`;
            }
        }

        await sock.sendMessage(m.key.remoteJid, { text: report }, { quoted: m });
    }
};
