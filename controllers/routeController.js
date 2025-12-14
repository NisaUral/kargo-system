const db = require('../db/connection');
const UnlimitedVehicleVRP = require('../algorithms/vrpUnlimited');
const FixedVehicleVRP = require('../algorithms/vrpFixed');

// Rota hesapla
const calculateRoutes = async (req, res) => {
  try {
    const { problem_type } = req.body;

    // Tüm istasyonları getir
    const [stations] = await db.query(
      'SELECT id, name, latitude, longitude FROM stations ORDER BY id'
    );

    // Tüm araçları getir
    const [vehicles] = await db.query(
      'SELECT id, name, capacity_kg, fuel_consumption, rental_cost FROM vehicles WHERE status = "active"'
    );

    // Bekleyen kargo isteklerini getir
    const [cargos] = await db.query(
      `SELECT cr.station_id, SUM(cr.cargo_count) as cargo_count, SUM(cr.cargo_weight_kg) as cargo_weight_kg
       FROM cargo_requests cr
       WHERE cr.status = 'pending'
       GROUP BY cr.station_id`
    );

    // Kargo verisini düzenle
    const cargoByStation = {};
    cargos.forEach(cargo => {
      cargoByStation[cargo.station_id] = {
        totalCount: cargo.cargo_count,
        totalWeight: cargo.cargo_weight_kg,
        station: stations.find(s => s.id === cargo.station_id)
      };
    });
   
    // Eğer kargo yoksa
    if (Object.keys(cargoByStation).length === 0) {
      return res.json({
        message: 'Yönlendirilecek kargo yok',
        routes: [],
        totalCost: 0
      });
    }

    // Maliyet parametreleri
    const costs = {
      fuel_price_per_liter: 1,
      km_cost: 1,
      rental_cost_new_vehicle: 200,
      rental_capacity: 500
    };

    let result;

    if (problem_type === 'unlimited') {
      const vrp = new UnlimitedVehicleVRP(stations, vehicles, cargoByStation, costs);
      result = vrp.solve();
    } else {
      const vrp = new FixedVehicleVRP(stations, vehicles, cargoByStation, costs);
      result = vrp.solve();
    }

    // Rotaları ve kargo atamalarını database'e kaydet
   // Rotaları ve kargo atamalarını database'e kaydet
for (const route of result.routes) {
  console.log(`📍 Inserting route - vehicleId: ${route.vehicleId}, stations: ${route.stations.join(',')}, weight: ${route.totalWeight}`);
  
  // ÖNEMLİ: Üniversiteyi de ekle!
  const stationsWithUniversity = route.stations.includes(0) 
    ? route.stations 
    : [...route.stations, 0]; // 0 = University
  
  const [routeResult] = await db.query(
    `INSERT INTO routes (vehicle_id, total_distance_km, total_weight_kg, fuel_cost, distance_cost, total_cost, stations) 
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      route.vehicleId,
      parseFloat(route.totalDistance),
      route.totalWeight,
      parseFloat(route.fuelCost),
      parseFloat(route.distanceCost),
      parseFloat(route.totalCost),
      stationsWithUniversity.join(',')  
    ]
  );

  console.log(`✅ Route inserted with ID: ${routeResult.insertId}, vehicle_id: ${route.vehicleId}`);
  const routeId = routeResult.insertId;
 
      // Her istasyondaki kargo'ları shipments'e ekle
      for (const stationId of route.stations) {
        if (stationId === 13) continue; // Üniversite, atla
        
        const [cargosAtStation] = await db.query(
          `SELECT id FROM cargo_requests 
           WHERE station_id = ? AND status = 'pending'`,
          [stationId]
        );

        // Kargo'ları bu rotaya ata
        for (const cargo of cargosAtStation) {
          await db.query(
            `INSERT INTO shipments (cargo_request_id, route_id, vehicle_id, assigned_at)
             VALUES (?, ?, ?, NOW())`,
            [cargo.id, routeId, route.vehicleId]
          );

          // Kargo statusunu güncelle
          await db.query(
            `UPDATE cargo_requests SET status = 'assigned' WHERE id = ?`,
            [cargo.id]
          );
        }
      }
    }

    res.json({
      success: true,
      problem_type: problem_type || 'fixed',
      ...result
    });

  } catch (error) {
    console.error('Calculate routes error:', error);
    res.status(500).json({ error: 'Rota hesaplanamadı!' });
  }
};
// Tüm rotaları getir (Admin için)
const getAllRoutes = async (req, res) => {
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
      GROUP BY r.id
      ORDER BY r.id DESC
    `);

    const formattedRoutes = routes.map(route => ({
      id: route.id,
      vehicleId: route.vehicleId,
      totalDistance: route.totalDistance,
      totalWeight: route.totalWeight,
      totalCost: route.totalCost,
      stations: route.stations 
        ? route.stations.split(',').map(s => parseInt(s))
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
};

// User'ın kargolarının rotasını getir
const getMyRoutes = async (req, res) => {
  try {
    const userId = req.userId;

    const [userCargos] = await db.query(`
      SELECT DISTINCT 
        cr.id,
        cr.station_id,
        s.route_id
      FROM cargo_requests cr
      LEFT JOIN shipments s ON cr.id = s.cargo_request_id
      WHERE cr.user_id = ? AND s.route_id IS NOT NULL
      ORDER BY s.route_id
    `, [userId]);

    if (userCargos.length === 0) {
      return res.json({
        success: true,
        routes: []
      });
    }

    const routeIds = [...new Set(userCargos.map(c => c.route_id))];
    const routes = [];

    for (const routeId of routeIds) {
      const [route] = await db.query(`
        SELECT 
          r.id,
          r.vehicle_id,
          r.stations,
          r.total_distance_km as totalDistance,
          r.total_weight_kg as totalWeight,
          r.total_cost as totalCost
        FROM routes r
        WHERE r.id = ?
      `, [routeId]);

      if (!route[0]) continue;

      const userStationIds = userCargos
        .filter(c => c.route_id === routeId)
        .map(c => c.station_id);

      const allStations = route[0].stations
        ? route[0].stations.split(',').map(s => parseInt(s))
        : [];

      const firstUserStationIdx = allStations.findIndex(s => 
        userStationIds.includes(parseInt(s))
      );

      const lastUserStationIdx = allStations
        .slice(0, -1)
        .findLastIndex(s => userStationIds.includes(parseInt(s)));

      const partialRoute = firstUserStationIdx >= 0 && lastUserStationIdx >= 0
        ? [
            ...allStations.slice(firstUserStationIdx, lastUserStationIdx + 1),
            0
          ]
        : [0];

      routes.push({
        id: route[0].id,
        vehicleId: route[0].vehicle_id,
        userStations: partialRoute,
        totalDistance: route[0].totalDistance,
        totalWeight: route[0].totalWeight,
        totalCost: route[0].totalCost
      });
    }

    res.json({
      success: true,
      routes: routes
    });

  } catch (error) {
    console.error('Get my routes error:', error);
    res.status(500).json({ error: 'Rotalar getirilemedi!' });
  }
};

// İstasyon ekle
// İstasyon ekle
const addStation = async (req, res) => {
  try {
    // ✅ Admin kontrolü ekle
    const [user] = await db.query('SELECT role FROM users WHERE id = ?', [req.userId]);
    
    if (user[0]?.role !== 'admin') {
      return res.status(403).json({ error: 'Sadece admin erişebilir!' });
    }

    const { name, latitude, longitude } = req.body;

    if (!name || !latitude || !longitude) {
      return res.status(400).json({ error: 'Tüm alanları doldurunuz!' });
    }

    const [result] = await db.query(
      'INSERT INTO stations (name, latitude, longitude) VALUES (?, ?, ?)',
      [name, parseFloat(latitude), parseFloat(longitude)]
    );

    res.json({
      success: true,
      message: 'İstasyon başarıyla eklendi!',
      station: { id: result.insertId, name, latitude, longitude }
    });
  } catch (error) {
    console.error('Add station error:', error);
    res.status(500).json({ error: 'İstasyon eklenemedi!' });
  }
};

// Araç kirala
const rentVehicle = async (req, res) => {
  try {
    // ✅ Admin kontrolü ekle
    const [user] = await db.query('SELECT role FROM users WHERE id = ?', [req.userId]);
    
    if (user[0]?.role !== 'admin') {
      return res.status(403).json({ error: 'Sadece admin erişebilir!' });
    }

    const { name, capacity_kg, rental_cost } = req.body;

    if (!name || !capacity_kg) {
      return res.status(400).json({ error: 'Tüm alanları doldurunuz!' });
    }

   const [result] = await db.query(
  'INSERT INTO vehicles (name, capacity_kg, rental_cost, status) VALUES (?, ?, ?, ?)',
  [name, parseInt(capacity_kg), parseInt(rental_cost) || 200, 'active']
);

    res.json({
      success: true,
      message: 'Araç başarıyla kiralandı!',
      vehicle: { id: result.insertId, name, capacity_kg, rental_cost }
    });
  } catch (error) {
    console.error('Rent vehicle error:', error);
    res.status(500).json({ error: 'Araç kiralama başarısız!' });
  }
};
// İstasyon sil
const deleteStation = async (req, res) => {
  try {
    const [user] = await db.query('SELECT role FROM users WHERE id = ?', [req.userId]);
    
    if (user[0]?.role !== 'admin') {
      return res.status(403).json({ error: 'Sadece admin erişebilir!' });
    }

    const { stationId } = req.params;

    await db.query('DELETE FROM stations WHERE id = ?', [stationId]);

    res.json({
      success: true,
      message: 'İstasyon başarıyla silindi!'
    });
  } catch (error) {
    console.error('Delete station error:', error);
    res.status(500).json({ error: 'İstasyon silinemedi!' });
  }
};

// Araç sil
const deleteVehicle = async (req, res) => {
  try {
    const [user] = await db.query('SELECT role FROM users WHERE id = ?', [req.userId]);
    
    if (user[0]?.role !== 'admin') {
      return res.status(403).json({ error: 'Sadece admin erişebilir!' });
    }

    const { vehicleId } = req.params;

    await db.query('DELETE FROM vehicles WHERE id = ?', [vehicleId]);

    res.json({
      success: true,
      message: 'Araç başarıyla silindi!'
    });
  } catch (error) {
    console.error('Delete vehicle error:', error);
    res.status(500).json({ error: 'Araç silinemedi!' });
  }
};

module.exports = { calculateRoutes, getAllRoutes, getMyRoutes, addStation, rentVehicle, deleteStation, deleteVehicle };





