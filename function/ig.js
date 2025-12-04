const axios = require('axios');

module.exports = {
    trigger: 'ig',
    execute: async (sock, m, args) => {
        const remoteJid = m.key.remoteJid;
        
        // 1. Ambil URL dari Args atau Quoted Message
        const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const quotedText = quoted?.conversation || quoted?.extendedTextMessage?.text || "";
        
        // Prioritas: Args dulu, kalau kosong baru cek quoted
        const url = args[0] || quotedText;

        // 2. Validasi URL
        if (!url || !url.includes('instagram.com')) {
            return sock.sendMessage(remoteJid, { text: '⚠️ Masukkan link Instagram! Bisa kirim link langsung atau reply pesan berisi link.\nContoh: .ig https://www.instagram.com/reel/xxx' }, { quoted: m });
        }

        // Feedback Loading
        await sock.sendMessage(remoteJid, { react: { text: '⏳', key: m.key } });

        try {
            // 3. Request ke API
            const { data } = await axios.post('https://api.siputzx.my.id/api/d/igdl', 
                { url: url },
                { headers: { 'Content-Type': 'application/json' } }
            );

            if (data.status && data.data && data.data.length > 0) {
                // 4. Loop hasil (Support Carousel/Multiple Media)
                for (const item of data.data) {
                    const mediaUrl = item.url;
                    
                    // Deteksi Tipe Media (Video/Image) berdasarkan ekstensi URL atau asumsi API
                    // API ini mengembalikan .mp4 untuk video
                    if (mediaUrl.includes('.mp4')) {
                        await sock.sendMessage(remoteJid, { 
                            video: { url: mediaUrl }, 
                            caption: '✅ IG Video Downloader' 
                        }, { quoted: m });
                    } else {
                        await sock.sendMessage(remoteJid, { 
                            image: { url: mediaUrl }, 
                            caption: '✅ IG Image Downloader' 
                        }, { quoted: m });
                    }
                }

                await sock.sendMessage(remoteJid, { react: { text: '✅', key: m.key } });

            } else {
                throw new Error('Konten tidak ditemukan atau akun private.');
            }

        } catch (e) {
            console.error('[IG Error]', e);
            await sock.sendMessage(remoteJid, { text: '❌ Gagal mendownload. Pastikan link publik (tidak private).' }, { quoted: m });
        }
    }
};
