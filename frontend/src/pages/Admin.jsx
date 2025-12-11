import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import axios from 'axios';
import '../styles/Admin.css';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

const API_URL = 'http://localhost:5000/api';
const ADMIN_TOKEN = localStorage.getItem('adminToken');

// FitBounds Component
function FitBoundsComponent({ stations }) {
  const map = useMap();
  
  useEffect(() => {
    if (stations && stations.length > 0) {
      const bounds = stations.map(s => 
        [parseFloat(s.latitude), parseFloat(s.longitude)]
      );
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [stations, map]);

  return null;
}

function Admin() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stations, setStations] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [routePolylines, setRoutePolylines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    totalCost: 0,
    vehiclesUsed: 0,
    totalWeight: 0,
    totalDistance: 0
  });

  useEffect(() => {
    loadStations();
    loadVehicles();
  }, []);

  const loadStations = async () => {
    try {
      const response = await axios.get(`${API_URL}/stations`);
      setStations(response.data.data);
    } catch (error) {
      console.error('Error loading stations:', error);
    }
  };

  const loadVehicles = async () => {
    try {
      const response = await axios.get(`${API_URL}/vehicles`);
      setVehicles(response.data.data);
    } catch (error) {
      console.error('Error loading vehicles:', error);
    }
  };

  const drawRoutesOnMap = (routesList) => {
    const colors = ['#27ae60', '#e74c3c', '#f39c12', '#3498db', '#9b59b6'];
    
    const routeLines = routesList.map((route, idx) => {
      const coordinates = route.stations.map(stationId => {
        const station = stations.find(s => s.id === stationId);
        if (!station) return null;
        return [parseFloat(station.latitude), parseFloat(station.longitude)];
      }).filter(c => c !== null);
      
      return (
        <Polyline
          key={`route-${idx}`}
          positions={coordinates}
          color={colors[idx % colors.length]}
          weight={3}
          opacity={0.7}
          dashArray="5, 5"
        />
      );
    });
    
    setRoutePolylines(routeLines);
  };

  const calculateRoutes = async () => {
    setLoading(true);
    try {
      const response = await axios.post(
        `${API_URL}/routes/calculate`,
        { problem_type: 'unlimited' },
        {
          headers: {
            'Authorization': `Bearer ${ADMIN_TOKEN}`
          }
        }
      );

      setRoutes(response.data.routes);
      setStats({
        totalCost: parseFloat(response.data.totalCost),
        vehiclesUsed: response.data.vehiclesUsed,
        totalWeight: response.data.routes.reduce((sum, r) => sum + r.totalWeight, 0),
        totalDistance: response.data.routes.reduce((sum, r) => sum + parseFloat(r.totalDistance), 0)
      });

      // Rotaları çiz
      drawRoutesOnMap(response.data.routes);

    } catch (error) {
      console.error('Error calculating routes:', error);
      alert('Rota hesaplanırken hata oluştu: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-container">
      {/* Sidebar */}
      <div className="sidebar">
        <h2>📊 Admin</h2>
        <nav>
          <button
            className={`nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            Dashboard
          </button>
          <button
            className={`nav-btn ${activeTab === 'rotalar' ? 'active' : ''}`}
            onClick={() => setActiveTab('rotalar')}
          >
            Rotalar
          </button>
          <button
            className={`nav-btn ${activeTab === 'istasyonlar' ? 'active' : ''}`}
            onClick={() => setActiveTab('istasyonlar')}
          >
            İstasyonlar
          </button>
          <button
            className={`nav-btn ${activeTab === 'araclar' ? 'active' : ''}`}
            onClick={() => setActiveTab('araclar')}
          >
            Araçlar
          </button>
          <a href="/" className="nav-btn">Ana Sayfa</a>
        </nav>
      </div>

      {/* Main Content */}
      <div className="main-content">
        <div className="header">
          <h1>Kargo İşletme Sistemi - Admin Paneli</h1>
          <button 
            className="btn btn-success" 
            onClick={calculateRoutes}
            disabled={loading}
          >
            {loading ? '⏳ Hesaplanıyor...' : '🚀 Rota Planla'}
          </button>
        </div>

        {/* Dashboard Section */}
        {activeTab === 'dashboard' && (
          <section className="section">
            <h2>📍 Harita Görünümü</h2>
            
            {stations.length > 0 && (
              <div style={{ 
                width: '100%',
                height: '500px', 
                marginBottom: '30px', 
                borderRadius: '8px',
                overflow: 'hidden',
                position: 'relative',
                border: '1px solid #ddd'
              }}>
                <MapContainer
                  style={{ width: '100%', height: '100%' }}
                  className="leaflet-map"
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='© OpenStreetMap contributors'
                  />
                  <FitBoundsComponent stations={stations} />
                  
                  {/* Rotalar */}
                  {routePolylines}
                  
                  {/* Marker'lar */}
                  {stations.map(station => (
                    <Marker
                      key={station.id}
                      position={[parseFloat(station.latitude), parseFloat(station.longitude)]}
                      icon={L.icon({
                        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
                        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
                        iconSize: [25, 41],
                        iconAnchor: [12, 41],
                        popupAnchor: [1, -34],
                        shadowSize: [41, 41]
                      })}
                    >
                      <Popup>
                        <strong>{station.name}</strong>
                        <br />
                        Lat: {parseFloat(station.latitude).toFixed(4)}
                        <br />
                        Lon: {parseFloat(station.longitude).toFixed(4)}
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>
            )}

            <div className="stats-grid">
              <div className="stat-card">
                <h3>Toplam Maliyet</h3>
                <div className="stat-value">₺ {stats.totalCost.toFixed(2)}</div>
                <div className="stat-sub">Kullanılan Araçlar: {stats.vehiclesUsed}</div>
              </div>

              <div className="stat-card">
                <h3>Taşınan Kargo</h3>
                <div className="stat-value">{stats.totalWeight} kg</div>
                <div className="stat-sub">Mesafe: {stats.totalDistance.toFixed(2)} km</div>
              </div>

              <div className="stat-card">
                <h3>🚚 Araç Kiralama</h3>
                <p style={{ marginBottom: '15px', color: '#666', fontSize: '14px' }}>
                  Gerekirse ek araç kiralayabilirsiniz
                </p>
                <button 
                  className="rental-btn"
                  onClick={() => alert('500 kg kapasiteli araç: 200 TL/gün')}
                >
                  + Araç Kirala
                </button>
                <div style={{ marginTop: '15px', fontSize: '13px', color: '#666' }}>
                  Kiralanan: {Math.max(0, stats.vehiclesUsed - 3)}<br />
                  Maliyet: ₺ {Math.max(0, stats.vehiclesUsed - 3) * 200}
                </div>
              </div>
            </div>

            <h3 style={{ marginTop: '30px' }}>Rota Özeti</h3>
            <table className="table">
              <thead>
                <tr>
                  <th>Araç</th>
                  <th>İstasyonlar</th>
                  <th>Ağırlık (kg)</th>
                  <th>Mesafe (km)</th>
                  <th>Maliyet (₺)</th>
                  <th>Kapasite</th>
                </tr>
              </thead>
              <tbody>
                {routes.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center' }}>Rota hesaplanmadı</td>
                  </tr>
                ) : (
                  routes.map((route, idx) => (
                    <tr key={idx}>
                      <td>{route.vehicleName}</td>
                      <td>{route.stations.length}</td>
                      <td>{route.totalWeight}</td>
                      <td>{route.totalDistance}</td>
                      <td>₺ {route.totalCost}</td>
                      <td>{route.utilization}%</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>
        )}

        {/* Rotalar Section */}
        {activeTab === 'rotalar' && (
          <section className="section">
            <h2>🛣️ Detaylı Rota Bilgileri</h2>
            <table className="table">
              <thead>
                <tr>
                  <th>Araç</th>
                  <th>İstasyon Sayısı</th>
                  <th>Ağırlık (kg)</th>
                  <th>Kapasite Kullanımı</th>
                  <th>Maliyet (₺)</th>
                </tr>
              </thead>
              <tbody>
                {routes.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center' }}>Rota yok</td>
                  </tr>
                ) : (
                  routes.map((route, idx) => (
                    <tr key={idx}>
                      <td>{route.vehicleName}</td>
                      <td>{route.stations.length}</td>
                      <td>{route.totalWeight}</td>
                      <td>{route.utilization}%</td>
                      <td>₺ {route.totalCost}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>
        )}

        {/* İstasyonlar Section */}
        {activeTab === 'istasyonlar' && (
          <section className="section">
            <h2>🏢 İstasyonlar</h2>
            <table className="table">
              <thead>
                <tr>
                  <th>İD</th>
                  <th>İstasyon Adı</th>
                  <th>Enlem</th>
                  <th>Boylam</th>
                </tr>
              </thead>
              <tbody>
                {stations.map(station => (
                  <tr key={station.id}>
                    <td>{station.id}</td>
                    <td>{station.name}</td>
                    <td>{parseFloat(station.latitude).toFixed(6)}</td>
                    <td>{parseFloat(station.longitude).toFixed(6)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* Araçlar Section */}
        {activeTab === 'araclar' && (
          <section className="section">
            <h2>🚗 Araçlar</h2>
            <table className="table">
              <thead>
                <tr>
                  <th>İD</th>
                  <th>Araç Adı</th>
                  <th>Kapasite (kg)</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {vehicles.map(vehicle => (
                  <tr key={vehicle.id}>
                    <td>{vehicle.id}</td>
                    <td>{vehicle.name}</td>
                    <td>{vehicle.capacity_kg}</td>
                    <td>{vehicle.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </div>
    </div>
  );
}

export default Admin;