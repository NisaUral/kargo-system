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
        password: loginData.password,
        role: loginData.userType
      });

      if (response.data.token) {
        const tokenKey = response.data.user.role === 'admin' ? 'adminToken' : 'userToken';
        
        localStorage.setItem(tokenKey, response.data.token);
        localStorage.setItem('userRole', response.data.user.role);
        localStorage.setItem('userId', response.data.user.id);
        
        if (response.data.user.role === 'admin') {
          window.location.href = '/admin';
        } else {
          window.location.href = '/user';
        }
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Giriş Başarısız');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');

    if (!registerData.name || !registerData.email || !registerData.password) {
      setError('Tüm alanları doldurunuz');
      return;
    }

    if (registerData.password !== registerData.confirmPassword) {
      setError('Şifreler eşleşmiyor');
      return;
    }

    if (registerData.password.length < 6) {
      setError('Şifre en az 6 haneli olmalı');
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
        const tokenKey = response.data.user.role === 'admin' ? 'adminToken' : 'userToken';
        
        localStorage.setItem(tokenKey, response.data.token);
        localStorage.setItem('userRole', response.data.user.role);
        localStorage.setItem('userId', response.data.user.id);
        
        if (response.data.user.role === 'admin') {
          window.location.href = '/admin';
        } else {
          window.location.href = '/user';
        }
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Kayıt başarısız');
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
      <div className="login-wrapper">
        <div className="login-card">
          <div className="login-header">
            <h1>Kargo Yönetim Sistemi</h1>
            <p>Kargolarını Yönet</p>
          </div>

          <div className="tabs">
            <button
              className={`tab ${activeTab === 'login' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('login');
                setError('');
              }}
            >
              Giriş
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
                <label>Email</label>
                <input
                  type="email"
                  name="email"
                  value={loginData.email}
                  onChange={handleLoginChange}
                  placeholder="you@example.com"
                  required
                />
              </div>

              <div className="form-group">
                <label>Şifre</label>
                <input
                  type="password"
                  name="password"
                  value={loginData.password}
                  onChange={handleLoginChange}
                  placeholder="••••••••"
                  required
                />
              </div>

              <div className="form-group">
                <label>Hesap Tipi</label>
                <select
                  name="userType"
                  value={loginData.userType}
                  onChange={handleLoginChange}
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <button type="submit" className="btn-submit" disabled={loading}>
                {loading ? 'Logging in...' : 'Login'}
              </button>
            </form>
          )}

          {activeTab === 'register' && (
            <form onSubmit={handleRegister}>
              <div className="form-group">
                <label>Full Name</label>
                <input
                  type="text"
                  name="name"
                  value={registerData.name}
                  onChange={handleRegisterChange}
                  placeholder="John Doe"
                  required
                />
              </div>

              <div className="form-group">
                <label>Email Address</label>
                <input
                  type="email"
                  name="email"
                  value={registerData.email}
                  onChange={handleRegisterChange}
                  placeholder="you@example.com"
                  required
                />
              </div>

              <div className="form-group">
                <label>Password</label>
                <input
                  type="password"
                  name="password"
                  value={registerData.password}
                  onChange={handleRegisterChange}
                  placeholder="••••••••"
                  minLength="6"
                  required
                />
              </div>

              <div className="form-group">
                <label>Confirm Password</label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={registerData.confirmPassword}
                  onChange={handleRegisterChange}
                  placeholder="••••••••"
                  minLength="6"
                  required
                />
              </div>

              <div className="form-group">
                <label>Account Type</label>
                <select
                  name="userType"
                  value={registerData.userType}
                  onChange={handleRegisterChange}
                >
                  <option value="user">User</option>
                </select>
                <small className="help-text">
                  Contact administrator to create an admin account
                </small>
              </div>

              <button type="submit" className="btn-submit" disabled={loading}>
                {loading ? 'Creating account...' : 'Register'}
              </button>

              <p className="login-link">
                Already have an account? 
                <button 
                  type="button"
                  className="link-btn"
                  onClick={(e) => { 
                    e.preventDefault(); 
                    setActiveTab('login'); 
                  }}
                >
                  Login here
                </button>
              </p>
            </form>
          )}
        </div>

        <div className="login-footer">
          <p>© 2025 Cargo Management System. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}

export default Login;