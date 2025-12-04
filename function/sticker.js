const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { Sticker, StickerTypes } = require('wa-sticker-formatter');
const axios = require('axios');

module.exports = {
    trigger: 's',
    execute: async (sock, m, args) => {
        const remoteJid = m.key.remoteJid;
        
        // 1. Deteksi Tipe Pesan (Gambar atau Video)
        const msg = m.message;
        const type = Object.keys(msg)[0];
        
        // Cek Direct Message
        const isImage = type === 'imageMessage';
        const isVideo = type === 'videoMessage';
        
        // Cek Quoted Message
        const quoted = msg.extendedTextMessage?.contextInfo?.quotedMessage;
        const isQuotedImage = quoted?.imageMessage;
        const isQuotedVideo = quoted?.videoMessage;

        if (!isImage && !isVideo && !isQuotedImage && !isQuotedVideo) {
            return sock.sendMessage(remoteJid, { text: '⚠️ Kirim/Reply gambar atau video (maks 10 detik) dengan caption .s' }, { quoted: m });
        }

        // Validasi Durasi Video (Agar tidak berat/error)
        const videoData = isVideo ? msg.videoMessage : (isQuotedVideo ? quoted.videoMessage : null);
        if (videoData && videoData.seconds > 10) {
            return sock.sendMessage(remoteJid, { text: '⚠️ Durasi video maksimal 10 detik agar bisa jadi stiker.' }, { quoted: m });
        }

        try {
            // 2. Ambil Metadata Unik (Quotes Anime)
            let packName = "Zeroends"; 
            let authorName = "Bot";
            
            try {
                const { data } = await axios.post('https://api.siputzx.my.id/api/r/quotesanime');
                const quotesList = data.data;
                for (const item of quotesList) {
                    const q = item.quotes.trim();
                    if (!/\.{2,}$/.test(q)) { // Filter quote putus
                        packName = item.karakter;
                        authorName = q;
                        break;
                    }
                }
            } catch (err) {
                // Ignore api error, use default
            }

            // 3. Download Media
            let stream;
            if (isImage || isVideo) {
                stream = await downloadContentFromMessage(msg[type], isImage ? 'image' : 'video');
            } else {
                const qType = isQuotedImage ? 'image' : 'video';
                stream = await downloadContentFromMessage(quoted[qType + 'Message'], qType);
            }

            let buffer = Buffer.from([]);
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }

            // 4. Buat Stiker (Auto detect image/video buffer)
            const sticker = new Sticker(buffer, {
                pack: packName,    
                author: authorName, 
                type: StickerTypes.FULL, // Full size, tidak dicrop bulat
                quality: 50 // Kualitas kompresi
            });

            const generatedSticker = await sticker.toBuffer();

            // 5. Kirim
            await sock.sendMessage(remoteJid, { sticker: generatedSticker }, { quoted: m });

        } catch (e) {
            console.error('[Sticker Error]', e);
            await sock.sendMessage(remoteJid, { text: '❌ Gagal membuat stiker. Pastikan FFmpeg terinstall di server.' }, { quoted: m });
        }
    }
};
