const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  const token = req.headers['authorization'];

  if (!token) {
    console.log('❌ Token header yok!');
    return res.status(403).json({ error: 'Token gerekli!' });
  }

  try {
    const actualToken = token.split(' ')[1];
    console.log('📝 Token kontrol ediliyor...');
    
    const decoded = jwt.verify(actualToken, process.env.JWT_SECRET);
    
    // ✅ authController'da { id, role } gönderiliyor
    req.userId = decoded.id;      // ✅ BURASI DOĞRU
    req.userRole = decoded.role;
    
    console.log('✅ Token verified:', { userId: req.userId, role: req.userRole });
    
    next();
  } catch (err) {
    console.error('❌ Token error:', err.message);
    return res.status(401).json({ error: 'Geçersiz token!' });
  }
};

const isAdmin = (req, res, next) => {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Admin yetkisi gerekli!' });
  }
  next();
};

module.exports = { verifyToken, isAdmin };