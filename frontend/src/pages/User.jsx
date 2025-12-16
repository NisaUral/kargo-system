import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import axios from 'axios';
import '../styles/User.css';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

const API_URL = 'http://localhost:5000/api';
const USER_TOKEN = localStorage.getItem('userToken');

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
          L.polyline(poly.positions, {
            color: poly.color,
            weight: poly.weight,
            opacity: poly.opacity,
            dashArray: poly.dashArray
          }).addTo(map);
        }
      });
    }
  }, [routePolylines, map]);
  
  return null;
}

function User() {
  const [stations, setStations] = useState([]);
  const [myCargos, setMyCargos] = useState([]);
  const [selectedCargo, setSelectedCargo] = useState(null);
  const [cargoRoute, setCargoRoute] = useState(null);
  const [routePolylines, setRoutePolylines] = useState([]);
  const [formData, setFormData] = useState({
    station_id: '',
    cargo_count: '',
    cargo_weight_kg: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadStations();
    loadMyCargos();
  }, []);

  const loadStations = async () => {
    try {
      const response = await axios.get(`${API_URL}/stations`);
      setStations(response.data.data);
    } catch (error) {
      console.error('Error loading stations:', error);
    }
  };

  const loadMyCargos = async () => {
    try {
      const response = await axios.get(`${API_URL}/cargo/my-cargos`, {
        headers: {
          'Authorization': `Bearer ${USER_TOKEN}`
        }
      });
      setMyCargos(response.data.data || []);
    } catch (error) {
      console.error('Error loading cargos:', error);
    }
  };

  const loadCargoRoute = async (cargoId) => {
    try {
      const response = await axios.get(`${API_URL}/cargo/route/${cargoId}`, {
        headers: {
          'Authorization': `Bearer ${USER_TOKEN}`
        }
      });

      if (response.data.route) {
        setCargoRoute(response.data.route);
        drawRoute(response.data.route);
      } else {
        alert('Kargo henüz rotaya atanmadı!');
        setCargoRoute(null);
        setRoutePolylines([]);
      }
    } catch (error) {
      console.error('Error loading route:', error);
      alert('Rota yüklenemedi!');
    }
  };

  const drawRoute = (route) => {
  // Route'dan stations al
  let stations_list = route.stations;
  
  // Eğer string ise parse et
  if (typeof stations_list === 'string') {
    try {
      stations_list = JSON.parse(stations_list);
    } catch (e) {
      console.error('JSON parse error:', e);
      alert('Rota bilgileri hatalı!');
      return;
    }
  }

  // stations_list array değilse atla
  if (!Array.isArray(stations_list)) {
    console.error('Stations is not an array:', stations_list);
    alert('İstasyon listesi bulunamadı!');
    return;
  }

  const coordinates = stations_list
    .map(stationId => {
      if (stationId === 13) {
        return [40.8667, 29.85]; // Üniversite
      }
      const station = stations.find(s => s.id === stationId);
      return station 
        ? [parseFloat(station.latitude), parseFloat(station.longitude)]
        : null;
    })
    .filter(c => c !== null);

  if (coordinates.length === 0) {
    alert('Rota koordinatları yüklenemedi!');
    return;
  }

  const polyline = {
    positions: coordinates,
    color: '#3498db',
    weight: 3,
    opacity: 0.7,
    dashArray: '5, 5'
  };

  setRoutePolylines([polyline]);
};

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await axios.post(
        `${API_URL}/cargo/send`,
        {
          station_id: parseInt(formData.station_id),
          cargo_count: parseInt(formData.cargo_count),
          cargo_weight_kg: parseInt(formData.cargo_weight_kg)
        },
        {
          headers: {
            'Authorization': `Bearer ${USER_TOKEN}`
          }
        }
      );

      alert('Kargo başarıyla gönderildi!');
      setFormData({ station_id: '', cargo_count: '', cargo_weight_kg: '' });
      loadMyCargos();
    } catch (error) {
      console.error('Error:', error);
      alert('Kargo gönderilemedi: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="user-container">
      <div className="header">
        <h1>Kargo Gönder</h1>
        <a href="/" className="btn-back">← Geri</a>
      </div>

      <div className="card">
        <h2>Kargo Gönderme Formu</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>İstasyon Seçin:</label>
            <select
              name="station_id"
              value={formData.station_id}
              onChange={handleChange}
              required
            >
              <option value="">-- İstasyon Seçin --</option>
              {stations.map(station => (
                <option key={station.id} value={station.id}>
                  {station.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Kargo Sayısı:</label>
            <input
              type="number"
              name="cargo_count"
              min="1"
              value={formData.cargo_count}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Ağırlık (kg):</label>
            <input
              type="number"
              name="cargo_weight_kg"
              min="1"
              value={formData.cargo_weight_kg}
              onChange={handleChange}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? '⏳ Gönderiliyor...' : 'Gönder'}
          </button>
        </form>
      </div>

      <div className="card">
        <h2>Benim Kargolarım</h2>
        <table className="table">
          <thead>
            <tr>
              <th>İD</th>
              <th>İstasyon</th>
              <th>Kargo Sayısı</th>
              <th>Ağırlık (kg)</th>
              <th>Durum</th>
              <th>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {myCargos.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center' }}>Kargo yok</td>
              </tr>
            ) : (
              myCargos.map(cargo => (
                <tr key={cargo.id}>
                  <td>{cargo.id}</td>
                  <td>{cargo.station_name}</td>
                  <td>{cargo.cargo_count}</td>
                  <td>{cargo.cargo_weight_kg}</td>
                  <td>
                    <span className={`status status-${cargo.status}`}>
                      {cargo.status}
                    </span>
                  </td>
                  <td>
                    <button 
                      className="btn-show-route"
                      onClick={() => {
                        setSelectedCargo(cargo.id);
                        loadCargoRoute(cargo.id);
                      }}
                    >
                      Rota Gör
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
<a 
  href="/" 
  className="nav-btn"
  onClick={(e) => {
    e.preventDefault();
    localStorage.clear();
    window.location.href = '/';
  }}
>
  🚪 Çıkış
</a>
      {selectedCargo && cargoRoute && (
        <div className="card">
          <h2>📍 Kargo Rotası</h2>
          
          <div style={{ 
            width: '100%',
            height: '500px', 
            marginBottom: '20px', 
            borderRadius: '8px',
            overflow: 'hidden',
            border: '1px solid #ddd'
          }}>
            <MapContainer
              style={{ width: '100%', height: '100%' }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='© OpenStreetMap contributors'
              />
              <FitBoundsComponent stations={stations} />
              <RouteLines routePolylines={routePolylines} />
              
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
                  <Popup>{station.name}</Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>

          <div className="route-info">
            <h3>Rota Bilgileri:</h3>
            <p><strong>Araç:</strong> {cargoRoute.vehicle_id}</p>
            <p><strong>Mesafe:</strong> {cargoRoute.total_distance} km</p>
            <p><strong>Ağırlık:</strong> {cargoRoute.total_weight} kg</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default User;