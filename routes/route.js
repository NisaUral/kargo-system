const express = require('express');
const db = require('../db/connection');
const { verifyToken } = require('../middleware/auth');
const { calculateRoutes } = require('../controllers/routeController');
const router = express.Router();

// POST /api/routes/calculate
router.post('/calculate', verifyToken, calculateRoutes);

// GET /api/routes/all - Tüm rotaları getir
router.get('/all', verifyToken, async (req, res) => {
  try {
    const [user] = await db.query('SELECT role FROM users WHERE id = ?', [req.userId]);
    
    if (user[0]?.role !== 'admin') {
      return res.status(403).json({ error: 'Sadece admin erişebilir!' });
    }

    const [routes] = await db.query(`
      SELECT 
        r.id,
        r.vehicle_id,
        r.total_distance_km,
        r.total_weight_kg,
        r.total_cost,
        GROUP_CONCAT(DISTINCT cr.station_id ORDER BY cr.id) as stations,
        GROUP_CONCAT(DISTINCT u.name SEPARATOR ', ') as user_names
      FROM routes r
      INNER JOIN shipments s ON r.id = s.route_id
      INNER JOIN cargo_requests cr ON s.cargo_request_id = cr.id
      INNER JOIN users u ON cr.user_id = u.id
      GROUP BY r.id, r.vehicle_id
      ORDER BY r.id
    `);

    const formattedRoutes = routes.map(route => ({
      id: route.id,
      vehicleId: route.vehicle_id,
      totalDistance: route.total_distance_km,
      totalWeight: route.total_weight_kg,
      totalCost: route.total_cost,
      stations: route.stations ? route.stations.split(',').map(s => parseInt(s)) : [],
      users: route.user_names ? route.user_names.split(', ') : []
    }));

    res.json({ success: true, routes: formattedRoutes });

  } catch (error) {
    console.error('Get all routes error:', error);
    res.status(500).json({ error: 'Rotalar getirilemedi!' });
  }
});

module.exports = router;