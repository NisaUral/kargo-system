const express = require('express');
const { getAllStations, addStation } = require('../controllers/stationController');
const { verifyToken, isAdmin } = require('../middleware/auth');
const router = express.Router();

// GET /api/stations - Tüm istasyonları getir
router.get('/', getAllStations);

// POST /api/admin/stations/add - Yeni istasyon ekle (ADMIN)
router.post('/add', verifyToken, isAdmin, addStation);

module.exports = router;