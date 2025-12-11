const db = require('../db/connection');

// GET - Tüm araçları getir
const getAllVehicles = async (req, res) => {
  try {
    const [vehicles] = await db.query(
      'SELECT id, name, capacity_kg, fuel_consumption, rental_cost, status FROM vehicles ORDER BY id'
    );

    res.json({
      success: true,
      count: vehicles.length,
      data: vehicles
    });

  } catch (error) {
    console.error('Vehicle error:', error);
    res.status(500).json({ error: 'Araçlar getirilemedi!' });
  }
};

module.exports = { getAllVehicles };