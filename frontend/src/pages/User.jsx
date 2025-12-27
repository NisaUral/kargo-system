import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import axios from 'axios';
import '../styles/User.css';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import '../styles/User.css';

const API_URL = 'http://localhost:5000/api';

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

function RouteLines({ routePolylines, stations }) {
  const map = useMap();
  
  useEffect(() => {
    if (routePolylines && routePolylines.length > 0 && map) {
      map.eachLayer(layer => {
        if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
          map.removeLayer(layer);
        }
      });
      
      routePolylines.forEach((route, idx) => {
        if (route.positions && route.positions.length >= 2) {
          const coordinates = route.positions;
          fetchRealRoute(coordinates, route.color, idx, map);
        }
      });
    }
  }, [routePolylines, map, stations]);
  
  return null;
}

// Gerçek rota isteme fonksiyonu
async function fetchRealRoute(coordinates, color, routeIdx, map) {
  try {
    const coords = coordinates.map(c => `${c[1]},${c[0]}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/driving/${coords}?geometries=geojson`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      const geometry = route.geometry;
      const latLngs = geometry.coordinates.map(coord => [coord[1], coord[0]]);

      L.polyline(latLngs, {
        color: color || '#3498db',
        weight: 5,
        opacity: 0.8,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);
    } else {
      const fallbackCoords = coordinates;
      L.polyline(fallbackCoords, {
        color: color || '#3498db',
        weight: 5,
        opacity: 0.5,
        dashArray: '5, 5'
      }).addTo(map);
    }
  } catch (error) {
    console.error('Route error:', error);
  }
}

function User() {
  const [stations, setStations] = useState([]);
  const [myCargos, setMyCargos] = useState([]);
  const [selectedCargo, setSelectedCargo] = useState(null);
  const [cargoRoute, setCargoRoute] = useState(null);
  const [routePolylines, setRoutePolylines] = useState([]);
  const [message, setMessage] = useState('');
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
      setMessage('Error loading stations');
    }
  };

  const loadMyCargos = async () => {
    try {
      const userToken = localStorage.getItem('userToken');
      const response = await axios.get(`${API_URL}/cargo/my-cargos`, {
        headers: {
          'Authorization': `Bearer ${userToken}`
        }
      });
      setMyCargos(response.data.data || []);
    } catch (error) {
      console.error('Error loading cargos:', error);
      setMessage('Error loading shipments');
    }
  };

  const loadCargoRoute = async (cargoId) => {
  try {
    const userToken = localStorage.getItem('userToken');
    const response = await axios.get(`${API_URL}/cargo/route/${cargoId}`, {
      headers: {
        'Authorization': `Bearer ${userToken}`
      }
    });

    console.log('Route Response:', response.data);

    if (response.data.route) {
      console.log('Route Data for cargo', cargoId, ':', response.data.route);
      setCargoRoute(response.data.route);
      drawRoute(response.data.route);
      setMessage('');
    } else {
      setMessage('Kargolar henüz bir rotaya atanmadı!');
      setCargoRoute(null);
      setRoutePolylines([]);
    }
  } catch (error) {
    console.error('Error loading route:', error);
    setMessage('Error loading route');
  }
};

  const drawRoute = (route) => {
  console.log('Drawing route with data:', route); // ← DEBUG
  
  let stations_list = route.stations;
  
  // Eğer string ise parse et
  if (typeof stations_list === 'string') {
    try {
      stations_list = JSON.parse(stations_list);
    } catch (e) {
      console.error('JSON parse error:', e);
      console.log('stations_list raw:', stations_list);
      return;
    }
  }

  // stations_list array değilse, stations yerine stations array'ı kullan
  if (!Array.isArray(stations_list)) {
    console.error('Stations is not an array:', stations_list);
    console.log('Route object keys:', Object.keys(route));
    return;
  }

  const coordinates = stations_list
    .map(stationId => {
      if (stationId === 13 || stationId === 0) {
        return [40.8667, 29.85]; // Üniversite
      }
      const station = stations.find(s => s.id === stationId);
      return station 
        ? [parseFloat(station.latitude), parseFloat(station.longitude)]
        : null;
    })
    .filter(c => c !== null);

  console.log('Coordinates:', coordinates); // ← DEBUG

  if (coordinates.length === 0) {
    setMessage('Route coordinates could not be loaded');
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
    setMessage('');

    try {
      const userToken = localStorage.getItem('userToken');
      await axios.post(
        `${API_URL}/cargo/send`,
        {
          station_id: parseInt(formData.station_id),
          cargo_count: parseInt(formData.cargo_count),
          cargo_weight_kg: parseInt(formData.cargo_weight_kg)
        },
        {
          headers: {
            'Authorization': `Bearer ${userToken}`
          }
        }
      );

      setMessage('Başarıyla gönderildi');
      setFormData({ station_id: '', cargo_count: '', cargo_weight_kg: '' });
      loadMyCargos();
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error:', error);
      setMessage('Error: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="user-container">
      <div className="user-header">
        <div>
          <h1>Kargo Gönder</h1>
          <p className="subtitle">Kargolarını yönet</p>
        </div>
        <button 
          className="logout-link"
          onClick={() => {
            localStorage.clear();
            window.location.href = '/';
          }}
        >
          çıkış
        </button>
      </div>

      {message && (
        <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>
          {message}
        </div>
      )}

      <div className="user-content">
        <div className="card">
          <h2>Gönderim Formu</h2>
          
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Durak Seç:</label>
              <select
                name="station_id"
                value={formData.station_id}
                onChange={handleChange}
                required
              >
                <option value="">-- Choose a station --</option>
                {stations.map(station => (
                  <option key={station.id} value={station.id}>
                    {station.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Kargo sayısı:</label>
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
                <label>Kilo (kg):</label>
                <input
                  type="number"
                  name="cargo_weight_kg"
                  min="1"
                  value={formData.cargo_weight_kg}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-submit" disabled={loading}>
              {loading ? 'Sending...' : 'Kargo Gönder'}
            </button>
          </form>
        </div>

        <div className="card">
          <h2>Kargolarım</h2>
          
          {myCargos.length === 0 ? (
            <div className="empty-state">
              <p>henüz Kargo Gönderilmedi</p>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>İstasyon</th>
                  <th>Parça</th>
                  <th>Kilo (kg)</th>
                  <th>Durum</th>
                  <th>Kontrol et</th>
                </tr>
              </thead>
              <tbody>
                {myCargos.map(cargo => (
                  <tr key={cargo.id}>
                    <td>{cargo.id}</td>
                    <td>{cargo.station_name}</td>
                    <td>{cargo.cargo_count}</td>
                    <td>{cargo.cargo_weight_kg}</td>
                    <td>
                      <span className={`status-badge ${cargo.status}`}>
                        {cargo.status === 'pending' ? 'Pending' : 'Assigned'}
                      </span>
                    </td>
                    <td>
                      <button 
                        className="btn btn-secondary btn-small"
                        onClick={() => {
                          setSelectedCargo(cargo.id);
                          loadCargoRoute(cargo.id);
                        }}
                      >
                        Rota Görüntüle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {selectedCargo && cargoRoute && (
          <div className="card">
            <h2>Rota</h2>
            
            <div className="map-container">
              <MapContainer
  style={{ width: '100%', height: '100%' }}
  center={[40.8667, 29.85]}
  zoom={11}
>
  <TileLayer
    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
    attribution='© OpenStreetMap contributors'
  />
  <FitBoundsComponent stations={stations} />
  <RouteLines routePolylines={routePolylines} stations={stations} />
                
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
  <h3>Rota Bilgisi</h3>
  <div className="info-grid">
    <div className="info-item">
      <label>Araç:</label>
      <span>{cargoRoute?.vehicle_id || 'N/A'}</span>
    </div>
    <div className="info-item">
      <label>Uzaklık:</label>
      <span>{cargoRoute?.total_distance_km || '0'} km</span>
    </div>
    <div className="info-item">
      <label>Toplam Ağırlık:</label>
      <span>{cargoRoute?.total_weight_kg || '0'} kg</span>
    </div>
  </div>
</div>
          </div>
        )}
      </div>
    </div>
  );
}


export default User;