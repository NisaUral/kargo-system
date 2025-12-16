import React from 'react';
import axios from 'axios';
import './App.css';
import Login from './pages/Login';
import Admin from './pages/Admin';
import User from './pages/User';

// ✅ INTERCEPTOR - En başta ekle
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminToken') || localStorage.getItem('userToken');
  console.log('📡 Token gönderiliyor:', token ? 'VAR' : 'YOK');
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Error interceptor
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('adminToken');
      localStorage.removeItem('userToken');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

function App() {
  const [page, setPage] = React.useState('auth');
  const userRole = localStorage.getItem('userRole');

  React.useEffect(() => {
    if (userRole === 'admin') {
      setPage('admin');
    } else if (userRole === 'user') {
      setPage('user');
    } else {
      setPage('auth');
    }
  }, [userRole]);

  return (
    <div className="App">
      {page === 'auth' && <Login />}
      {page === 'admin' && <Admin />}
      {page === 'user' && <User />}
    </div>
  );
}

export default App;