const db = require('../db/connection');

// GET - Tüm istasyonları getir
const getAllStations = async (req, res) => {
  try {
    const [stations] = await db.query(
      'SELECT id, name, latitude, longitude FROM stations ORDER BY name'
    );

    res.json({
      success: true,
      count: stations.length,
      data: stations
    });

  } catch (error) {
    console.error('Station error:', error);
    res.status(500).json({ error: 'Istasyonlar getirilemedi!' });
  }
};

// POST - Yeni istasyon ekle (ADMIN)
const addStation = async (req, res) => {
  try {
    const { name, latitude, longitude } = req.body;

    // Validation
    if (!name || !latitude || !longitude) {
      return res.status(400).json({ error: 'Tüm alanlar gerekli!' });
    }

    // Dublicate kontrol
    const [existing] = await db.query(
      'SELECT id FROM stations WHERE name = ?',
      [name]
    );

    if (existing.length > 0) {
      return res.status(409).json({ error: 'Bu istasyon zaten var!' });
    }

    // Ekle
    await db.query(
      'INSERT INTO stations (name, latitude, longitude) VALUES (?, ?, ?)',
      [name, parseFloat(latitude), parseFloat(longitude)]
    );

    res.status(201).json({ 
      message: 'İstasyon başarıyla eklendi!',
      station: { name, latitude, longitude }
    });

  } catch (error) {
    console.error('Add station error:', error);
    res.status(500).json({ error: 'İstasyon eklenirken hata oluştu!' });
  }
};

module.exports = { getAllStations, addStation };