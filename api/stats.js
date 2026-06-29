const fs = require('fs');
const path = require('path');

const filePath = path.join('/tmp', 'appointments.json');

module.exports = function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        let appointments = [];
        if (fs.existsSync(filePath)) {
            appointments = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }

        const today = new Date().toISOString().split('T')[0];
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const monthStart = new Date();
        monthStart.setDate(1);

        res.json({
            total: appointments.length,
            today: appointments.filter(a => a.tanggal === today && a.status !== 'Dibatalkan').length,
            week: appointments.filter(a => new Date(a.tanggal) >= weekStart && a.status !== 'Dibatalkan').length,
            month: appointments.filter(a => new Date(a.tanggal) >= monthStart && a.status !== 'Dibatalkan').length,
            done: appointments.filter(a => a.status === 'Selesai').length,
            waiting: appointments.filter(a => a.status === 'Menunggu Konfirmasi').length,
            cancelled: appointments.filter(a => a.status === 'Dibatalkan').length
        });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
};

