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
      console.log(`🎨 RouteLines: ${routePolylines.length} polyline eklenecek`);
      
      // Eski polylines'ı kaldır
      map.eachLayer(layer => {
        if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
          map.removeLayer(layer);
        }
      });
      
      routePolylines.forEach((poly, idx) => {
        console.log(`📍 Polyline ${idx} ekleniyor:`, poly);
        if (poly.positions && poly.positions.length > 0) {
          try {
            const line = L.polyline(poly.positions, {
              color: poly.color,
              weight: poly.weight,
              opacity: poly.opacity,
              dashArray: poly.dashArray
            }).addTo(map);
            console.log(`✅ Polyline ${idx} eklendi`);
          } catch (e) {
            console.error(`❌ Error adding polyline ${idx}:`, e);
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
  const [map, setMap] = useState(null);
  const [newStation, setNewStation] = useState({ name: '', latitude: '', longitude: '' });
  const [newVehicle, setNewVehicle] = useState({ name: '', capacity_kg: '', rental_cost: '' });
  const [message, setMessage] = useState('');
  
  const [stats, setStats] = useState({
    totalCost: 0,
    vehiclesUsed: 0,
    totalWeight: 0,
    totalDistance: 0
  });

  const addStation = async (e) => {
  e.preventDefault();
  if (!newStation.name || !newStation.latitude || !newStation.longitude) {
    setMessage('Tüm alanları doldurunuz!');
    return;
  }

  try {
    const response = await axios.post(
      `${API_URL}/routes/add-station`,  // ✅ DOĞRU!
      newStation,
      {
        headers: {
          'Authorization': `Bearer ${ADMIN_TOKEN}`
        }
      }
    );

    setMessage('✅ İstasyon başarıyla eklendi!');
    setNewStation({ name: '', latitude: '', longitude: '' });
    loadStations();
    setTimeout(() => setMessage(''), 3000);
  } catch (error) {
    setMessage('❌ ' + (error.response?.data?.error || 'İstasyon eklenemedi!'));
  }
};

// Araç kirala
// Araç kirala
const rentVehicle = async (e) => {
  e.preventDefault();
  if (!newVehicle.name || !newVehicle.capacity_kg) {  // ✅ fuel_consumption kontrolü sil
    setMessage('Tüm alanları doldurunuz!');
    return;
  }

  try {
    const response = await axios.post(
      `${API_URL}/routes/rent-vehicle`,
      {
        name: newVehicle.name,
        capacity_kg: parseInt(newVehicle.capacity_kg),
        rental_cost: parseInt(newVehicle.rental_cost) || 200,
        fuel_consumption: parseFloat(newVehicle.fuel_consumption)
      },
      {
        headers: {
          'Authorization': `Bearer ${ADMIN_TOKEN}`
        }
      }
    );

    setMessage('✅ Araç başarıyla kiralandı!');
    setNewVehicle({ name: '', capacity_kg: '', rental_cost: '', fuel_consumption: '' });
    loadVehicles();
    setTimeout(() => setMessage(''), 3000);
  } catch (error) {
    setMessage('❌ ' + (error.response?.data?.error || 'Araç kiralama başarısız!'));
  }
};

// İstasyon sil
const deleteStation = async (stationId) => {
  if (!window.confirm('Bu istasyonu silmek istediğinize emin misiniz?')) {
    return;
  }

  try {
    await axios.delete(
      `${API_URL}/routes/stations/${stationId}`,
      {
        headers: {
          'Authorization': `Bearer ${ADMIN_TOKEN}`
        }
      }
    );

    setMessage('✅ İstasyon başarıyla silindi!');
    loadStations();
    setTimeout(() => setMessage(''), 3000);
  } catch (error) {
    setMessage('❌ ' + (error.response?.data?.error || 'İstasyon silinemedi!'));
  }
};

// Araç sil
const deleteVehicle = async (vehicleId) => {
  if (!window.confirm('Bu aracı silmek istediğinize emin misiniz?')) {
    return;
  }

  try {
    await axios.delete(
      `${API_URL}/routes/vehicles/${vehicleId}`,
      {
        headers: {
          'Authorization': `Bearer ${ADMIN_TOKEN}`
        }
      }
    );

    setMessage('✅ Araç başarıyla silindi!');
    loadVehicles();
    setTimeout(() => setMessage(''), 3000);
  } catch (error) {
    setMessage('❌ ' + (error.response?.data?.error || 'Araç silinemedi!'));
  }
};
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
    console.log('📍 loadAllRoutes başlıyor...');
    const response = await axios.get(`${API_URL}/routes/all`, {
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`
      }
    });
    
    console.log(' Routes geldi:', response.data.routes);
    setAllRoutes(response.data.routes); // State update
    
    drawAllRoutesWithData(response.data.routes);
    
  } catch (error) {
    console.error('Error loading all routes:', error);
  }
};

// Yeni fonksiyon
const drawAllRoutesWithData = (routesToDraw) => {
  console.log(' drawAllRoutesWithData içinde, routes:', routesToDraw);
  
  if (!routesToDraw || routesToDraw.length === 0) {
    console.log(' Routes boş!');
    return;
  }

  const newPolylines = [];

  routesToDraw.forEach((route, routeIndex) => {
    console.log(` Route ${routeIndex}:`, route);
    console.log(` Route ${routeIndex} stations:`, route.stations); // 👈 EKLE
    console.log(` Route ${routeIndex} stations type:`, typeof route.stations); // 👈 EKLE

     let stationsArray = route.stations;
    if (typeof route.stations === 'string') {
      stationsArray = route.stations.split(',').map(s => parseInt(s));
      console.log(` Route ${routeIndex} parsed to array:`, stationsArray);
    }
    
    const coordinates = route.stations
      .map(stationId => {
        console.log(` Processing stationId ${stationId}`); // 👈 EKLE
        if (stationId === 0 || stationId === 13) {
          return [40.8667, 29.85];
        }
        const station = stations.find(s => s.id === stationId);
        return station ? [parseFloat(station.latitude), parseFloat(station.longitude)] : null;
      })
      .filter(coord => coord !== null);

    console.log(` Final coordinates route ${routeIndex}:`, coordinates); // 👈 EKLE

    if (coordinates.length > 0) {
      const colors = ['#FF0000', '#0000FF', '#00AA00', '#FF9900', '#FF00FF', '#00FFFF', '#FFFF00', '#00FF00'];
      const color = colors[routeIndex % colors.length];

      newPolylines.push({
        positions: coordinates,
        color: color,
        weight: 4,
        opacity: 0.8,
        dashArray: '5, 5'
      });
    }
  });

  setAllRoutePolylines(newPolylines);
};
const colors = ['red', 'blue', 'green', 'orange', 'purple', 'yellow', 'pink', 'cyan'];

// YENİ KOD (sınırsız renk)
const generateColor = (index) => {
  const hue = (index * 60) % 360; // Her araç için farklı hue
  return `hsl(${hue}, 70%, 50%)`;
};
  // Tüm rotaları harita'ya çiz
  const drawAllRoutes = () => {
  console.log('🎨 drawAllRoutes içinde, allRoutes:', allRoutes);
  if (!allRoutes || allRoutes.length === 0) {
    console.log('⚠️ allRoutes boş!');
    return;
  }

  const newPolylines = [];

  allRoutes.forEach((route, routeIndex) => {
    console.log(`🎨 Route ${routeIndex}:`, route);
    
    const coordinates = route.stations
      .map(stationId => {
        if (stationId === 0 || stationId === 13) {
          return [40.8667, 29.85]; // University
        }
        const station = stations.find(s => s.id === stationId);
        return station ? [parseFloat(station.latitude), parseFloat(station.longitude)] : null;
      })
      .filter(coord => coord !== null);

    console.log(`📍 Coordinates için route ${routeIndex}:`, coordinates);

    if (coordinates.length > 0) {
      const colors = ['#FF0000', '#0000FF', '#00AA00', '#FF9900', '#FF00FF', '#00FFFF', '#FFFF00', '#00FF00'];
      const color = colors[routeIndex % colors.length];

      const polylineObj = {
        positions: coordinates,
        color: color,
        weight: 4,
        opacity: 0.8,
        dashArray: '5, 5'
      };

      console.log(`✅ Polyline oluşturuldu route ${routeIndex}:`, polylineObj);
      newPolylines.push(polylineObj);
    }
  });

  console.log('📦 Toplam newPolylines:', newPolylines);
  setAllRoutePolylines(newPolylines);
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
  
  {/* YENİ BUTONLAR */}
  <button
    className={`nav-btn ${activeTab === 'station-add' ? 'active' : ''}`}
    onClick={() => setActiveTab('station-add')}
  >
    ➕ İstasyon Ekle
  </button>
  <button
    className={`nav-btn ${activeTab === 'vehicle-rent' ? 'active' : ''}`}
    onClick={() => setActiveTab('vehicle-rent')}
  >
    🚗 Araç Kirala
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
  <a href="/" className="nav-btn">🚪 Çıkış</a>
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
            {loading ? ' Hesaplanıyor...' : ' Rota Planla'}
          </button>
        </div>

        {activeTab === 'dashboard' && (
          <section className="section">
            <h2> Harita Görünümü - Tüm Rotalar</h2>
            
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
        <h2> Detaylı Rota Bilgileri</h2>
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
          <th>İşlem</th>
        </tr>
      </thead>
      <tbody>
        {stations.map(station => (
          <tr key={station.id}>
            <td>{station.id}</td>
            <td>{station.name}</td>
            <td>{parseFloat(station.latitude).toFixed(6)}</td>
            <td>{parseFloat(station.longitude).toFixed(6)}</td>
            <td>
              <button 
                className="btn btn-danger"
                onClick={() => deleteStation(station.id)}
              >
                🗑️ Sil
              </button>
            </td>
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
          <th>İşlem</th>
        </tr>
      </thead>
      <tbody>
        {vehicles.map(vehicle => (
          <tr key={vehicle.id}>
            <td>{vehicle.id}</td>
            <td>{vehicle.name}</td>
            <td>{vehicle.capacity_kg}</td>
            <td>{vehicle.status}</td>
            <td>
              <button 
                className="btn btn-danger"
                onClick={() => deleteVehicle(vehicle.id)}
              >
                🗑️ Sil
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </section>
)}
        {message && (
  <div style={{
    padding: '12px',
    marginBottom: '20px',
    borderRadius: '4px',
    backgroundColor: message.includes('✅') ? '#d4edda' : '#f8d7da',
    color: message.includes('✅') ? '#155724' : '#721c24'
  }}>
    {message}
  </div>
)}

{activeTab === 'station-add' && (
  <section className="section">
    <h2>➕ Yeni İstasyon Ekle</h2>
    <form onSubmit={addStation} style={{ maxWidth: '500px' }}>
      <div className="form-group">
        <label>İstasyon Adı:</label>
        <input
          type="text"
          value={newStation.name}
          onChange={(e) => setNewStation({...newStation, name: e.target.value})}
          placeholder="Örn: Yeni İlçe"
          required
        />
      </div>

      <div className="form-group">
        <label>Enlem (Latitude):</label>
        <input
          type="number"
          step="0.000001"
          value={newStation.latitude}
          onChange={(e) => setNewStation({...newStation, latitude: parseFloat(e.target.value)})}
          placeholder="40.8667"
          required
        />
      </div>

      <div className="form-group">
        <label>Boylam (Longitude):</label>
        <input
          type="number"
          step="0.000001"
          value={newStation.longitude}
          onChange={(e) => setNewStation({...newStation, longitude: parseFloat(e.target.value)})}
          placeholder="29.85"
          required
        />
      </div>

      <button type="submit" className="btn btn-success">
        ➕ İstasyon Ekle
      </button>
    </form>
  </section>
)}

{activeTab === 'vehicle-rent' && (
  <section className="section">
    <h2>🚗 Araç Kirala</h2>
    <form onSubmit={rentVehicle} style={{ maxWidth: '500px' }}>
      <div className="form-group">
        <label>Araç Adı:</label>
        <input
          type="text"
          value={newVehicle.name}
          onChange={(e) => setNewVehicle({...newVehicle, name: e.target.value})}
          placeholder="Örn: Kiralandı Araç 4"
          required
        />
      </div>

      <div className="form-group">
        <label>Kapasite (kg):</label>
        <input
          type="number"
          value={newVehicle.capacity_kg}
          onChange={(e) => setNewVehicle({...newVehicle, capacity_kg: e.target.value})}
          placeholder="500"
          required
        />
      </div>

      <div className="form-group">
        <label>Kiralama Maliyeti (₺):</label>
        <input
          type="number"
          value={newVehicle.rental_cost}
          onChange={(e) => setNewVehicle({...newVehicle, rental_cost: e.target.value})}
          placeholder="200"
        />
      </div>

      <button type="submit" className="btn btn-success">
        🚗 Araç Kirala
      </button>
    </form>
  </section>
)}
      </div>
    </div>
  );
}

export default Admin;