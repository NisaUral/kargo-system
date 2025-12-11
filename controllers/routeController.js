const db = require('../db/connection');
const UnlimitedVehicleVRP = require('../algorithms/vrpUnlimited');
const FixedVehicleVRP = require('../algorithms/vrpFixed');

// Rota hesapla
const calculateRoutes = async (req, res) => {
  try {
    const { problem_type } = req.body; // 'unlimited' veya 'fixed'

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
      // Sınırsız araç problemi
      const vrp = new UnlimitedVehicleVRP(stations, vehicles, cargoByStation, costs);
      result = vrp.solve();
    } else {
      // Belirli araç problemi (varsayılan)
      const vrp = new FixedVehicleVRP(stations, vehicles, cargoByStation, costs);
      result = vrp.solve();
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