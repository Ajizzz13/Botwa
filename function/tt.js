const axios = require("axios");

const DEFAULT_AVATAR = "https://i.ibb.co/2d8q4rX/default-avatar.png";

module.exports = {
    trigger: 'tt',
    execute: async (sock, m, args) => {
        const remoteJid = m.key.remoteJid;
        const url = args[0];

        if (!url) {
            return sock.sendMessage(remoteJid, { 
                text: '📌 Contoh penggunaan: .tt https://vt.tiktok.com/ZSABXgGse/' 
            }, { quoted: m });
        }

        await sock.sendMessage(remoteJid, { react: { text: "⏳", key: m.key } });

        try {
            let result = await fetchTikwm(url);

            let avatarUrl = result.author?.avatar || DEFAULT_AVATAR;
            let caption = formatTikTokInfo(result);
            let avatarBuffer = await getBuffer(avatarUrl);

            if (Array.isArray(result.images) && result.images.length > 0) {
                const replyMsg = await sock.sendMessage(remoteJid, {
                    image: avatarBuffer,
                    caption: `📸 Postingan ini berisi *${result.images.length} foto*\n\n${caption}`
                }, { quoted: m });

                for (let i = 0; i < result.images.length; i++) {
                    let imgBuffer = await getBuffer(result.images[i]);
                    await sock.sendMessage(remoteJid, {
                        image: imgBuffer,
                        caption: `🖼️ Foto ke-${i + 1}`
                    }, { quoted: replyMsg }); 
                    await delay(3000); 
                }

            } else {
                let videoUrl = result.hdplay || result.play || result.wmplay;
                if (videoUrl) {
                    await sock.sendMessage(remoteJid, {
                        video: { url: videoUrl },
                        caption: caption
                    }, { quoted: m });
                }
            }

            if (result.music) {
                await sock.sendMessage(remoteJid, {
                    audio: { url: result.music },
                    mimetype: "audio/mp4", 
                    ptt: false 
                }, { quoted: m });
            }

            await sock.sendMessage(remoteJid, { react: { text: "✅", key: m.key } });

        } catch (err) {
            console.error('[TikTok Error]', err);
            await sock.sendMessage(remoteJid, { 
                text: "❌ Gagal mengambil data TikTok. Pastikan link valid atau coba lagi nanti." 
            }, { quoted: m });
        }
    }
};

async function fetchTikwm(url) {
  const { data } = await axios.get(
    `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`,
    {
      headers: {
        "user-agent": "Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36",
        referer: "https://www.tikwm.com/",
        accept: "application/json,text/plain,*/*",
      },
      timeout: 20000,
    }
  );
  if (!data || data.code !== 0 || !data.data) {
    throw new Error("TikWM response invalid");
  }
  return data.data;
}

function formatTikTokInfo(video) {
  const formatSize = (bytes = 0) => {
    if (!bytes || isNaN(bytes)) return "-";
    const mb = bytes / (1024 * 1024);
    return mb < 1024 ? `${mb.toFixed(2)} MB` : `${(mb / 1024).toFixed(2)} GB`;
  };

  const formatDate = (unix = 0) => {
    if (!unix) return "-";
    const date = new Date(unix * 1000);
    return date.toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const num = (n) => (n ? n.toLocaleString("id-ID") : "0");

  return `🎵 *TIKTOK DOWNLOADER*
─────────────────────
🎬 *Judul:* ${video.title || "-"}
👤 *Author:* ${video.author?.nickname || "-"} (@${video.author?.unique_id || "-"})
🌍 *Region:* ${video.region || "-"}
⌛ *Durasi:* ${video.duration || 0} detik
📦 *Size:* ${formatSize(video.size)}

📊 *Statistik:*
👀 Views: ${num(video.play_count)} | ❤️ Likes: ${num(video.digg_count)}
💬 Comment: ${num(video.comment_count)} | 🔄 Share: ${num(video.share_count)}
⏰ Upload: ${formatDate(video.create_time)} WIB
─────────────────────`.trim();
}

async function getBuffer(url) {
  const res = await axios.get(url, { responseType: "arraybuffer", timeout: 30000 });
  return Buffer.from(res.data);
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
