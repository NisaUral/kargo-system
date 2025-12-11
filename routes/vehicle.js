const express = require('express');
const { getAllVehicles } = require('../controllers/vehicleController');
const router = express.Router();

// GET /api/vehicles - Tüm araçları getir
router.get('/', getAllVehicles);

module.exports = router;