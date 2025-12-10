const jwt = require('jsonwebtoken');

// JWT token doğrula
const verifyToken = (req, res, next) => {
  const token = req.headers['authorization'];

  if (!token) {
    return res.status(403).json({ error: 'Token gerekli!' });
  }

  try {
    // Token formatı: "Bearer abc123"
    const actualToken = token.split(' ')[1];
    const decoded = jwt.verify(actualToken, process.env.JWT_SECRET);
    req.userId = decoded.id;
    req.userRole = decoded.role;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Geçersiz token!' });
  }
};

// Admin kontrolü
const isAdmin = (req, res, next) => {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Admin yetkisi gerekli!' });
  }
  next();
};

module.exports = { verifyToken, isAdmin };