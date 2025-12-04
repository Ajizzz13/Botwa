module.exports = {
    trigger: 'addown',
    execute: async (sock, m, args, { settings, saveSettings, isOwner }) => {
        if (!isOwner) return;
        
        const target = args[0] ? args[0].replace(/[^0-9]/g, '') : '';
        if (!target) return sock.sendMessage(m.key.remoteJid, { text: 'Masukkan nomor: .addown 628xxx' }, { quoted: m });

        if (settings.ownerNumber.includes(target)) {
            return sock.sendMessage(m.key.remoteJid, { text: 'Nomor sudah menjadi owner.' }, { quoted: m });
        }

        settings.ownerNumber.push(target);
        saveSettings();
        await sock.sendMessage(m.key.remoteJid, { text: `Sukses menambah owner: ${target}` }, { quoted: m });
    }
};
