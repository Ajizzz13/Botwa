const fs = require('fs');
const path = require('path');

const muteFile = path.join(__dirname, '../mute_data.json');

// Load Data
const loadMute = () => {
    if (!fs.existsSync(muteFile)) {
        fs.writeFileSync(muteFile, JSON.stringify({}, null, 2));
        return {};
    }
    return JSON.parse(fs.readFileSync(muteFile));
};

// Save Data
const saveMute = (data) => {
    fs.writeFileSync(muteFile, JSON.stringify(data, null, 2));
};

// Add Mute
const addMute = (jid, duration) => {
    const db = loadMute();
    let expiry = null;
    
    if (duration) {
        const match = duration.match(/(\d+)([mhd])/);
        if (match) {
            const val = parseInt(match[1]);
            const unit = match[2];
            const now = Date.now();
            if (unit === 'm') expiry = now + (val * 60 * 1000);
            if (unit === 'h') expiry = now + (val * 60 * 60 * 1000);
            if (unit === 'd') expiry = now + (val * 24 * 60 * 60 * 1000);
        }
    }
    
    db[jid] = { expiry }; // null expiry means permanent
    saveMute(db);
};

// Remove Mute
const removeMute = (jid) => {
    const db = loadMute();
    if (db[jid]) {
        delete db[jid];
        saveMute(db);
        return true;
    }
    return false;
};

// Check is Muted
const isMuted = (jid) => {
    const db = loadMute();
    if (!db[jid]) return false;

    const data = db[jid];
    if (data.expiry && Date.now() > data.expiry) {
        removeMute(jid); // Auto unmute if expired
        return false;
    }
    return true;
};

const getList = () => loadMute();

module.exports = { addMute, removeMute, isMuted, getList };
