const os = require('os');
const v8 = require('v8');
const { performance } = require('perf_hooks');
const axios = require('axios');

const formatSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const runtime = (seconds) => {
    seconds = Number(seconds);
    var d = Math.floor(seconds / (3600 * 24));
    var h = Math.floor(seconds % (3600 * 24) / 3600);
    var m = Math.floor(seconds % 3600 / 60);
    var s = Math.floor(seconds % 60);
    return (d > 0 ? d + "d " : "") + (h > 0 ? h + "h " : "") + (m > 0 ? m + "m " : "") + (s > 0 ? s + "s" : "");
};

const hideIp = (ip) => {
    if (!ip) return 'N/A';
    const parts = ip.split('.');
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.***.***`;
    return ip;
};

module.exports = {
    trigger: 'ping',
    execute: async (sock, m, args) => {
        const remoteJid = m.key.remoteJid;

        await sock.sendMessage(remoteJid, { react: { text: '💻', key: m.key } });

        let oldTimestamp = performance.now();
        
        const used = process.memoryUsage();
        const cpus = os.cpus().map(cpu => {
            cpu.total = Object.keys(cpu.times).reduce((last, type) => last + cpu.times[type], 0);
            return cpu;
        });

        const cpu = cpus.reduce((last, cpu, _, { length }) => {
            last.total += cpu.total;
            last.speed += cpu.speed / length;
            last.times.user += cpu.times.user;
            last.times.nice += cpu.times.nice;
            last.times.sys += cpu.times.sys;
            last.times.idle += cpu.times.idle;
            last.times.irq += cpu.times.irq;
            return last;
        }, {
            speed: 0, total: 0, times: { user: 0, nice: 0, sys: 0, idle: 0, irq: 0 }
        });

        let heapStat = v8.getHeapStatistics();
        
        let newTimestamp = performance.now();
        let speed = Number(newTimestamp - oldTimestamp).toFixed(2);

        let myip = { ip: 'N/A', region: 'N/A', country: 'N/A', org: 'N/A' };
        try {
            const { data } = await axios.get("https://ipinfo.io/json", { timeout: 5000 });
            myip = data;
        } catch (e) {
            // Silent fail
        }

        const x = "`";
        let teks = `
${x}INFO SERVER${x}
⚡ Speed Respons: _${speed} ms_
💻 Hostname: _${os.hostname()}_
🧠 CPU Core: _${cpus.length} Core_
🖥️ Platform: _${os.platform()} (${os.arch()})_
💿 OS: _${os.version()} / ${os.release()}_
💾 RAM: _${formatSize(os.totalmem() - os.freemem())} / ${formatSize(os.totalmem())}_

${x}PROVIDER INFO${x}
🌐 IP: ${myip.ip}
📍 Region: _${myip.region || 'N/A'}, ${myip.country || 'N/A'}_
🏢 ISP: _${myip.org || 'N/A'}_

${x}RUNTIME${x}
⏱️ OS: _${runtime(os.uptime())}_
🤖 Bot: _${runtime(process.uptime())}_

${x}NODE MEMORY USAGE${x}
${Object.keys(used).map(key => `*- ${key.padEnd(15)}:* ${formatSize(used[key])}`).join("\n")}

${x}V8 HEAP STATISTICS${x}
*- Executable:* ${formatSize(heapStat?.total_heap_size_executable)}
*- Physical:* ${formatSize(heapStat?.total_physical_size)}
*- Available:* ${formatSize(heapStat?.total_available_size)}
*- Limit:* ${formatSize(heapStat?.heap_size_limit)}
*- Malloced:* ${formatSize(heapStat?.malloced_memory)}

${cpus[0] ? `
${x}CPU USAGE (${cpus.length} Core)${x}
${cpus[0].model.trim()} (${cpu.speed} MHZ)
${Object.keys(cpu.times).map(type => `*- ${type.padEnd(6)}:* ${((100 * cpu.times[type]) / cpu.total).toFixed(2)}%`).join('\n')}
` : ''}
`.trim();

        await sock.sendMessage(remoteJid, { text: teks }, { quoted: m });
        
        await sock.sendMessage(remoteJid, { react: { text: '✅', key: m.key } });
    }
};
