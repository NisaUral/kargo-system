const express = require('express');
const { calculateRoutes } = require('../controllers/routeController');
const { verifyToken, isAdmin } = require('../middleware/auth');
const router = express.Router();

// POST /api/routes/calculate - Rota hesapla (ADMIN)
router.post('/calculate', verifyToken, isAdmin, calculateRoutes);

module.exports = router;