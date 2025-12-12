import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import axios from 'axios';
import '../styles/Admin.css';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

const API_URL = 'http://localhost:5000/api';
const ADMIN_TOKEN = localStorage.getItem('adminToken');

// FitBounds Component
function FitBoundsComponent({ stations, routePolylines }) {
  const map = useMap();
  
  useEffect(() => {
    if (map) {
      if (routePolylines && routePolylines.length > 0) {
        let bounds = null;
        routePolylines.forEach(poly => {
          if (poly.positions && poly.positions.length > 0) {
            poly.positions.forEach(coord => {
              if (bounds === null) {
                bounds = L.latLngBounds(coord, coord);
              } else {
                bounds.extend(coord);
              }
            });
          }
        });
        if (bounds) {
          map.fitBounds(bounds, { padding: [50, 50] });
        }
      } 
      else if (stations && stations.length > 0) {
        const bounds = stations.map(s => 
          [parseFloat(s.latitude), parseFloat(s.longitude)]
        );
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [stations, routePolylines, map]);

  return null;
}

// Route Lines Component
function RouteLines({ routePolylines }) {
  const map = useMap();
  
  useEffect(() => {
    if (routePolylines && routePolylines.length > 0 && map) {
      map.eachLayer(layer => {
        if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
          map.removeLayer(layer);
        }
      });
      
      routePolylines.forEach((poly, idx) => {
        if (poly.positions && poly.positions.length > 0) {
          try {
            L.polyline(poly.positions, {
              color: poly.color,
              weight: poly.weight,
              opacity: poly.opacity,
              dashArray: poly.dashArray
            }).addTo(map);
          } catch (e) {
            console.error(`Error adding polyline ${idx}:`, e);
          }
        }
      });
    }
  }, [routePolylines, map]);
  
  return null;
}

function Admin() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stations, setStations] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [routePolylines, setRoutePolylines] = useState([]);
  const [allRoutes, setAllRoutes] = useState([]);
  const [allRoutePolylines, setAllRoutePolylines] = useState([]);
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

  useEffect(() => {
  if (activeTab === 'dashboard') {
    console.log('📍 Dashboard açıldı');
    setAllRoutePolylines([]); 
    setRoutePolylines([]);
    
    if (stations.length > 0) {
      console.log('📍 loadAllRoutes çağrılıyor');
      loadAllRoutes();
    } else {
      console.log('⚠️ Stations yüklenmedi!');
    }
  }
}, [activeTab, stations]);

  // Dashboard açılırken haritayı sıfırla
useEffect(() => {
  if (activeTab === 'dashboard') {
    setAllRoutePolylines([]); // Harita temizle
    if (stations.length > 0) {
      loadAllRoutes();
    }
  }
}, [activeTab]);

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
    const coordinates = route.stations
      .map(stationId => {
        if (stationId === 13) {
          return [40.8667, 29.85];
        }
        
        const station = stations.find(s => s.id === stationId);
        if (!station) return null;
        return [parseFloat(station.latitude), parseFloat(station.longitude)];
      })
      .filter(c => c !== null);
    
    if (coordinates.length === 0) return null;
    
    return {
      positions: coordinates,
      color: colors[idx % colors.length],
      weight: 3,
      opacity: 0.7,
      dashArray: '5, 5'
    };
  })
  .filter(line => line !== null);
  
  setRoutePolylines(routeLines);
};

  // Tüm rotaları yükle
  const loadAllRoutes = async () => {
    try {
      const response = await axios.get(`${API_URL}/routes/all`, {
        headers: {
          'Authorization': `Bearer ${ADMIN_TOKEN}`
        }
      });
      
      setAllRoutes(response.data.routes);
      drawAllRoutes(response.data.routes);
    } catch (error) {
      console.error('Error loading all routes:', error);
    }
  };

  // Tüm rotaları harita'ya çiz
  const drawAllRoutes = (routesList) => {
  const colors = ['#27ae60', '#e74c3c', '#f39c12', '#3498db', '#9b59b6', '#1abc9c', '#e67e22', '#34495e'];
  
  console.log('drawAllRoutes called with:', routesList); // DEBUG
  
  const routeLines = routesList.map((route, idx) => {
    console.log(`Route ${idx}:`, route); // DEBUG
    
    const coordinates = route.stations
      .map(stationId => {
        if (stationId === 13) {
          return [40.8667, 29.85];
        }
        const station = stations.find(s => s.id === stationId);
        if (!station) {
          console.warn(`Station ${stationId} bulunamadı`);
          return null;
        }
        return [parseFloat(station.latitude), parseFloat(station.longitude)];
      })
      .filter(c => c !== null);

    console.log(`Route ${idx} coordinates:`, coordinates); // DEBUG

    if (coordinates.length === 0) return null;

    return {
      positions: coordinates,
      color: colors[idx % colors.length],
      weight: 3,
      opacity: 0.7,
      dashArray: '5, 5'
    };
  })
  .filter(line => line !== null);

  console.log('Route lines:', routeLines); // DEBUG
  setAllRoutePolylines(routeLines);
};

  const calculateRoutes = async () => {
  setLoading(true);
  try {
    console.log('🚀 Calculating routes...');
    
    const response = await axios.post(
      `${API_URL}/routes/calculate`,
      { problem_type: 'unlimited' },
      {
        headers: {
          'Authorization': `Bearer ${ADMIN_TOKEN}`
        }
      }
    );

    console.log('✅ Routes calculated:', response.data);
    setRoutes(response.data.routes);
    setStats({
      totalCost: parseFloat(response.data.totalCost),
      vehiclesUsed: response.data.vehiclesUsed,
      totalWeight: response.data.routes.reduce((sum, r) => sum + parseInt(r.totalWeight), 0),
      totalDistance: response.data.routes.reduce((sum, r) => sum + parseFloat(r.totalDistance), 0)
    });

    // BURAYI EKLE:
    loadAllRoutes(); // Yeni rotaları yükle

  } catch (error) {
    console.error('Error calculating routes:', error);
    alert('Rota hesaplanırken hata oluştu: ' + error.message);
  } finally {
    setLoading(false);
  }
};
  useEffect(() => {
    if (routes.length > 0 && stations.length > 0) {
      const timer = setTimeout(() => {
        drawRoutesOnMap(routes);
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [routes, stations]);

  return (
    <div className="admin-container">
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

        {activeTab === 'dashboard' && (
          <section className="section">
            <h2>📍 Harita Görünümü - Tüm Rotalar</h2>
            
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
                  <FitBoundsComponent stations={stations} routePolylines={allRoutePolylines} />
                  <RouteLines routePolylines={allRoutePolylines} />
                  
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

            <h3>Tüm Rotalar</h3>
            <table className="table">
              <thead>
                <tr>
                  <th>Araç</th>
                  <th>Kullanıcı</th>
                  <th>İstasyonlar</th>
                  <th>Mesafe (km)</th>
                  <th>Ağırlık (kg)</th>
                  <th>Maliyet (₺)</th>
                </tr>
              </thead>
              <tbody>
                {allRoutes.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center' }}>Rota yok</td>
                  </tr>
                ) : (
                  allRoutes.map((route, idx) => (
                    <tr key={idx}>
                      <td>{route.vehicleId}</td>
                      <td>{route.users.join(', ')}</td>
                      <td>{route.stations.length}</td>
                      <td>{route.totalDistance}</td>
                      <td>{route.totalWeight}</td>
                      <td>₺ {route.totalCost}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>
        )}

        {activeTab === 'rotalar' && (
  <section className="section">
    <h2>🛣️ Detaylı Rota Bilgileri</h2>
    <table className="table">
      <thead>
        <tr>
          <th>Araç ID</th>
          <th>Rota (İstasyonlar)</th>
          <th>Kargo Sayısı</th>
          <th>Ağırlık (kg)</th>
          <th>Maliyet (₺)</th>
        </tr>
      </thead>
      <tbody>
        {allRoutes.length === 0 ? (
          <tr>
            <td colSpan="5" style={{ textAlign: 'center' }}>Rota yok</td>
          </tr>
        ) : (
          allRoutes.map((route, idx) => (
            <tr key={idx}>
              <td>Araç {route.vehicleId}</td>
              <td>
                {route.stations
                  .map(stationId => {
                    if (stationId === 13) return 'UNI';
                    const station = stations.find(s => s.id === stationId);
                    return station ? station.name.substring(0, 3) : `S${stationId}`;
                  })
                  .join(' → ')}
              </td>
              <td>{route.stations.filter(s => s !== 13).length}</td>
              <td>{route.totalWeight} kg</td>
              <td>₺ {route.totalCost}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  </section>
)}
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