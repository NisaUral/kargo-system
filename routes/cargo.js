const express = require('express');
const db = require('../db/connection');
const { sendCargo, getUserCargo, getCargoStatus } = require('../controllers/cargoController');
const { verifyToken } = require('../middleware/auth');
const router = express.Router();

// POST /api/cargo/send - Kargo gönder
router.post('/send', verifyToken, sendCargo);

// GET /api/cargo/my-cargos - Kullanıcının kargolarını getir
router.get('/my-cargos', verifyToken, getUserCargo);

// GET /api/cargo/status/:cargo_id - Kargo durumunu getir
router.get('/status/:cargo_id', verifyToken, getCargoStatus);

// GET /api/cargo/route/:cargoId - User'ın kargosunun rotasını getir
router.get('/route/:cargoId', verifyToken, async (req, res) => {
  try {
    const { cargoId } = req.params;
    const userId = req.userId;

    // Kargo'ya ait olup olmadığını kontrol et
    const [cargo] = await db.query(
      'SELECT * FROM cargo_requests WHERE id = ? AND user_id = ?',
      [cargoId, userId]
    );

    if (cargo.length === 0) {
      return res.status(403).json({ error: 'Bu kargoya erişim yok!' });
    }

    // Kargo'nun atandığı rotayı bul
    const [shipment] = await db.query(
      'SELECT route_id, vehicle_id FROM shipments WHERE cargo_request_id = ?',
      [cargoId]
    );

    if (shipment.length === 0) {
      return res.json({ message: 'Kargo henüz rotaya atanmadı', route: null });
    }

    // Route'u getir
    const [route] = await db.query(
      'SELECT * FROM routes WHERE id = ?',
      [shipment[0].route_id]
    );

    if (route.length === 0) {
      return res.json({ message: 'Rota bulunamadı', route: null });
    }

    // Aynı rotadaki tüm istasyonları getir (stations olarak)
    const [routeStations] = await db.query(
      `SELECT DISTINCT cr.station_id FROM cargo_requests cr
       INNER JOIN shipments s ON cr.id = s.cargo_request_id
       WHERE s.route_id = ?
       ORDER BY cr.station_id`,
      [shipment[0].route_id]
    );

    // Stations array'ini oluştur
    const stations_array = [
      ...routeStations.map(r => r.station_id),
      13 // Üniversite ekle
    ];

    res.json({ 
      success: true, 
      route: {
        id: route[0].id,
        vehicle_id: route[0].vehicle_id,
        total_distance_km: route[0].total_distance_km,
        total_weight_kg: route[0].total_weight_kg,
        fuel_cost: route[0].fuel_cost,
        distance_cost: route[0].distance_cost,
        total_cost: route[0].total_cost,
        stations: stations_array
      }
    });

  } catch (error) {
    console.error('Get cargo route error:', error);
    res.status(500).json({ error: 'Rota getirilemedi!' });
  }
});

module.exports = router;