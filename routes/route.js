const express = require('express');
const db = require('../db/connection');
const { verifyToken } = require('../middleware/auth');
const { getPendingCargos, rejectCargo } = require('../controllers/routeController');
const { 
  calculateRoutes, 
  getAllRoutes, 
  getMyRoutes, 
  addStation, 
  rentVehicle,
  deleteStation,  // ✅ EKLE
  deleteVehicle,
  saveParameters,
  analyzeScenario
} = require('../controllers/routeController');
const router = express.Router();

// Routes
router.post('/calculate', verifyToken, calculateRoutes);
router.get('/all', verifyToken, getAllRoutes);
router.get('/my-routes', verifyToken, getMyRoutes);
router.get('/scenario-analysis', verifyToken, analyzeScenario);

// ✅ PATH'LERİ DÜZELT - /api/routes/... olmayacak
router.post('/add-station', verifyToken, addStation);
router.post('/rent-vehicle', verifyToken, rentVehicle);
router.delete('/stations/:stationId', verifyToken, deleteStation);
router.delete('/vehicles/:vehicleId', verifyToken, deleteVehicle);
router.post('/parameters', verifyToken, saveParameters);
router.get('/pending-cargos', verifyToken, getPendingCargos);
router.post('/cargo-requests/:cargoId/reject', verifyToken, rejectCargo);
module.exports = router;