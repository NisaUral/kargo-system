require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const authRoutes =require('./routes/auth')
const stationRoutes = require('./routes/station');
const vehicleRoutes = require('./routes/vehicle');
const cargoRoutes = require('./routes/cargo');
const routeRoutes = require('./routes/route');

const app = express();

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5000'],
  credentials: true
}));app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
// Routes
app.use('/api/auth',authRoutes)
app.use('/api/auth', authRoutes);
app.use('/api/stations', stationRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/cargo', cargoRoutes);
app.use('/api/admin/stations', stationRoutes); // Admin istasyon ekleme
app.use('/api/routes', routeRoutes);

// Static dosyalar
app.use(express.static('public'));

// Test endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'Sunucu çalışıyor! ✓',
    timestamp: new Date().toISOString()
  });
});

// Hata yönetimi
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Bir hata oluştu!' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🚀 Sunucu http://localhost:${PORT} adresinde çalışıyor\n`);
});