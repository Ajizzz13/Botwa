module.exports = {
    trigger: 'listown',
    execute: async (sock, m, args, { settings }) => {
        // Public can see owner list
        const list = settings.ownerNumber.map((num, i) => `${i + 1}. ${num}`).join('\n');
        await sock.sendMessage(m.key.remoteJid, { 
            text: `*LIST OWNER BOT*\n\n${list}` 
        }, { quoted: m });
    }
};
