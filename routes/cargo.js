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
// GET /api/cargo/route/:cargoId - User'ın kargosunun rotasını getir
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
    const shipments = await db.query(
      'SELECT route_id, vehicle_id FROM shipments WHERE cargo_request_id = ?',
      [cargoId]
    );

    // ✅ Array'i düzgün destructure et
    if (!shipments || shipments.length === 0 || shipments[0].length === 0) {
      return res.json({ message: 'Kargo henüz rotaya atanmadı', route: null });
    }

    const shipment = shipments[0][0]; // ✅ İLK KARGO

    // Route'u getir
    const routes = await db.query(
      'SELECT * FROM routes WHERE id = ?',
      [shipment.route_id]
    );

    if (!routes || routes.length === 0 || routes[0].length === 0) {
      return res.json({ message: 'Rota bulunamadı', route: null });
    }

    const route = routes[0][0]; // ✅ İLK ROUTE

    // Aynı rotadaki tüm istasyonları getir
    const routeStations = await db.query(
      `SELECT DISTINCT cr.station_id FROM cargo_requests cr
       INNER JOIN shipments s ON cr.id = s.cargo_request_id
       WHERE s.route_id = ?
       ORDER BY cr.station_id`,
      [shipment.route_id]
    );

    const stations_array = [
      ...(routeStations[0] || []).map(r => r.station_id),
      13 // Üniversite ekle
    ];

    const routeData = {
      id: route.id,
      vehicle_id: route.vehicle_id,
      total_distance_km: route.total_distance_km,
      total_weight_kg: route.total_weight_kg,
      fuel_cost: route.fuel_cost,
      distance_cost: route.distance_cost,
      total_cost: route.total_cost,
      stations: stations_array
    };

    res.json({ 
      success: true, 
      route: routeData
    });

  } catch (error) {
    console.error('Get cargo route error:', error);
    res.status(500).json({ error: 'Rota getirilemedi!' });
  }
});
module.exports = router;