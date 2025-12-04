module.exports = {
    trigger: 'mode',
    execute: async (sock, m, args, { settings, saveSettings, isOwner }) => {
        if (!isOwner) return; // Silent ignore if not owner

        const newMode = args[0]?.toLowerCase();
        if (!['self', 'public'].includes(newMode)) {
            return sock.sendMessage(m.key.remoteJid, { text: `Format: .mode self/public\nCurrent: ${settings.mode}` }, { quoted: m });
        }

        settings.mode = newMode;
        saveSettings();
        await sock.sendMessage(m.key.remoteJid, { text: `Bot mode changed to: *${newMode.toUpperCase()}*` }, { quoted: m });
    }
};
