const express = require('express');
const { sendCargo, getUserCargo, getCargoStatus } = require('../controllers/cargoController');
const { verifyToken } = require('../middleware/auth');
const router = express.Router();

// POST /api/cargo/send - Kargo gönder
router.post('/send', verifyToken, sendCargo);

// GET /api/cargo/my-cargos - Kullanıcının kargolarını getir
router.get('/my-cargos', verifyToken, getUserCargo);

// GET /api/cargo/status/:cargo_id - Kargo durumunu getir
router.get('/status/:cargo_id', verifyToken, getCargoStatus);

module.exports = router;