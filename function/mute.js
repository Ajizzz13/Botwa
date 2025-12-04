const { addMute, removeMute, getList } = require('../lib/mute_store');
const { jidDecode } = require('@whiskeysockets/baileys');

// Helper Decode JID
const decodeJid = (jid) => {
    if (!jid) return null;
    if (/:\d+@/gi.test(jid)) {
        const decode = jidDecode(jid) || {};
        return (decode.user && decode.server && decode.user + '@' + decode.server) || jid;
    }
    return jid;
};

// Helper Cek Admin (Sender Only)
const checkIsAdmin = (participants, targetJid) => {
    if (!targetJid) return false;
    const targetUser = decodeJid(targetJid)?.split('@')[0]; 
    if (!targetUser) return false;
    
    const participant = participants.find(p => {
        const pUser = decodeJid(p.id)?.split('@')[0];
        return pUser === targetUser;
    });
    
    return participant?.admin === 'admin' || participant?.admin === 'superadmin';
};

module.exports = {
    trigger: 'mute', 
    execute: async (sock, m, args, { isOwner }) => {
        const remoteJid = m.key.remoteJid;
        
        // Cek apakah ini grup
        if (!remoteJid.endsWith('@g.us')) {
            return sock.sendMessage(remoteJid, { text: '❌ Fitur ini hanya untuk grup.' }, { quoted: m });
        }

        const groupMetadata = await sock.groupMetadata(remoteJid);
        const participants = groupMetadata.participants;

        // 1. Cek Pengirim (Wajib Admin atau Owner)
        const senderRaw = m.key.fromMe ? sock.user.id : (m.key.participant || remoteJid);
        const isAdmin = checkIsAdmin(participants, senderRaw);

        if (!isAdmin && !isOwner) {
            return sock.sendMessage(remoteJid, { text: '❌ Perintah ini hanya untuk Admin Grup.' }, { quoted: m });
        }

        // [REVISI] Pengecekan Bot Admin DIHAPUS.
        // Biarkan perintah tereksekusi. Jika bot bukan admin, nanti fitur auto-delete di index.js 
        // yang akan gagal (tidak masalah, tinggal jadikan admin belakangan).

        const command = m.message.conversation || m.message.extendedTextMessage?.text || "";
        const cmd = command.split(' ')[0].toLowerCase().replace('.', '').replace('/', '');
        
        // --- LOGIKA COMMAND ---

        if (cmd === 'mute') {
            const quoted = m.message?.extendedTextMessage?.contextInfo?.participant;
            const mentioned = m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            let target = mentioned || quoted;
            
            // Support manual input number (08xxx / 628xxx)
            if (!target && args[0] && !args[0].match(/[mhd]/)) {
                target = args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net';
            }

            if (!target) {
                return sock.sendMessage(remoteJid, { text: '⚠️ Reply pesan atau tag user.\nContoh: .mute @user 10m' }, { quoted: m });
            }

            const duration = args.find(a => a.match(/\d+[mhd]/));
            addMute(decodeJid(target), duration);

            const durText = duration ? `selama ${duration}` : 'secara permanen';
            return sock.sendMessage(remoteJid, { 
                text: `🔇 User @${decodeJid(target).split('@')[0]} telah di-mute ${durText}.`, 
                mentions: [target] 
            }, { quoted: m });
        }

        if (cmd === 'unmute') {
            const quoted = m.message?.extendedTextMessage?.contextInfo?.participant;
            const mentioned = m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            let target = mentioned || quoted;
            
             if (!target && args[0]) {
                target = args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net';
            }

            if (!target) return sock.sendMessage(remoteJid, { text: '⚠️ Reply/Tag user untuk unmute.' }, { quoted: m });

            if (removeMute(decodeJid(target))) {
                return sock.sendMessage(remoteJid, { 
                    text: `🔊 User @${decodeJid(target).split('@')[0]} telah di-unmute.`, 
                    mentions: [target] 
                }, { quoted: m });
            } else {
                return sock.sendMessage(remoteJid, { text: '⚠️ User tersebut tidak sedang di-mute.' }, { quoted: m });
            }
        }
        
        if (cmd === 'listmute') {
             const list = getList();
             const mutedUsers = Object.keys(list).filter(id => !list[id].expiry || Date.now() < list[id].expiry);
             
             if (mutedUsers.length === 0) return sock.sendMessage(remoteJid, { text: 'Tidak ada user yang di-mute.' }, { quoted: m });
             
             let text = '🔇 *LIST MUTED USER*\n\n';
             mutedUsers.forEach((id, i) => {
                 text += `${i+1}. @${id.split('@')[0]}\n`;
             });
             
             return sock.sendMessage(remoteJid, { text, mentions: mutedUsers }, { quoted: m });
        }
    }
};
