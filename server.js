const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.get('/api/appointments', (req, res) => {
    try {
        const filePath = path.join('/tmp', 'appointments.json');
        if (!fs.existsSync(filePath)) return res.json([]);
        const data = fs.readFileSync(filePath, 'utf8');
        res.json(JSON.parse(data));
    } catch (e) {
        res.json([]);
    }
});

app.post('/api/appointments', (req, res) => {
    try {
        const filePath = path.join('/tmp', 'appointments.json');
        let appointments = [];
        
        if (fs.existsSync(filePath)) {
            appointments = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
        
        const newAppointment = {
            ...req.body,
            id: 'apt-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        appointments.push(newAppointment);
        fs.writeFileSync(filePath, JSON.stringify(appointments, null, 2));
        
        res.status(201).json({ success: true, data: newAppointment });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

app.get('/api/stats', (req, res) => {
    try {
        const filePath = path.join('/tmp', 'appointments.json');
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
});

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, message: 'Internal server error' });
});

module.exports = app;

if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Server berjalan di http://localhost:${PORT}`);
    });
}
