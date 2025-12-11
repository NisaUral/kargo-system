import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/Login.css';

const API_URL = 'http://localhost:5000/api';

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [userType, setUserType] = useState('user'); // 'user' veya 'admin'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await axios.post(`${API_URL}/auth/login`, {
        email,
        password
      });

      const { token, user } = response.data;

      // Token'ı localStorage'a kaydet
      // Token'ı localStorage'a kaydet
localStorage.setItem('userToken', token);
localStorage.setItem('user', JSON.stringify(user));

// User rolü kontrol et
if (user.role === 'admin') {
  localStorage.setItem('adminToken', token);
  localStorage.setItem('adminUser', JSON.stringify(user));
  navigate('/admin');
} else {
  navigate('/user');
}

    } catch (error) {
      setError('Giriş başarısız: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>🚚 Kargo Sistemi</h1>
        <h2>Giriş Yap</h2>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>Giriş Türü:</label>
            <select 
              value={userType} 
              onChange={(e) => setUserType(e.target.value)}
            >
              <option value="user">Kullanıcı</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div className="form-group">
            <label>Email:</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              required
            />
          </div>

          <div className="form-group">
            <label>Şifre:</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? '⏳ Girişe çalışılıyor...' : 'Giriş Yap'}
          </button>
        </form>

        <div className="demo-users">
          <h3>Demo Hesapları:</h3>
          <p><strong>Admin:</strong> admin@example.com / admin123</p>
          <p><strong>User:</strong> nisa@example.com / 123456</p>
        </div>

        <a href="/" className="back-link">← Ana Sayfa</a>
      </div>
    </div>
  );
}

export default Login;