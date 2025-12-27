const db = require('../db/connection');
const UnlimitedVehicleVRP = require('../algorithms/vrpUnlimited');
const FixedVehicleVRP = require('../algorithms/vrpFixed');

// Rota hesapla
const calculateRoutes = async (req, res) => {
  try {
    const { problem_type } = req.body;

    const [stations] = await db.query(
      'SELECT id, name, latitude, longitude FROM stations ORDER BY id'
    );

    const [vehicles] = await db.query(
      'SELECT id, name, capacity_kg, fuel_consumption, rental_cost FROM vehicles WHERE status = "active"'
    );

    const [params] = await db.query('SELECT * FROM parameters WHERE id = 1');
    const minCargoWeight = params[0]?.min_cargo_weight || 5;

    const [cargos] = await db.query(
      `SELECT cr.station_id, SUM(cr.cargo_count) as cargo_count, SUM(cr.cargo_weight_kg) as cargo_weight_kg
       FROM cargo_requests cr
       WHERE cr.status = 'pending'
       GROUP BY cr.station_id`
    );

    const tooLightCargos = [];
    const cargoByStation = {};
    
    cargos.forEach(cargo => {
      if (cargo.cargo_weight_kg < minCargoWeight) {
        tooLightCargos.push({
          station_id: cargo.station_id,
          weight: cargo.cargo_weight_kg,
          count: cargo.cargo_count,
          reason: `Minimum ${minCargoWeight}kg altında (${cargo.cargo_weight_kg}kg)`
        });
        
        console.log(`⚠️ Station ${cargo.station_id}: ${cargo.cargo_weight_kg}kg < ${minCargoWeight}kg (RED!)`);
      } else {
        cargoByStation[cargo.station_id] = {
          totalCount: cargo.cargo_count,
          totalWeight: cargo.cargo_weight_kg,
          station: stations.find(s => s.id === cargo.station_id)
        };
      }
    });

    for (const lightCargo of tooLightCargos) {
      await db.query(
        `UPDATE cargo_requests 
         SET status = 'rejected', rejection_reason = ?
         WHERE station_id = ? AND status = 'pending'`,
        [lightCargo.reason, lightCargo.station_id]
      );
    }

    if (Object.keys(cargoByStation).length === 0) {
      return res.json({
        success: true,
        message: 'Yönlendirilecek uygun ağırlıkta kargo yok',
        routes: [],
        totalCost: 0,
        rejectedCargoByWeight: tooLightCargos,
        minCargoWeight: minCargoWeight
      });
    }

    const costs = {
      fuel_price_per_liter: params[0]?.fuel_price_per_liter || 1,
      km_cost: params[0]?.km_cost || 1,
      rental_cost_new_vehicle: params[0]?.rental_cost_new_vehicle || 200,
      rental_capacity: 500
    };

    let result;
    let vehicleCount = 3;

    if (problem_type === 'unlimited') {
      console.log('[CALC]  UNLIMITED mode');
      const vrp = new UnlimitedVehicleVRP(stations, vehicles, cargoByStation, costs);
      result = vrp.solve();
    } else if (problem_type.startsWith('fixed-')) {
      vehicleCount = parseInt(problem_type.split('-')[1]);
      console.log(`[CALC]  FIXED mode - ${vehicleCount} araç seçildi`);
      
      const selectedVehicles = vehicles.slice(0, vehicleCount);
      
      const vrp = new FixedVehicleVRP(selectedVehicles, stations, cargoByStation, costs);
      const fixedResult = vrp.solve();
      
      console.log(`[CALC]  Fixed hesaplandı: ${fixedResult.routes.length} rota`);
      
      //  Kalan kargolar varsa UnlimitedVRP'ye gönder
      const allStations = Object.keys(cargoByStation).map(id => parseInt(id));
      const assignedStations = [];
      fixedResult.routes.forEach(route => {
        route.stations.forEach(stationId => {
          if (stationId !== 0 && !assignedStations.includes(stationId)) {
            assignedStations.push(stationId);
          }
        });
      });
      
      const unassignedStations = allStations.filter(s => !assignedStations.includes(s));
      
      if (unassignedStations.length > 0) {
        console.log(`[CALC]  ${unassignedStations.length} istasyon kaldı, UnlimitedVRP'ye gönderiliyor...`);
        
        const remainingCargo = {};
        unassignedStations.forEach(stationId => {
          remainingCargo[stationId] = cargoByStation[stationId];
        });
        
        const unlimitedVrp = new UnlimitedVehicleVRP(stations, vehicles, remainingCargo, costs);
        const unlimitedResult = unlimitedVrp.solve();
        
        console.log(`[CALC]  Unlimited hesaplandı: ${unlimitedResult.routes.length} rota, ${unlimitedResult.newVehiclesRented} kiralandı`);
        
        result = {
          routes: [...fixedResult.routes, ...unlimitedResult.routes],
          totalCost: (parseFloat(fixedResult.totalCost) + parseFloat(unlimitedResult.totalCost)).toFixed(2),
          vehiclesUsed: fixedResult.vehiclesUsed + unlimitedResult.vehiclesUsed,
          newVehiclesRented: unlimitedResult.newVehiclesRented,
          rentalVehicles: unlimitedResult.rentalVehicles || [],  // ✅ RENTAL VEHICLES AKTAR
          rejectedCargo: unlimitedResult.rejectedCargo,
          acceptedWeight: fixedResult.acceptedWeight + unlimitedResult.acceptedWeight,
          rejectedWeight: unlimitedResult.rejectedWeight,
          acceptanceRate: 100,
          summary: unlimitedResult.summary
        };
      } else {
        result = fixedResult;
      }
    }

    if (result.rejectedCargo && result.rejectedCargo.length > 0) {
      for (const rejectedItem of result.rejectedCargo) {
        await db.query(
          `UPDATE cargo_requests 
           SET status = 'rejected', rejection_reason = ?
           WHERE station_id = ? AND status = 'pending'`,
          [rejectedItem.reason, rejectedItem.stationId]
        );
      }
    }

    //  Kiralandı araçları kaydet ve ID mapping oluştur
    const vehicleIdMap = {}; // Eski ID (100+) -> Yeni ID mapping
    
    //  VRP'den gelen kiralanan araçları kullan
    const rentalVehicles = result.rentalVehicles || [];
    
    for (const rentalVehicle of rentalVehicles) {
      const [vehicleResult] = await db.query(
        `INSERT INTO vehicles (name, capacity_kg, rental_cost, status) 
         VALUES (?, ?, ?, 'active')`,
        [
          rentalVehicle.name,
          rentalVehicle.capacity_kg,  // ✅ GERÇEK KAPASİTE (kalan kargo kadar veya dinamik)
          rentalVehicle.rental_cost
        ]
      );
      
      const newVehicleId = vehicleResult.insertId;
      const oldVehicleId = rentalVehicle.id; // VRP'de 100, 101, 102...
      vehicleIdMap[oldVehicleId] = newVehicleId;
      
      console.log(`✅ Kiralandı araç kaydedildi: ${rentalVehicle.name} - ${rentalVehicle.capacity_kg}kg kapasite (Old ID=${oldVehicleId} -> New ID=${newVehicleId})`);
    }

    //  Rotaları INSERT et
    for (const route of result.routes) {
      const stationsWithUniversity = route.stations.includes(0) 
        ? route.stations 
        : [...route.stations, 0];
      
      //  Map'den gerçek vehicle ID'sini al
      const realVehicleId = vehicleIdMap[route.vehicleId] || route.vehicleId;
      
      const [routeResult] = await db.query(
        `INSERT INTO routes (vehicle_id, total_distance_km, total_weight_kg, fuel_cost, distance_cost, total_cost, stations) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          realVehicleId,  //  GERÇEK VEHICLE ID
          parseFloat(route.totalDistance),
          route.totalWeight,
          parseFloat(route.fuelCost),
          parseFloat(route.distanceCost),
          parseFloat(route.totalCost),
          stationsWithUniversity.join(',')  
        ]
      );

      const routeId = routeResult.insertId;
   
      for (const stationId of route.stations) {
        if (stationId === 0) continue;
        
        const [cargosAtStation] = await db.query(
          `SELECT id FROM cargo_requests 
           WHERE station_id = ? AND status = 'pending'`,
          [stationId]
        );

        for (const cargo of cargosAtStation) {
          await db.query(
            `INSERT INTO shipments (cargo_request_id, route_id, vehicle_id, assigned_at)
             VALUES (?, ?, ?, NOW())`,
            [cargo.id, routeId, realVehicleId]  //  GERÇEK VEHICLE ID
          );

          await db.query(
            `UPDATE cargo_requests SET status = 'assigned' WHERE id = ?`,
            [cargo.id]
          );
        }
      }
    }

    



    res.json({
      success: true,
      problem_type: problem_type || 'fixed-3',
      vehicle_count: vehicleCount,
      routes: result.routes,
      totalCost: result.totalCost,
      vehiclesUsed: result.vehiclesUsed,
      newVehiclesRented: result.newVehiclesRented,
      rentalVehicles: rentalVehicles,  //  FRONTEND'E GÖNDERİLdi
      suggestedRejectedCargo: result.rejectedCargo || [],
      rejectedCargoByWeight: tooLightCargos,
      acceptedWeight: result.acceptedWeight,
      rejectedWeight: result.rejectedWeight,
      acceptanceRate: result.acceptanceRate || 100,
      minCargoWeight: minCargoWeight,
      summary: result.summary
    });

  } catch (error) {
    console.error('Calculate routes error:', error);
    res.status(500).json({ error: 'Rota hesaplanamadı!' });
  }
};


// Tüm rotaları getir (Admin için)
const getAllRoutes = async (req, res) => {
  try {
    console.log('📍 getAllRoutes çağrıldı');
    console.log('req.userId:', req.userId);
    console.log('req.userRole:', req.userRole);
    
    const [user] = await db.query('SELECT role FROM users WHERE id = ?', [req.userId]);
    
    console.log('🔍 Database user:', user);
    console.log('User role:', user[0]?.role);
    
    if (!user || !user[0] || user[0].role !== 'admin') {
      console.log(' Admin değil! Role:', user[0]?.role);
      return res.status(403).json({ error: 'Sadece admin erişebilir!' });
    }

    console.log(' Admin kontrolü geçildi');
    
    //  SQL QUERY DÜZELT
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

    console.log(' Routes getirme başarılı:', formattedRoutes.length, 'rota');

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

const addStation = async (req, res) => {
  try {
    //  Admin kontrolü ekle
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
    // Admin kontrolü ekle
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
// Parametreleri kaydet
const saveParameters = async (req, res) => {
  try {
    const [user] = await db.query('SELECT role FROM users WHERE id = ?', [req.userId]);
    
    if (user[0]?.role !== 'admin') {
      return res.status(403).json({ error: 'Sadece admin erişebilir!' });
    }

    const { fuel_price_per_liter, km_cost, rental_cost_new_vehicle } = req.body;

    // parameters tablosunu güncelle (ID=1)
    await db.query(
      'UPDATE parameters SET fuel_price_per_liter = ?, km_cost = ?, rental_cost_new_vehicle = ? WHERE id = 1',
      [parseFloat(fuel_price_per_liter), parseFloat(km_cost), parseInt(rental_cost_new_vehicle)]
    );

    res.json({
      success: true,
      message: 'Parametreler kaydedildi!'
    });
  } catch (error) {
    console.error('Save parameters error:', error);
    res.status(500).json({ error: 'Parametreler kaydedilemedi!' });
  }
};

const analyzeScenario = async (req, res) => {
  try {
    //  VEHICLES QUERY'SİNİ BAŞA AL
    const [vehicles] = await db.query('SELECT id, capacity_kg FROM vehicles');
    
    // Tüm rotaları getir
    const [routes] = await db.query(`
      SELECT 
        r.vehicle_id,
        r.stations,
        r.total_distance_km,
        r.total_weight_kg,
        r.total_cost,
        COUNT(s.id) as cargo_count
      FROM routes r
      LEFT JOIN shipments s ON r.id = s.route_id
      GROUP BY r.id
    `);

    // Tüm istasyonları getir
    const [stations] = await db.query('SELECT id, name FROM stations');

    // İstasyon-araç dağılımı analizi
    const analysis = {
      totalScenario: {
        totalCargo: 0,
        totalWeight: 0,
        totalDistance: 0,
        totalCost: 0,
        vehiclesUsed: 0
      },
      vehicleDetails: [],
      stationDistribution: {},
      costPerVehicle: [],
      costPerKg: 0,
      costPerKm: 0
    };

    routes.forEach((route, idx) => {
      analysis.totalScenario.totalCargo += route.cargo_count;
      analysis.totalScenario.totalWeight += route.total_weight_kg;
      analysis.totalScenario.totalDistance += route.total_distance_km;
      analysis.totalScenario.totalCost += parseFloat(route.total_cost);
      
      const stations_array = route.stations.split(',').map(s => parseInt(s));
      
      //  CAPACITY'İ BURADAN AL
      const vehicle = vehicles.find(v => v.id === route.vehicle_id);
      const capacity = vehicle?.capacity_kg || 500;
      
      analysis.vehicleDetails.push({
        vehicleId: route.vehicle_id,
        stations: stations_array.length,
        distance: route.total_distance_km,
        weight: route.total_weight_kg,
        cost: route.total_cost,
        cargoCount: route.cargo_count,
        costPerKg: (parseFloat(route.total_cost) / route.total_weight_kg).toFixed(2),
        utilization: ((route.total_weight_kg / capacity) * 100).toFixed(1) + '%'  // ✅ DOĞRU
      });

      // İstasyon dağılımı
      stations_array.forEach(stationId => {
        if (!analysis.stationDistribution[stationId]) {
          analysis.stationDistribution[stationId] = {
            stationName: stations.find(s => s.id === stationId)?.name || `Station ${stationId}`,
            vehiclesAssigned: 0,
            cargoCount: 0,
            totalWeight: 0
          };
        }
        analysis.stationDistribution[stationId].vehiclesAssigned++;
      });
    });

    analysis.totalScenario.vehiclesUsed = routes.length;
    analysis.costPerKg = (analysis.totalScenario.totalCost / analysis.totalScenario.totalWeight).toFixed(4);
    analysis.costPerKm = (analysis.totalScenario.totalCost / analysis.totalScenario.totalDistance).toFixed(4);

    res.json({
      success: true,
      analysis: analysis
    });

  } catch (error) {
    console.error('Scenario analysis error:', error);
    res.status(500).json({ error: 'Senaryo analizi yapılamadı!' });
  }
};

// Bekleyen kargolar getir
const getPendingCargos = async (req, res) => {
  try {
    const [user] = await db.query('SELECT role FROM users WHERE id = ?', [req.userId]);
    
    if (user[0]?.role !== 'admin') {
      return res.status(403).json({ error: 'Sadece admin erişebilir!' });
    }

    const [cargos] = await db.query(`
      SELECT 
        cr.id,
        cr.user_id,
        u.name as user_name,
        cr.station_id,
        cr.cargo_count,
        cr.cargo_weight_kg,
        cr.status,
        cr.created_at
      FROM cargo_requests cr
      LEFT JOIN users u ON cr.user_id = u.id
      WHERE cr.status = 'pending'
      ORDER BY cr.created_at DESC
    `);

    res.json({
      success: true,
      data: cargos
    });
  } catch (error) {
    console.error('Get pending cargos error:', error);
    res.status(500).json({ error: 'Kargolar getirilemedi!' });
  }
};

// Kargo red et
const rejectCargo = async (req, res) => {
  try {
    const [user] = await db.query('SELECT role FROM users WHERE id = ?', [req.userId]);
    
    if (user[0]?.role !== 'admin') {
      return res.status(403).json({ error: 'Sadece admin erişebilir!' });
    }

    const { cargoId } = req.params;
    const { reason } = req.body;

    await db.query(
      `UPDATE cargo_requests 
       SET status = 'rejected', rejection_reason = ?
       WHERE id = ?`,
      [reason || 'Admin tarafından reddedildi', cargoId]
    );

    res.json({
      success: true,
      message: 'Kargo başarıyla reddedildi!'
    });
  } catch (error) {
    console.error('Reject cargo error:', error);
    res.status(500).json({ error: 'Kargo reddedilemedi!' });
  }
};

const endDay = async (req, res) => {
  try {
    const [user] = await db.query('SELECT role FROM users WHERE id = ?', [req.userId]);
    
    if (user[0]?.role !== 'admin') {
      return res.status(403).json({ error: 'Sadece admin erişebilir!' });
    }

    //  SIRASINI ÖNEMLI - FOREIGN KEY'LER NEDENIYLE
    // 1. Shipments'i sil (cargo_requests'i referans alıyor)
    await db.query('DELETE FROM shipments');

    // 2. Routes'u sil (vehicle_id referans alıyor)
    await db.query('DELETE FROM routes');

    // 3. Cargo requests'i sil
    await db.query('DELETE FROM cargo_requests');

    // 4. Kiralanan araçları sil (ID > 3)
    await db.query('DELETE FROM vehicles WHERE id > 3');

    console.log('🏁 Gün bitirildi - Tüm veriler sıfırlandı!');

    res.json({
      success: true,
      message: 'Gün başarıyla bitirildi! Tüm veriler sıfırlandı.'
    });

  } catch (error) {
    console.error('End day error:', error);
    res.status(500).json({ error: 'Gün bitirme işlemi başarısız!' });
  }
};



module.exports = { calculateRoutes, getAllRoutes, getMyRoutes, addStation, rentVehicle, deleteStation, deleteVehicle, saveParameters, analyzeScenario, getPendingCargos, rejectCargo,endDay};






