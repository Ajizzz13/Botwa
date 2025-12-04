const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../ai_settings.json');

// Load Database
const loadDB = () => {
    if (!fs.existsSync(dbPath)) {
        fs.writeFileSync(dbPath, JSON.stringify({}, null, 2));
        return {};
    }
    return JSON.parse(fs.readFileSync(dbPath));
};

// Save Database
const saveDB = (data) => {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
};

// Get User Model (Default: gpt3)
const getUserModel = (jid) => {
    const db = loadDB();
    return db[jid] || 'gpt3';
};

// Set User Model
const setUserModel = (jid, model) => {
    const db = loadDB();
    db[jid] = model;
    saveDB(db);
};

module.exports = { getUserModel, setUserModel };
