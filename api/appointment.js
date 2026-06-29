const fs = require('fs');
const path = require('path');

const filePath = path.join('/tmp', 'appointments.json');

function readAppointments() {
    if (!fs.existsSync(filePath)) return [];
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
        return [];
    }
}

module.exports = function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method === 'GET') {
        return res.json(readAppointments());
    }

    if (req.method === 'POST') {
        try {
            const appointments = readAppointments();
            const newAppointment = {
                ...req.body,
                id: 'apt-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            appointments.push(newAppointment);
            fs.writeFileSync(filePath, JSON.stringify(appointments, null, 2));
            return res.status(201).json({ success: true, data: newAppointment });
        } catch (e) {
            return res.status(500).json({ success: false, message: e.message });
        }
    }

    res.status(405).json({ message: 'Method not allowed' });
};

