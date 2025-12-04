const { getUserModel, setUserModel } = require('../lib/ai_store');

const MODELS = {
    1: { id: 'gpt3', name: 'GPT-3 (Siputzx)' },
    2: { id: 'llama', name: 'Llama 3.1 (Siputzx)' }
};

module.exports = {
    trigger: 'model',
    execute: async (sock, m, args) => {
        const sender = m.key.participant || m.key.remoteJid;
        const choice = args[0];

        if (choice && MODELS[choice]) {
            setUserModel(sender, MODELS[choice].id);
            return sock.sendMessage(m.key.remoteJid, { 
                text: `✅ Model AI berhasil diganti ke: *${MODELS[choice].name}*` 
            }, { quoted: m });
        }

        const currentId = getUserModel(sender);
        const currentName = Object.values(MODELS).find(x => x.id === currentId)?.name || 'Unknown';

        let text = `🤖 *PENGATURAN MODEL AI*\n`;
        text += `Model Anda saat ini: *${currentName}*\n\n`;
        text += `Pilih angka untuk mengganti:\n`;
        
        for (const [key, val] of Object.entries(MODELS)) {
            text += `${key}. ${val.name}\n`;
        }
        
        text += `\nContoh: *.model 2*`;

        await sock.sendMessage(m.key.remoteJid, { text }, { quoted: m });
    }
};
