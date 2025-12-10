const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/connection');

// REGISTER - Yeni kullanıcı kaydı
const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Tüm alanlar gerekli!' });
    }

    // Email kontrol et
    const [existingUser] = await db.query(
      'SELECT email FROM users WHERE email = ?',
      [email]
    );

    if (existingUser.length > 0) {
      return res.status(409).json({ error: 'Bu email zaten kayıtlı!' });
    }

    // Şifre hash'le
    const hashedPassword = await bcrypt.hash(password, 10);

    // Veritabanına ekle
    const userRole = role || 'user';
    await db.query(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name, email, hashedPassword, userRole]
    );

    res.status(201).json({ 
      message: 'Kullanıcı başarıyla kaydedildi!',
      email: email 
    });

  } catch (error) {
    console.error('Register hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası!' });
  }
};

// LOGIN - Kullanıcı girişi
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email ve şifre gerekli!' });
    }

    // Kullanıcı bul
    const [users] = await db.query(
      'SELECT id, name, email, password, role FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'Email veya şifre yanlış!' });
    }

    const user = users[0];

    // Şifre kontrol et
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Email veya şifre yanlış!' });
    }

    // JWT Token oluştur
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Giriş başarılı!',
      token: token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Login hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası!' });
  }
};

module.exports = { register, login };