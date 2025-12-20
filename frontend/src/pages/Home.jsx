import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/Home.css';

function Home() {
  return (
    <div className="home-container">
      <div className="header">
        <h1> Kargo İşletme Sistemi</h1>
        <p>Kocaeli Üniversitesi - Bilgisayar Mühendisliği</p>
      </div>

      <div className="cards">
        <Link to="/login?type=admin" className="card">
          <div className="card-content">
            <h2>Admin Paneli</h2>
            <p>Rota planlaması ve yönetim</p>
            <button className="btn btn-primary">Admin Giriş →</button>
          </div>
        </Link>

        <Link to="/login?type=user" className="card">
          <div className="card-content">
            <h2>Kullanıcı Paneli</h2>
            <p>Kargo gönderme ve takip</p>
            <button className="btn btn-primary">Kullanıcı Giriş →</button>
          </div>
        </Link>
      </div>
    </div>
  );
}

export default Home;