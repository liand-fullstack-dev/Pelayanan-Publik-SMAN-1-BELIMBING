// api/index.js
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const DATA_FILE = path.join('/tmp', 'appointments.json');

function readData() {
    try {
        if (!fs.existsSync(DATA_FILE)) return [];
        return JSON.parse(fs.readFile        return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (e) {
        return [];
    }
}

function writeData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// API Routes
app.get('/api/appointments', (req, res) => {
    res.json(readData());
});

app.post('/api/appointments', (req, res) => {
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

    res.status(201).json({ success: true, data: newAppointment });
});

app.get('/api/stats', (req, res) => {
    const appointments = readData();
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
});

module.exports = app;
