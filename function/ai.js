const axios = require('axios');
const { getUserModel } = require('../lib/ai_store');

module.exports = {
    trigger: 'ai',
    execute: async (sock, m, args) => {
        const remoteJid = m.key.remoteJid;
        const sender = m.key.participant || remoteJid;
        const text = args.join(" ");

        if (!text) return sock.sendMessage(remoteJid, { text: '❓ Ketik pertanyaan. Contoh: .ai Apa itu koding?' }, { quoted: m });

        await sock.sendMessage(remoteJid, { react: { text: '🧠', key: m.key } });

        const model = getUserModel(sender);

        try {
            let replyText = '';

            if (model === 'llama') {
                // --- API LLAMA 3.1 (Siputzx) ---
                const payload = {
                    messages: [
                        { role: "system", content: "You are a helpful assistant named Zeroends." },
                        { role: "user", content: text }
                    ],
                    model: "@cf/meta/llama-3.1-8b-instruct-fast"
                };

                const { data } = await axios.post('https://api.siputzx.my.id/api/cf/chat', payload, {
                    headers: {
                        'Content-Type': 'application/json',
                        'accept': '*/*',
                        'api_key': 'p'
                    }
                });

                if (data && data.status && data.data && data.data.response) {
                    replyText = data.data.response;
                } else {
                    throw new Error('Respon Llama error/kosong');
                }

            } else {
                // --- API GPT-3 (Siputzx) ---
                const { data } = await axios.post('https://api.siputzx.my.id/api/ai/gpt3', 
                    [{ role: "user", content: text }], 
                    { headers: { 'Content-Type': 'application/json' } }
                );

                if (data && data.status && data.data) {
                    replyText = data.data;
                } else {
                    throw new Error('Respon GPT-3 error');
                }
            }

            await sock.sendMessage(remoteJid, { text: replyText }, { quoted: m });
            await sock.sendMessage(remoteJid, { react: { text: '✅', key: m.key } });

        } catch (e) {
            console.error(`[AI Error - ${model}]`, e.message);
            let errMsg = '❌ Terjadi kesalahan pada API.';
            if (model === 'llama') errMsg += ' Coba ganti ke model 1 (.model 1)';
            else errMsg += ' Coba ganti ke model 2 (.model 2)';
            
            await sock.sendMessage(remoteJid, { text: errMsg }, { quoted: m });
        }
    }
};
