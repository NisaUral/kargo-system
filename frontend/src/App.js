import React from 'react';
import axios from 'axios';
import './App.css';
import Login from './pages/Login';
import Admin from './pages/Admin';
import User from './pages/User';

// ✅ INTERCEPTOR
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminToken') || localStorage.getItem('userToken');
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
      localStorage.clear();
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

function App() {
  const [page, setPage] = React.useState('login');  // ✅ 'login' olmalı, 'auth' değil
  
  React.useEffect(() => {
    const token = localStorage.getItem('adminToken') || localStorage.getItem('userToken');
    const userRole = localStorage.getItem('userRole');
    
    console.log('🔍 Token:', token ? 'VAR' : 'YOK');
    console.log('🔍 Role:', userRole);
    
    if (token && userRole) {
      if (userRole === 'admin') {
        setPage('admin');
      } else if (userRole === 'user') {
        setPage('user');
      }
    } else {
      setPage('login');
    }
  }, []);

  return (
    <div className="App">
      {page === 'login' && <Login />}
      {page === 'admin' && <Admin />}
      {page === 'user' && <User />}
    </div>
  );
}
export default App;