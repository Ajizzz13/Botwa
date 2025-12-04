const fs = require('fs');
const ownerManager = require('./owner_list');
const BAN_PATH = './jpm_ban.json';
const DELAY_PATH = './jpm_delay.json';
const LOG_PATH = './jpm_logs.json';
const SESSIONS_JPM = {};

// === KONFIGURASI ===

const SESSION_TIMEOUT = 10 * 60 * 1000; // 10 menit
const RATE_LIMIT_WINDOW = 30000; // 30 detik
const RATE_LIMIT_MAX = 3; // Maksimal 3 request per window
const MAX_MESSAGE_LENGTH = 5000; // Batas maksimal pesan
const RETRY_ATTEMPTS = 2; // Jumlah percobaan ulang

// === RATE LIMITING SYSTEM ===
const RATE_LIMIT = new Map();

function checkRateLimit(jid) {
  const now = Date.now();
  const userLimit = RATE_LIMIT.get(jid) || { count: 0, lastTime: 0 };
  if (now - userLimit.lastTime < RATE_LIMIT_WINDOW) {
    if (userLimit.count >= RATE_LIMIT_MAX) return false;
    userLimit.count++;
  } else {
    userLimit.count = 1;
    userLimit.lastTime = now;
  }
  RATE_LIMIT.set(jid, userLimit);
  return true;
}

// === SECURITY SYSTEM ===


// === LOGGING SYSTEM ===
function logAction(action, details) {
  try {
    const log = {
      timestamp: new Date().toISOString(),
      jid: details.jid,
      action: action,
      details: details
    };
    const logs = fs.existsSync(LOG_PATH) ?
      JSON.parse(fs.readFileSync(LOG_PATH, 'utf-8')) : [];
    logs.push(log);
    if (logs.length > 1000) logs.shift(); // Rotate logs
    fs.writeFileSync(LOG_PATH, JSON.stringify(logs, null, 2));
  } catch (error) {
    console.error('Logging error:', error);
  }
}

// === SESSION CLEANUP ===
function cleanupSessions() {
  const now = Date.now();
  Object.keys(SESSIONS_JPM).forEach(key => {
    const session = SESSIONS_JPM[key];
    if (session && (now - (session.createdAt || 0) > SESSION_TIMEOUT)) {
      delete SESSIONS_JPM[key];
    }
  });
}

// === FILE OPERATIONS dengan ERROR HANDLING ===
function loadDelay() {
  try {
    if (!fs.existsSync(DELAY_PATH)) return 2;
    const delay = Number(fs.readFileSync(DELAY_PATH, 'utf-8'));
    return isNaN(delay) ? 2 : delay;
  } catch (error) {
    console.error('Error loading delay:', error);
    return 2;
  }
}

function saveDelay(sec) {
  try {
    fs.writeFileSync(DELAY_PATH, String(sec));
  } catch (error) {
    console.error('Error saving delay:', error);
    throw error;
  }
}

function loadBan() {
  try {
    if (!fs.existsSync(BAN_PATH)) return [];
    return JSON.parse(fs.readFileSync(BAN_PATH, 'utf-8'));
  } catch (error) {
    console.error('Error loading ban list:', error);
    return [];
  }
}

function saveBan(arr) {
  try {
    fs.writeFileSync(BAN_PATH, JSON.stringify(arr, null, 2));
  } catch (error) {
    console.error('Error saving ban list:', error);
    throw error;
  }
}

// === ENHANCED GROUP MESSAGING DENGAN RETRY ===
async function sendWithRetry(sock, gid, pesan, maxRetries = RETRY_ATTEMPTS) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await sock.sendMessage(gid, { text: pesan });
      return { success: true, gid: gid, attempt: attempt };
    } catch (error) {
      console.error(`Attempt ${attempt} failed for ${gid}:`, error.message);
      if (attempt === maxRetries) {
        return { 
          success: false, 
          gid: gid, 
          error: error.message, 
          attempt: attempt 
        };
      }
      // Tunggu 2 detik sebelum retry
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// === TEMPLATE SYSTEM ===
const TEMPLATES = {
  1: "Hai semua! 👋\nIni broadcast dari bot\nSemoga harimu menyenangkan!",
  2: "📢 **PENGUMUMAN PENTING**\n\nMohon perhatian seluruh member...\n\nTerima kasih 🙏",
  3: "🔔 **REMINDER**\n\nJangan lupa meeting besok!\n⏰ Waktu: 10:00 WIB\n📍 Tempat: Online\n\n_Harap konfirmasi kehadiran_",
  4: "🎉 **SELAMAT DATANG**\n\nSelamat bergabung di grup ini!\nMohon baca rules grup dan perkenalkan diri 😊"
};

module.exports = async function(sock, msg) {
  const jid = msg.key.remoteJid;
  const sessionKey = jid;
  const text =
    (msg.message?.conversation ||
     msg.message?.extendedTextMessage?.text ||
     msg.message?.imageMessage?.caption ||
     msg.message?.videoMessage?.caption ||
     ''
    ).trim();

  // === SESSION CLEANUP ===
  cleanupSessions();

  // === DETEKSI COMMAND JPM ===
  const isJPMCommand =
    /^\/(jpm|b|delayjpm|bangc|unbangc|jpmstats|jpmtemplate|preview)$/i.test(text) ||
    SESSIONS_JPM[sessionKey];

  // === SECURITY CHECK (HANYA untuk command JPM) ===
  if (isJPMCommand && !isOwner(jid)) {
    await sock.sendMessage(jid, { text: '❌ Fitur ini hanya untuk owner bot!' });
    return true;
  }

  // === RATE LIMITING (HANYA untuk command JPM) ===
  if (isJPMCommand && !checkRateLimit(jid)) {
    await sock.sendMessage(jid, { text: '⚠️ Terlalu banyak request, tunggu 30 detik sebelum menggunakan command lagi.' });
    return true;
  }

  // === FITUR BATAL SESI ===
  if (/^\/b$/i.test(text) && SESSIONS_JPM[sessionKey]) {
    delete SESSIONS_JPM[sessionKey];
    await sock.sendMessage(jid, { text: '❌ Sesi JPM dibatalkan.' }, { quoted: msg });
    logAction('SESSION_CANCELLED', { jid: jid });
    return true;
  }

  // === FITUR STATISTICS ===
  if (/^\/jpmstats$/i.test(text)) {
    const delay = loadDelay();
    const banned = loadBan();
    const groups = await sock.groupFetchAllParticipating();
    let stats = `📊 **STATISTICS JPM**\n\n`;
    stats += `⏱️ Delay: ${delay} detik\n`;
    stats += `🚫 Blacklist: ${banned.length} grup\n`;
    stats += `👥 Total Grup: ${Object.keys(groups).length}\n`;
    stats += `✅ Active Sessions: ${Object.keys(SESSIONS_JPM).length}\n`;
    stats += `📈 Rate Limit: ${RATE_LIMIT_MAX} req/${RATE_LIMIT_WINDOW/1000}s\n`;
    stats += `🔄 Retry Attempts: ${RETRY_ATTEMPTS}x\n`;
    stats += `📝 Max Pesan: ${MAX_MESSAGE_LENGTH} karakter`;
    
    await sock.sendMessage(jid, { text: stats });
    logAction('STATS_VIEWED', { jid: jid });
    return true;
  }

  // === FITUR TEMPLATE ===
  if (/^\/jpmtemplate$/i.test(text)) {
    let templateList = "📋 **TEMPLATE PESAN JPM:**\n\n";
    Object.entries(TEMPLATES).forEach(([num, msg]) => {
      templateList += `${num}. ${msg.substring(0, 40)}...\n\n`;
    });
    templateList += "Balas angka template yang ingin digunakan (1-4) atau 0 untuk batal";
    
    SESSIONS_JPM[sessionKey] = {
      mode: 'template',
      templates: TEMPLATES,
      createdAt: Date.now()
    };
    
    await sock.sendMessage(jid, { text: templateList });
    logAction('TEMPLATE_VIEWED', { jid: jid });
    return true;
  }

  if (SESSIONS_JPM[sessionKey]?.mode === 'template') {
    if (text === '0') {
      delete SESSIONS_JPM[sessionKey];
      await sock.sendMessage(jid, { text: '❌ Pemilihan template dibatalkan.' });
      return true;
    }
    
    const templateNum = Number(text);
    if (isNaN(templateNum) || templateNum < 1 || templateNum > Object.keys(TEMPLATES).length) {
      await sock.sendMessage(jid, { text: '❌ Pilih angka template yang valid (1-4) atau 0 untuk batal.' });
      return true;
    }
    
    const selectedTemplate = TEMPLATES[templateNum];
    SESSIONS_JPM[sessionKey] = {
      mode: 'jpm',
      lines: [selectedTemplate],
      createdAt: Date.now()
    };
    
    await sock.sendMessage(jid, {
      text: `✅ Template ${templateNum} dipilih!\n\nPesan:\n${selectedTemplate}\n\nKetik /done untuk kirim atau /b untuk batal`
    });
    logAction('TEMPLATE_SELECTED', { jid: jid, template: templateNum });
    return true;
  }

  // === CEK DOUBLE SESI JPM ===
  if (/^\/jpm$/i.test(text)) {
    if (SESSIONS_JPM[sessionKey]) {
      await sock.sendMessage(jid, { text: '⚠️ Sesi JPM masih berjalan. Ketik /done untuk selesai atau /b untuk batal.' }, { quoted: msg });
      return true;
    }
    
    SESSIONS_JPM[sessionKey] = {
      mode: 'jpm',
      lines: [],
      createdAt: Date.now()
    };
    
    await sock.sendMessage(jid, {
      text: '📝 **MODE JPM MULTILINE**\n\nKetik pesan JPM (multi baris):\n• /done → Selesai & kirim\n• /preview → Lihat preview\n• /b → Batalkan sesi'
    }, { quoted: msg });
    
    logAction('JPM_STARTED', { jid: jid });
    return true;
  }

  // === PREVIEW PESAN DENGAN LENGTH WARNING ===
  if (/^\/preview$/i.test(text) && SESSIONS_JPM[sessionKey]?.mode === 'jpm') {
    const pesan = SESSIONS_JPM[sessionKey].lines.join('\n');
    if (!pesan.trim()) {
      await sock.sendMessage(jid, { text: '❌ Pesan masih kosong. Ketik pesan dulu.' });
      return true;
    }
    
    let previewText = `📝 **PREVIEW PESAN:**\n\n${pesan}\n\n`;
    previewText += `📏 Panjang: ${pesan.length} karakter\n\n`;
    
    if (pesan.length > 3000) {
      previewText += `⚠️ *PERINGATAN:* Pesan sangat panjang! Mungkin menyebabkan kegagalan pengiriman.\n\n`;
    } else if (pesan.length > 2000) {
      previewText += `💡 *Saran:* Pertimbangkan untuk mempersingkat pesan.\n\n`;
    }
    
    previewText += `✅ /done → Kirim ke semua grup\n❌ /b → Batalkan`;
    
    await sock.sendMessage(jid, { text: previewText });
    logAction('PREVIEW_VIEWED', { jid: jid, messageLength: pesan.length });
    return true;
  }

  // === JPM MULTILINE MODE YANG DITINGKATKAN ===
  if (SESSIONS_JPM[sessionKey]?.mode === 'jpm') {
    // Double safety check
    if (!SESSIONS_JPM[sessionKey]) return false;

    if (/^\/done$/i.test(text)) {
      const pesan = SESSIONS_JPM[sessionKey].lines.join('\n');
      if (!pesan.trim()) {
        await sock.sendMessage(jid, { text: '❌ Pesan tidak boleh kosong. Sesi dibatalkan.', quoted: msg });
        delete SESSIONS_JPM[sessionKey];
        return true;
      }
      
      // Validasi panjang pesan
      if (pesan.length > MAX_MESSAGE_LENGTH) {
        await sock.sendMessage(jid, { 
          text: `❌ Pesan terlalu panjang (${pesan.length} karakter). Maksimal ${MAX_MESSAGE_LENGTH} karakter. Sesi dibatalkan.`, 
          quoted: msg 
        });
        delete SESSIONS_JPM[sessionKey];
        return true;
      }
      
      await sock.sendMessage(jid, { text: '🔄 Mengirim pesan ke seluruh grup...', quoted: msg });
      
      const groups = await sock.groupFetchAllParticipating();
      const delay = loadDelay();
      const banned = loadBan();
      
      const successGroups = [];
      const failedGroups = [];
      let processed = 0;
      const totalToSend = Object.keys(groups).length - banned.length;
      
      // PROGRESS REPORTING
      const progressMessage = await sock.sendMessage(jid, { 
        text: `⏳ Progress: 0/${totalToSend} grup (0%)` 
      });
      
      for (const gid in groups) {
        if (banned.includes(gid)) continue;
        
        processed++;
        
        // Update progress setiap 10 grup atau 25%
        if (processed % 10 === 0 || processed === totalToSend) {
          const percentage = Math.round(processed/totalToSend*100);
          try {
            await sock.sendMessage(jid, { 
              text: `⏳ Progress: ${processed}/${totalToSend} grup (${percentage}%)` 
            });
          } catch (e) {
            // Ignore progress update errors
          }
        }
        
        const result = await sendWithRetry(sock, gid, pesan);
        
        if (result.success) {
          successGroups.push({
            gid: gid,
            name: groups[gid]?.subject || 'Unknown',
            attempt: result.attempt
          });
        } else {
          failedGroups.push({
            gid: gid,
            name: groups[gid]?.subject || 'Unknown',
            error: result.error,
            attempt: result.attempt
          });
        }
        
        // Delay antar pengiriman (kecuali untuk grup terakhir)
        if (processed < totalToSend) {
          await sleep(delay * 1000);
        }
      }
      
      delete SESSIONS_JPM[sessionKey];
      
      // ENHANCED REPORTING
      let report = `✅ **JPM SELESAI**\n\n`;
      report += `📤 Berhasil: ${successGroups.length} grup\n`;
      report += `❌ Gagal: ${failedGroups.length} grup\n`;
      report += `📊 Total: ${Object.keys(groups).length} grup\n`;
      report += `🚫 Blacklist: ${banned.length} grup\n`;
      report += `⏱️ Delay: ${delay} detik\n`;
      report += `🔄 Retry: ${RETRY_ATTEMPTS}x\n`;
      report += `📝 Panjang: ${pesan.length} karakter`;
      
      if (failedGroups.length > 0) {
        report += `\n\n⚠️ *Grup yang gagal (${Math.min(failedGroups.length, 5)} dari ${failedGroups.length}):*\n`;
        failedGroups.slice(0, 5).forEach((fail, idx) => {
          report += `${idx + 1}. ${fail.name}\n`;
        });
        if (failedGroups.length > 5) {
          report += `... dan ${failedGroups.length - 5} grup lainnya\n`;
        }
        
        // Analisis failure rate
        const failureRate = (failedGroups.length / totalToSend * 100).toFixed(1);
        report += `\n📉 Failure Rate: ${failureRate}%`;
        
        if (failureRate > 30) {
          report += `\n💡 *Saran:* Kurangi panjang pesan atau tingkatkan delay`;
        }
      }
      
      if (successGroups.some(g => g.attempt > 1)) {
        const retriedCount = successGroups.filter(g => g.attempt > 1).length;
        report += `\n\n🔄 ${retriedCount} grup berhasil setelah retry`;
      }
      
      await sock.sendMessage(jid, { text: report, quoted: msg });
      
      logAction('JPM_COMPLETED', {
        jid: jid,
        groups: { 
          sent: successGroups.length, 
          failed: failedGroups.length,
          total: Object.keys(groups).length,
          banned: banned.length
        },
        failed_details: failedGroups,
        success_with_retry: successGroups.filter(g => g.attempt > 1).length,
        messageLength: pesan.length,
        delay: delay,
        failure_rate: (failedGroups.length / totalToSend * 100).toFixed(1)
      });
      
      return true;
    }

    // Safety check lagi
    if (!SESSIONS_JPM[sessionKey]) return false;

    // Validasi input
    if (!text || text.length > 5000) {
      await sock.sendMessage(jid, { text: '❌ Pesan terlalu panjang (max 2000 karakter per baris) atau kosong.' });
      return true;
    }

    SESSIONS_JPM[sessionKey].lines.push(text);
    await sock.sendMessage(jid, {
      text: `📝 Baris ke-${SESSIONS_JPM[sessionKey].lines.length} ditambahkan.\n\nBaris berikut?:\n• /done → Selesai & kirim\n• /preview → Lihat preview\n• /b → Batalkan`
    }, { quoted: msg });
    
    return true;
  }

  // === SET DELAY ===
  if (/^\/delayjpm$/i.test(text)) {
    SESSIONS_JPM[sessionKey] = {
      mode: 'delay',
      createdAt: Date.now()
    };
    await sock.sendMessage(jid, { text: '⏱️ Masukkan delay antar grup (detik, 0-60):' }, { quoted: msg });
    return true;
  }
  
  if (SESSIONS_JPM[sessionKey]?.mode === 'delay') {
    const delay = Number(text);
    if (isNaN(delay) || delay < 0 || delay > 60) {
      await sock.sendMessage(jid, { text: '❌ Delay harus angka 0-60 detik.' }, { quoted: msg });
      return true;
    }
    
    saveDelay(delay);
    await sock.sendMessage(jid, { text: `✅ Delay JPM diatur ke ${delay} detik.`, quoted: msg });
    logAction('DELAY_SET', { jid: jid, delay: delay });
    delete SESSIONS_JPM[sessionKey];
    return true;
  }

  // === BAN GC (Blacklist Group) ===
  if (/^\/bangc$/i.test(text)) {
    const groups = await sock.groupFetchAllParticipating();
    const list = Object.values(groups).map((v, i) => `${i+1}. ${v.subject}`);
    
    if (!list.length) {
      await sock.sendMessage(jid, { text: '❌ Bot belum masuk grup manapun.', quoted: msg });
      return true;
    }
    
    SESSIONS_JPM[sessionKey] = {
      mode: 'ban',
      groupList: Object.keys(groups),
      groupName: Object.values(groups).map(v => v.subject),
      createdAt: Date.now()
    };
    
    let teks = '📋 **DAFTAR GRUP UNTUK BLACKLIST:**\n\n';
    list.forEach(x => teks += x + '\n');
    teks += '\n🔢 Balas angka grup untuk MENAMBAH ke blacklist JPM\n❌ Balas 0 untuk membatalkan\n\n';
    
    const banned = loadBan();
    if (banned.length > 0) {
      teks += `🚫 **Blacklist Saat Ini:**\n`;
      banned.forEach((gid, i) => {
        const groupName = groups[gid]?.subject || gid;
        teks += `${i+1}. ${groupName}\n`;
      });
      teks += `\nGunakan /unbangc untuk menghapus dari blacklist\n`;
    }
    
    await sock.sendMessage(jid, { text: teks }, { quoted: msg });
    logAction('BAN_MENU_OPENED', { jid: jid, totalGroups: list.length });
    return true;
  }
  
  if (SESSIONS_JPM[sessionKey]?.mode === 'ban') {
    const groupList = SESSIONS_JPM[sessionKey].groupList;
    const groupName = SESSIONS_JPM[sessionKey].groupName;
    
    if (text === '0') {
      delete SESSIONS_JPM[sessionKey];
      await sock.sendMessage(jid, { text: '❌ Proses blacklist dibatalkan.', quoted: msg });
      return true;
    }
    
    const num = Number(text);
    if (isNaN(num) || num < 1 || num > groupList.length) {
      await sock.sendMessage(jid, { text: '❌ Masukkan nomor grup yang valid (1-' + groupList.length + ') atau 0 untuk batal.', quoted: msg });
      return true;
    }
    
    const ban = loadBan();
    const targetGid = groupList[num-1];
    
    if (!ban.includes(targetGid)) {
      ban.push(targetGid);
      saveBan(ban);
      await sock.sendMessage(jid, { text: `✅ Grup "*${groupName[num-1]}*" ditambahkan ke blacklist JPM.\n\nGunakan /unbangc untuk mengelola blacklist.`, quoted: msg });
      logAction('GROUP_BANNED', { jid: jid, groupId: targetGid, groupName: groupName[num-1] });
    } else {
      await sock.sendMessage(jid, { text: `ℹ️ Grup "*${groupName[num-1]}*" sudah ada di blacklist.`, quoted: msg });
    }
    
    delete SESSIONS_JPM[sessionKey];
    return true;
  }

  // === UNBAN GC (Hapus dari Blacklist) ===
  if (/^\/unbangc$/i.test(text)) {
    const banned = loadBan();
    const groups = await sock.groupFetchAllParticipating();
    
    if (!banned.length) {
      await sock.sendMessage(jid, { text: '✅ Tidak ada grup di blacklist.', quoted: msg });
      return true;
    }
    
    let list = '📋 **DAFTAR GRUP BLACKLISTED:**\n\n';
    const bannedGroups = [];
    
    banned.forEach((gid, index) => {
      const groupName = groups[gid]?.subject || gid;
      list += `${index + 1}. ${groupName}\n`;
      bannedGroups.push({ gid, name: groupName });
    });
    
    list += '\n🔢 Balas angka untuk HAPUS dari blacklist\n❌ Balas 0 untuk batal';
    
    SESSIONS_JPM[sessionKey] = {
      mode: 'unban',
      bannedList: banned,
      bannedGroups: bannedGroups,
      createdAt: Date.now()
    };
    
    await sock.sendMessage(jid, { text: list }, { quoted: msg });
    logAction('UNBAN_MENU_OPENED', { jid: jid, bannedCount: banned.length });
    return true;
  }
  
  if (SESSIONS_JPM[sessionKey]?.mode === 'unban') {
    const banned = SESSIONS_JPM[sessionKey].bannedList;
    const bannedGroups = SESSIONS_JPM[sessionKey].bannedGroups;
    
    if (text === '0') {
      delete SESSIONS_JPM[sessionKey];
      await sock.sendMessage(jid, { text: '❌ Proses unban dibatalkan.', quoted: msg });
      return true;
    }
    
    const num = Number(text);
    if (isNaN(num) || num < 1 || num > banned.length) {
      await sock.sendMessage(jid, { text: '❌ Masukkan nomor yang valid (1-' + banned.length + ') atau 0 untuk batal.', quoted: msg });
      return true;
    }
    
    const unbannedGid = banned[num-1];
    const unbannedName = bannedGroups[num-1].name;
    
    const newBanList = banned.filter(gid => gid !== unbannedGid);
    saveBan(newBanList);
    
    await sock.sendMessage(jid, { text: `✅ Grup "*${unbannedName}*" dihapus dari blacklist.\n\nSekarang bisa menerima broadcast JPM.`, quoted: msg });
    logAction('GROUP_UNBANNED', { jid: jid, groupId: unbannedGid, groupName: unbannedName });
    
    delete SESSIONS_JPM[sessionKey];
    return true;
  }

  return false;
};
