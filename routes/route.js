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
    r.vehicle_id as vehicleId,
    r.total_distance_km as totalDistance,
    r.total_weight_kg as totalWeight,
    r.total_cost as totalCost,
    r.stations,
    GROUP_CONCAT(DISTINCT u.name) as users
  FROM routes r
  LEFT JOIN shipments s ON r.id = s.route_id
  LEFT JOIN cargo_requests cr ON s.cargo_request_id = cr.id
  LEFT JOIN users u ON cr.user_id = u.id
  GROUP BY r.id, r.vehicle_id, r.stations, r.total_distance_km, r.total_weight_kg, r.total_cost
  ORDER BY r.id DESC
`);

    const formattedRoutes = routes.map(route => ({
  id: route.id,
  vehicleId: route.vehicle_id,
  totalDistance: route.totalDistance,
  totalWeight: route.totalWeight,
  totalCost: route.totalCost,
  stations: route.stations 
    ? route.stations.split(',').map(s => parseInt(s))  // 👈 STRING'I ARRAY'E ÇEVİR
    : [],
  users: route.users ? route.users.split(',') : []
}));

res.json({
  success: true,
  routes: formattedRoutes
});

  } catch (error) {
    console.error('Get all routes error:', error);
    res.status(500).json({ error: 'Rotalar getirilemedi!' });
  }
});

module.exports = router;