const db = require('../db/connection');

// POST - Kullanıcı kargo gönderme
const sendCargo = async (req, res) => {
  try {
    const { station_id, cargo_count, cargo_weight_kg } = req.body;
    const user_id = req.userId; // JWT'den geliyor

    // Validation
    if (!station_id || !cargo_count || !cargo_weight_kg) {
      return res.status(400).json({ error: 'Tüm alanlar gerekli!' });
    }

    // İstasyonu kontrol et
    const [station] = await db.query(
      'SELECT id FROM stations WHERE id = ?',
      [station_id]
    );

    if (station.length === 0) {
      return res.status(404).json({ error: 'İstasyon bulunamadı!' });
    }

    // Kargo talebini ekle
    const [result] = await db.query(
      `INSERT INTO cargo_requests 
       (user_id, station_id, cargo_count, cargo_weight_kg, status) 
       VALUES (?, ?, ?, ?, 'pending')`,
      [user_id, station_id, parseInt(cargo_count), parseInt(cargo_weight_kg),'pending']
    );

    res.status(201).json({
      message: 'Kargo talebiniz alındı!',
      cargo_id: result.insertId,
      status: 'pending'
    });

  } catch (error) {
    console.error('Send cargo error:', error);
    res.status(500).json({ error: 'Kargo gönderilemedi!' });
  }
};

// GET - Kullanıcının kargo isteklerini getir
const getUserCargo = async (req, res) => {
  try {
    const user_id = req.userId;

    const [cargos] = await db.query(
      `SELECT 
        cr.id,
        cr.station_id,
        s.name as station_name,
        cr.cargo_count,
        cr.cargo_weight_kg,
        cr.status,
        cr.created_at
       FROM cargo_requests cr
       JOIN stations s ON cr.station_id = s.id
       WHERE cr.user_id = ?
       ORDER BY cr.created_at DESC`,
      [user_id]
    );

    res.json({
      success: true,
      count: cargos.length,
      data: cargos
    });

  } catch (error) {
    console.error('Get cargo error:', error);
    res.status(500).json({ error: 'Kargolar getirilemedi!' });
  }
};

// GET - Kargo durumunu getir
const getCargoStatus = async (req, res) => {
  try {
    const { cargo_id } = req.params;

    const [cargo] = await db.query(
      `SELECT 
        cr.id,
        cr.status,
        cr.cargo_count,
        cr.cargo_weight_kg,
        s.name as station_name,
        cr.created_at,
        s.shipment_id,
        v.name as vehicle_name
       FROM cargo_requests cr
       JOIN stations s ON cr.station_id = s.id
       LEFT JOIN shipments s ON cr.id = s.cargo_request_id
       LEFT JOIN vehicles v ON s.vehicle_id = v.id
       WHERE cr.id = ?`,
      [cargo_id]
    );

    if (cargo.length === 0) {
      return res.status(404).json({ error: 'Kargo bulunamadı!' });
    }

    res.json({
      success: true,
      data: cargo[0]
    });

  } catch (error) {
    console.error('Get cargo status error:', error);
    res.status(500).json({ error: 'Kargo durumu getirilemedi!' });
  }
};

module.exports = { sendCargo, getUserCargo, getCargoStatus };