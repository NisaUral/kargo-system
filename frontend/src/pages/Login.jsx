import React, { useState } from 'react';
import axios from 'axios';
import '../styles/Login.css';

const API_URL = 'http://localhost:5000/api';

function Login() {
  const [activeTab, setActiveTab] = useState('login');
  const [loginData, setLoginData] = useState({
    email: '',
    password: '',
    userType: 'user'
  });
  const [registerData, setRegisterData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    userType: 'user'
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await axios.post(`${API_URL}/auth/login`, {
        email: loginData.email,
        password: loginData.password
      });

      if (response.data.token) {
        const tokenKey = loginData.userType === 'admin' ? 'adminToken' : 'userToken';
        localStorage.setItem(tokenKey, response.data.token);
        localStorage.setItem('userRole', response.data.user.role);
        
        if (response.data.user.role === 'admin') {
          window.location.href = '/admin';
        } else {
          window.location.href = '/user';
        }
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Giriş başarısız!');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');

    if (!registerData.name || !registerData.email || !registerData.password) {
      setError('Tüm alanları doldurunuz!');
      return;
    }

    if (registerData.password !== registerData.confirmPassword) {
      setError('Şifreler eşleşmiyor!');
      return;
    }

    if (registerData.password.length < 6) {
      setError('Şifre en az 6 karakter olmalı!');
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(`${API_URL}/auth/register`, {
        name: registerData.name,
        email: registerData.email,
        password: registerData.password,
        role: registerData.userType
      });

      if (response.data.token) {
        const tokenKey = registerData.userType === 'admin' ? 'adminToken' : 'userToken';
        localStorage.setItem(tokenKey, response.data.token);
        localStorage.setItem('userRole', response.data.user.role);
        
        if (response.data.user.role === 'admin') {
          window.location.href = '/admin';
        } else {
          window.location.href = '/user';
        }
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Kayıt başarısız!');
    } finally {
      setLoading(false);
    }
  };

  const handleLoginChange = (e) => {
    const { name, value } = e.target;
    setLoginData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleRegisterChange = (e) => {
    const { name, value } = e.target;
    setRegisterData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1> Kargo İşletme Sistemi</h1>

        <div className="tabs">
          <button
            className={`tab ${activeTab === 'login' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('login');
              setError('');
            }}
          >
            Giriş Yap
          </button>
          <button
            className={`tab ${activeTab === 'register' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('register');
              setError('');
            }}
          >
            Kayıt Ol
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}

        {activeTab === 'login' && (
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label>Email:</label>
              <input
                type="email"
                name="email"
                value={loginData.email}
                onChange={handleLoginChange}
                placeholder="example@mail.com"
                required
              />
            </div>

            <div className="form-group">
              <label>Şifre:</label>
              <input
                type="password"
                name="password"
                value={loginData.password}
                onChange={handleLoginChange}
                placeholder="••••••"
                required
              />
            </div>

            <div className="form-group">
              <label>Giriş Türü:</label>
             
            </div>

            <button type="submit" className="btn-login" disabled={loading}>
              {loading ? '⏳ Giriş Yapılıyor...' : ' Giriş Yap'}
            </button>

          </form>
        )}

        {activeTab === 'register' && (
          <form onSubmit={handleRegister}>
            <div className="form-group">
              <label>Ad Soyad:</label>
              <input
                type="text"
                name="name"
                value={registerData.name}
                onChange={handleRegisterChange}
                placeholder="Adınız Soyadınız"
                required
              />
            </div>

            <div className="form-group">
              <label>Email:</label>
              <input
                type="email"
                name="email"
                value={registerData.email}
                onChange={handleRegisterChange}
                placeholder="example@mail.com"
                required
              />
            </div>

            <div className="form-group">
              <label>Şifre:</label>
              <input
                type="password"
                name="password"
                value={registerData.password}
                onChange={handleRegisterChange}
                placeholder="••••••"
                minLength="6"
                required
              />
            </div>

            <div className="form-group">
              <label>Şifre Tekrar:</label>
              <input
                type="password"
                name="confirmPassword"
                value={registerData.confirmPassword}
                onChange={handleRegisterChange}
                placeholder="••••••"
                minLength="6"
                required
              />
            </div>

            <div className="form-group">
              <label>Hesap Türü:</label>
              <select
                name="userType"
                value={registerData.userType}
                onChange={handleRegisterChange}
              >
                <option value="user">Kullanıcı</option>
              </select>
              <small style={{ color: '#666', marginTop: '5px', display: 'block' }}>
                Admin hesabı için sistem yöneticisine başvurunuz
              </small>
            </div>

            <button type="submit" className="btn-login" disabled={loading}>
              {loading ? '⏳ Kayıt Yapılıyor...' : ' Kayıt Ol'}
            </button>

            <p style={{ textAlign: 'center', marginTop: '15px', color: '#666', fontSize: '13px' }}>
              Zaten bir hesabınız var mı? <a href="#" onClick={() => setActiveTab('login')} style={{ color: '#3498db', textDecoration: 'none' }}>Giriş yapın</a>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

export default Login;