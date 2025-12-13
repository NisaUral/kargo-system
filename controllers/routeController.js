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


module.exports = { calculateRoutes };