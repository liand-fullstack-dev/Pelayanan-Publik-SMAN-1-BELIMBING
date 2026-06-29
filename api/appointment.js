// api/appointments.js
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join('/tmp', 'appointments.json');

function readData() {
    try {
        if (!fs.existsSync(DATA_FILE)) return [];
        return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (e) {
        return [];
    }
}

function writeData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

module.exports = (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method === 'GET') {
        const appointments = readData();
        return res.status(200).json(appointments);
    }

    if (req.method === 'POST') {
        const appointments = readData();
        
        const newAppointment = {
            ...req.body,
            id: 'apt-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
            status: 'Menunggu Konfirmasi',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        const existingCount = appointments.filter(a => a.status !== 'Dibatalkan').length;
        newAppointment.nomorAntrian = 'A-' + String(existingCount + 1).padStart(3, '0');

        appointments.push(newAppointment);
        writeData(appointments);

        return res.status(201).json({ success: true, data: newAppointment });
    }

    res.status(405).json({ error: 'Method not allowed' });
};

