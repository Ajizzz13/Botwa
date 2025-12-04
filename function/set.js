module.exports = {
    trigger: 'set',
    execute: async (sock, m, args, { settings, saveSettings, isOwner }) => {
        if (!isOwner) return;

        // Usage: .set <key> <value>
        // Example: .set botName SuperBot
        
        if (args.length < 2) {
            return sock.sendMessage(m.key.remoteJid, { 
                text: `Current Settings:\n${JSON.stringify(settings, null, 2)}\n\nUsage: .set <key> <value>` 
            }, { quoted: m });
        }

        const key = args[0];
        const value = args.slice(1).join(" ");

        if (settings.hasOwnProperty(key)) {
            settings[key] = value;
            saveSettings();
            await sock.sendMessage(m.key.remoteJid, { text: `Updated *${key}* to: ${value}` }, { quoted: m });
        } else {
            await sock.sendMessage(m.key.remoteJid, { text: `Key *${key}* not found in settings.` }, { quoted: m });
        }
    }
};
