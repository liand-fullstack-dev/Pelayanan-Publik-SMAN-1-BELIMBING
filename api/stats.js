// api/stats.js
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join('/tmp', 'appointments.json');

module.exports = (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    let appointments = [];
    try {
        if (fs.existsSync(DATA_FILE)) {
            appointments = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        }
    } catch (e) {
        appointments = [];
    }

    const today = new Date().toISOString().split('T')[0];
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const monthStart = new Date();
    monthStart.setDate(1);

    res.status(200).json({
        total: appointments.length,
        today: appointments.filter(a => a.tanggal === today && a.status !== 'Dibatalkan').length,
        week: appointments.filter(a => new Date(a.tanggal) >= weekStart && a.status !== 'Dibatalkan').length,
        month: appointments.filter(a => new Date(a.tanggal) >= monthStart && a.status !== 'Dibatalkan').length,
        done: appointments.filter(a => a.status === 'Selesai').length,
        waiting: appointments.filter(a => a.status === 'Menunggu Konfirmasi').length,
        cancelled: appointments.filter(a => a.status === 'Dibatalkan').length
    });
};

