const express = require('express');
const { register, login } = require('../controllers/authController');
const router = express.Router();

// POST /api/auth/register - Yeni kullanıcı kaydı
router.post('/register', register);

// POST /api/auth/login - Kullanıcı girişi
router.post('/login', login);

module.exports = router;