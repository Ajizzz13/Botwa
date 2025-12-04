module.exports = {
    trigger: 'delown',
    execute: async (sock, m, args, { settings, saveSettings, isOwner }) => {
        if (!isOwner) return;

        const target = args[0] ? args[0].replace(/[^0-9]/g, '') : '';
        if (!target) return sock.sendMessage(m.key.remoteJid, { text: 'Masukkan nomor: .delown 628xxx' }, { quoted: m });

        if (!settings.ownerNumber.includes(target)) {
            return sock.sendMessage(m.key.remoteJid, { text: 'Nomor tidak ada di list owner.' }, { quoted: m });
        }
        
        // Prevent deleting the last owner (avoid lock out)
        if (settings.ownerNumber.length <= 1) {
            return sock.sendMessage(m.key.remoteJid, { text: 'Tidak bisa menghapus owner terakhir.' }, { quoted: m });
        }

        settings.ownerNumber = settings.ownerNumber.filter(num => num !== target);
        saveSettings();
        await sock.sendMessage(m.key.remoteJid, { text: `Sukses menghapus owner: ${target}` }, { quoted: m });
    }
};
