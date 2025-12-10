require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

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