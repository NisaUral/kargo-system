import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import axios from 'axios';
import '../styles/Admin.css';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

const API_URL = 'http://localhost:5000/api';

// ✅ GLOBAL INTERCEPTOR - Token otomatik ekleniyor
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// FitBounds Component
function FitBoundsComponent({ stations, routePolylines }) {
  const map = useMap();
  
  useEffect(() => {
    if (map) {
      if (routePolylines && routePolylines.length > 0) {
        let bounds = null;
        
        routePolylines.forEach(poly => {
          if (poly.stationIds && poly.stationIds.length > 0) {
            poly.stationIds.forEach(stationId => {
              let coord;
              if (stationId === 0) {
                coord = [40.8667, 29.85];
              } else {
                const station = stations.find(s => s.id === stationId);
                if (station) {
                  coord = [parseFloat(station.latitude), parseFloat(station.longitude)];
                }
              }
              
              if (coord) {
                if (bounds === null) {
                  bounds = L.latLngBounds(coord, coord);
                } else {
                  bounds.extend(coord);
                }
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

// Route Lines Component - GERÇEKİ ROTA ÇİZİMİ (OSRM ile)
function RouteLines({ routePolylines, stations }) {
  const map = useMap();
  
  useEffect(() => {
    if (routePolylines && routePolylines.length > 0 && map) {
      console.log(`🎨 Gerçek rotalar çiziliyor: ${routePolylines.length} rota`);
      
      // Eski çizgileri sil
      map.eachLayer(layer => {
        if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
          map.removeLayer(layer);
        }
      });
      
      routePolylines.forEach((route, idx) => {
        if (route.stationIds && route.stationIds.length >= 2) {
          console.log(`📍 Rota ${idx} için gerçek yol isteniyor:`, route.stationIds);
          
          // İstasyonları koordinatlara çevir
          const coordinates = route.stationIds
            .map(stationId => {
              if (stationId === 0) {
                return { lat: 40.8667, lng: 29.85, name: 'Üniversite' };
              }
              const station = stations.find(s => s.id === stationId);
              return station 
                ? { lat: parseFloat(station.latitude), lng: parseFloat(station.longitude), name: station.name }
                : null;
            })
            .filter(c => c !== null);

          if (coordinates.length >= 2) {
            fetchRealRoute(coordinates, route.color, idx, map);
          }
        }
      });
    }
  }, [routePolylines, map, stations]);
  
  return null;
}

// Gerçek rota isteme fonksiyonu
async function fetchRealRoute(coordinates, color, routeIdx, map) {
  try {
    const coords = coordinates.map(c => `${c.lng},${c.lat}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/driving/${coords}?geometries=geojson`;

    console.log(`📡 OSRM'den rota isteniyor: ${url}`);
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      const geometry = route.geometry;

      const latLngs = geometry.coordinates.map(coord => [coord[1], coord[0]]);

      L.polyline(latLngs, {
        color: color || '#3388ff',
        weight: 5,
        opacity: 0.8,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);

      console.log(`✅ Rota ${routeIdx} gerçek yollarla çizildi (${(route.distance / 1000).toFixed(2)} km)`);
    } else {
      console.warn(`⚠️ Rota ${routeIdx} bulunamadı, fallback çizgi kullanıyorum`);
      const fallbackCoords = coordinates.map(c => [c.lat, c.lng]);
      L.polyline(fallbackCoords, {
        color: color || '#3388ff',
        weight: 5,
        opacity: 0.5,
        dashArray: '5, 5'
      }).addTo(map);
    }
  } catch (error) {
    console.error(`❌ Rota ${routeIdx} hatası:`, error);
    const fallbackCoords = coordinates.map(c => [c.lat, c.lng]);
    L.polyline(fallbackCoords, {
      color: color || '#3388ff',
      weight: 5,
      opacity: 0.5,
      dashArray: '5, 5'
    }).addTo(map);
  }
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
  const [scenarioAnalysis, setScenarioAnalysis] = useState(null);
  const [problemType, setProblemType] = useState('auto');
  const [pendingCargos, setPendingCargos] = useState([]);
  const [rejectedCargo, setRejectedCargo] = useState([]);
  const [autoAnalysis, setAutoAnalysis] = useState(null);
  const [parameters, setParameters] = useState({
    fuel_price_per_liter: 1,
    km_cost: 1,
    rental_cost_new_vehicle: 200
  });
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
      await axios.post(
        `${API_URL}/routes/add-station`,
        newStation
      );

      setMessage('✅ İstasyon başarıyla eklendi!');
      setNewStation({ name: '', latitude: '', longitude: '' });
      loadStations();
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage('❌ ' + (error.response?.data?.error || 'İstasyon eklenemedi!'));
    }
  };

  const loadScenarioAnalysis = async () => {
    try {
      const response = await axios.get(`${API_URL}/routes/scenario-analysis`);
      setScenarioAnalysis(response.data.analysis);
      setMessage('✅ Senaryo analizi yüklendi!');
    } catch (error) {
      setMessage('❌ Analiz yüklenemedi!');
    }
  };

  const rentVehicle = async (e) => {
    e.preventDefault();
    if (!newVehicle.name || !newVehicle.capacity_kg) {
      setMessage('Tüm alanları doldurunuz!');
      return;
    }

    try {
      await axios.post(
        `${API_URL}/routes/rent-vehicle`,
        {
          name: newVehicle.name,
          capacity_kg: parseInt(newVehicle.capacity_kg),
          rental_cost: parseInt(newVehicle.rental_cost) || 200
        }
      );

      setMessage('✅ Araç başarıyla kiralandı!');
      setNewVehicle({ name: '', capacity_kg: '', rental_cost: '' });
      loadVehicles();
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage('❌ ' + (error.response?.data?.error || 'Araç kiralama başarısız!'));
    }
  };

  const deleteStation = async (stationId) => {
    if (!window.confirm('Bu istasyonu silmek istediğinize emin misiniz?')) {
      return;
    }

    try {
      await axios.delete(`${API_URL}/routes/stations/${stationId}`);
      setMessage('✅ İstasyon başarıyla silindi!');
      loadStations();
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage('❌ ' + (error.response?.data?.error || 'İstasyon silinemedi!'));
    }
  };

  const deleteVehicle = async (vehicleId) => {
    if (!window.confirm('Bu aracı silmek istediğinize emin misiniz?')) {
      return;
    }

    try {
      await axios.delete(`${API_URL}/routes/vehicles/${vehicleId}`);
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

  const drawAllRoutesWithData = (routesToDraw) => {
    console.log('🎨 drawAllRoutesWithData içinde, routes:', routesToDraw);
    
    if (!routesToDraw || routesToDraw.length === 0) {
      console.log('⚠️ Routes boş!');
      return;
    }

    const newPolylines = [];
    const colors = ['#FF0000', '#0000FF', '#00AA00', '#FF9900', '#FF00FF', '#00FFFF', '#FFFF00', '#00FF00'];

    routesToDraw.forEach((route, routeIndex) => {
      console.log(`📍 Route ${routeIndex}:`, route);

      let stationsArray = route.stations;
      if (typeof route.stations === 'string') {
        stationsArray = route.stations.split(',').map(s => parseInt(s));
      }

      newPolylines.push({
        stationIds: stationsArray,
        color: colors[routeIndex % colors.length],
        weight: 4,
        opacity: 0.8
      });
    });

    setAllRoutePolylines(newPolylines);
  };

  const loadPendingCargos = async () => {
    try {
      const response = await axios.get(`${API_URL}/routes/pending-cargos`);
      setPendingCargos(response.data.data);
      setMessage('✅ Bekleyen kargolar yüklendi!');
    } catch (error) {
      setMessage('❌ Kargolar yüklenemedi!');
      console.error(error);
    }
  };

  const rejectCargo = async (cargoId) => {
    if (!window.confirm('Bu kargoyı reddetmek istediğinize emin misiniz?')) {
      return;
    }

    try {
      await axios.post(
        `${API_URL}/routes/cargo-requests/${cargoId}/reject`,
        { reason: 'Admin tarafından reddedildi' }
      );
      setMessage('✅ Kargo başarıyla reddedildi!');
      loadPendingCargos();
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage('❌ Kargo reddedilemedi!');
    }
  };

  const loadAllRoutes = async () => {
    try {
      console.log('📍 loadAllRoutes başlıyor...');
      const response = await axios.get(`${API_URL}/routes/all`);
      
      console.log('✅ Routes geldi:', response.data.routes);
      setAllRoutes(response.data.routes);
      drawAllRoutesWithData(response.data.routes);
      
    } catch (error) {
      console.error('Error loading all routes:', error);
    }
  };

  const calculateRoutes = async () => {
    setLoading(true);
    try {
      console.log('🚀 Otomatik mod - Rota hesaplanıyor...');
      
      const token = localStorage.getItem('adminToken');
      if (!token) {
        setMessage('❌ Admin token bulunamadı! Lütfen giriş yapınız.');
        setLoading(false);
        return;
      }

      const cargoResponse = await axios.get(`${API_URL}/routes/pending-cargos`);

      const cargos = cargoResponse.data.data;
      const totalWeight = cargos.reduce((sum, c) => sum + c.cargo_weight_kg, 0);
      const totalCount = cargos.reduce((sum, c) => sum + c.cargo_count, 0);

      let selectedType = 'unlimited';
      let reason = '';

      if (totalWeight <= 2250) {
        selectedType = 'fixed-3';
        reason = `Toplam ağırlık ${totalWeight}kg ≤ 2250kg (3 araç yeterli)`;
      } else if (totalWeight <= 3000) {
        selectedType = 'fixed-4';
        reason = `Toplam ağırlık ${totalWeight}kg > 2250kg (4 araç gerekli)`;
      } else {
        selectedType = 'unlimited';
        reason = `Toplam ağırlık ${totalWeight}kg > 3000kg (Sınırsız araç)`;
      }

      console.log(`📊 Otomatik analiz: ${reason}`);

      const autoAnalysisData = {
        selectedType,
        reason,
        totalWeight,
        totalCount
      };
      setAutoAnalysis(autoAnalysisData);

      const response = await axios.post(
        `${API_URL}/routes/calculate`,
        { problem_type: selectedType }
      );

      console.log('✅ Routes calculated:', response.data);
      setRoutes(response.data.routes);
      setStats({
        totalCost: parseFloat(response.data.totalCost),
        vehiclesUsed: response.data.vehiclesUsed,
        totalWeight: response.data.routes.reduce((sum, r) => sum + parseInt(r.totalWeight), 0),
        totalDistance: response.data.routes.reduce((sum, r) => sum + parseFloat(r.totalDistance), 0)
      });

      setAutoAnalysis(prev => ({
        ...prev,
        vehiclesUsed: response.data.vehiclesUsed,
        acceptance: response.data.acceptanceRate
      }));

      if (response.data.suggestedRejectedCargo && response.data.suggestedRejectedCargo.length > 0) {
        setRejectedCargo(response.data.suggestedRejectedCargo);
        setMessage(
          `📊 ${reason}\n` +
          `⚠️ ${response.data.suggestedRejectedCargo.length} istasyon red EDİLEBİLİR (admin onayı gerekli)! ` +
          `Mevcut kabul: ${response.data.acceptanceRate}%`
        );
      } else {
        setRejectedCargo([]);
        setMessage(`📊 ${reason}\n✅ Tüm kargolar başarıyla atandı!`);
      }

      if (response.data.rejectedCargoByWeight && response.data.rejectedCargoByWeight.length > 0) {
        const lightCargoMsg = `🔔 ${response.data.rejectedCargoByWeight.length} istasyon minimum ${response.data.minCargoWeight}kg altında (toplam: ${response.data.rejectedCargoByWeight.reduce((s, c) => s + c.weight, 0)}kg)`;
        
        setMessage(
          `📊 ${reason}\n` +
          lightCargoMsg + `\n` +
          (response.data.suggestedRejectedCargo?.length > 0 
            ? `⚠️ ${response.data.suggestedRejectedCargo.length} istasyon kapasite yetersizliği` 
            : `✅ Tüm uygun kargolar atandı!`)
        );
      }

      loadAllRoutes();

    } catch (error) {
      console.error('Error calculating routes:', error);
      setMessage('❌ Rota hesaplanırken hata oluştu: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-container">
      <div className="sidebar">
        <h2> Admin</h2>
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
            className={`nav-btn ${activeTab === 'station-add' ? 'active' : ''}`}
            onClick={() => setActiveTab('station-add')}
          >
             İstasyon Ekle
          </button>
          <button
            className={`nav-btn ${activeTab === 'vehicle-rent' ? 'active' : ''}`}
            onClick={() => setActiveTab('vehicle-rent')}
          >
             Araç Kirala
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
          <button
  className="nav-btn"
  onClick={() => {
    localStorage.clear();
    window.location.href = '/';
  }}
  style={{
    marginTop: 'auto',
    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
    paddingTop: '15px',
    color: '#ecf0f1'
  }}
>
  Çıkış
</button>
        </nav>
      </div>

      <div className="main-content">
        <div className="header">
          <h1>Kargo İşletme Sistemi - Admin Paneli</h1>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button 
              className="btn btn-success" 
              onClick={calculateRoutes}
              disabled={loading}
            >
              {loading ? '⏳ Hesaplanıyor...' : ' Rota Planla'}
            </button>
            
            <button 
              className="btn btn-info"
              onClick={loadScenarioAnalysis}
            >
               Senaryo Analizi
            </button>
          </div>
        </div>

        {message && (
          <div style={{
            padding: '12px',
            marginBottom: '20px',
            borderRadius: '4px',
            backgroundColor: message.includes('✅') ? '#d4edda' : '#f8d7da',
            color: message.includes('✅') ? '#155724' : '#721c24',
            whiteSpace: 'pre-line'
          }}>
            {message}
          </div>
        )}

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
                  center={[40.8667, 29.85]}
                  zoom={11}
                  className="leaflet-map"
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='© OpenStreetMap contributors'
                  />
                  <FitBoundsComponent stations={stations} routePolylines={allRoutePolylines} />
                  <RouteLines routePolylines={allRoutePolylines} stations={stations} />
                  
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

            {scenarioAnalysis && (
              <div style={{ marginTop: '30px', backgroundColor: '#f9f9f9', padding: '20px', borderRadius: '8px' }}>
                <h3> Senaryo Analizi</h3>
                <table className="table">
                  <tbody>
                    <tr>
                      <td>Toplam Kargo:</td>
                      <td><strong>{scenarioAnalysis.totalScenario.totalCargo}</strong></td>
                    </tr>
                    <tr>
                      <td>Toplam Ağırlık:</td>
                      <td><strong>{scenarioAnalysis.totalScenario.totalWeight} kg</strong></td>
                    </tr>
                    <tr>
                      <td>Toplam Mesafe:</td>
                      <td><strong>{parseFloat(scenarioAnalysis.totalScenario.totalDistance).toFixed(2)} km</strong></td>
                    </tr>
                    <tr>
                      <td>Toplam Maliyet:</td>
                      <td><strong>₺{scenarioAnalysis.totalScenario.totalCost.toFixed(2)}</strong></td>
                    </tr>
                    <tr>
                      <td>Kullanılan Araç:</td>
                      <td><strong>{scenarioAnalysis.totalScenario.vehiclesUsed}</strong></td>
                    </tr>
                    <tr>
                      <td>Kg Başına Maliyet:</td>
                      <td><strong>₺{scenarioAnalysis.costPerKg}</strong></td>
                    </tr>
                  </tbody>
                </table>

                <h4 style={{ marginTop: '20px' }}>🚗 Araç Detayları</h4>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Araç ID</th>
                      <th>İstasyon #</th>
                      <th>Mesafe (km)</th>
                      <th>Ağırlık (kg)</th>
                      <th>Maliyet (₺)</th>
                      <th>Kullanım %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scenarioAnalysis.vehicleDetails.map((v, idx) => (
                      <tr key={idx}>
                        <td>{v.vehicleId}</td>
                        <td>{v.stations}</td>
                        <td>{parseFloat(v.distance).toFixed(2)}</td>
                        <td>{v.weight}</td>
                        <td>{v.cost}</td>
                        <td>{v.utilization}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
                            if (stationId === 0 || stationId === 13) return 'UNI';
                            const station = stations.find(s => s.id === stationId);
                            return station ? station.name.substring(0, 3) : `S${stationId}`;
                          })
                          .join(' → ')}
                      </td>
                      <td>{route.stations.filter(s => s !== 0 && s !== 13).length}</td>
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
            <h2> İstasyonlar</h2>
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
                         Sil
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
            <h2> Araçlar</h2>
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
                         Sil
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {activeTab === 'cargo-management' && (
          <section className="section">
            <h2> Bekleyen Kargolar - Yönetim</h2>
            
            <div style={{ marginBottom: '20px' }}>
              <button 
                className="btn btn-warning"
                onClick={loadPendingCargos}
                style={{ marginRight: '10px' }}
              >
                 Bekleyen Kargolar Yükle
              </button>
            </div>

            <table className="table">
              <thead>
                <tr>
                  <th>Kargo ID</th>
                  <th>Kullanıcı</th>
                  <th>İstasyon</th>
                  <th>Ağırlık (kg)</th>
                  <th>Kargo Sayısı</th>
                  <th>Status</th>
                  <th>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {pendingCargos.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center' }}>Bekleyen kargo yok</td>
                  </tr>
                ) : (
                  pendingCargos.map((cargo, idx) => {
                    const station = stations.find(s => s.id === cargo.station_id);
                    return (
                      <tr key={idx}>
                        <td>{cargo.id}</td>
                        <td>{cargo.user_name || 'Bilinmiyor'}</td>
                        <td>{station?.name || `Station ${cargo.station_id}`}</td>
                        <td>{cargo.cargo_weight_kg} kg</td>
                        <td>{cargo.cargo_count}</td>
                        <td>
                          <span style={{ 
                            backgroundColor: cargo.status === 'pending' ? '#ffc107' : '#28a745',
                            color: 'white',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '12px'
                          }}>
                            {cargo.status === 'pending' ? '⏳ Beklemede' : '✅ Atandı'}
                          </span>
                        </td>
                        <td>
                          {cargo.status === 'pending' && (
                            <button 
                              className="btn btn-danger"
                              onClick={() => rejectCargo(cargo.id)}
                            >
                               Red Et
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </section>
        )}

        {activeTab === 'station-add' && (
          <section className="section">
            <h2> Yeni İstasyon Ekle</h2>
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
                 İstasyon Ekle
              </button>
            </form>
          </section>
        )}

        {activeTab === 'vehicle-rent' && (
          <section className="section">
            <h2> Araç Kirala</h2>
            
            <div style={{ backgroundColor: '#f5f5f5', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
              <h3>Sistem Parametreleri</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="form-group">
                  <label> Yakıt Fiyatı (₺/L):</label>
                  <input
                    type="number"
                    step="0.01"
                    value={parameters.fuel_price_per_liter}
                    onChange={(e) => setParameters({...parameters, fuel_price_per_liter: parseFloat(e.target.value)})}
                  />
                </div>
                <div className="form-group">
                  <label> Km Maliyeti (₺/km):</label>
                  <input
                    type="number"
                    step="0.01"
                    value={parameters.km_cost}
                    onChange={(e) => setParameters({...parameters, km_cost: parseFloat(e.target.value)})}
                  />
                </div>
                <div className="form-group">
                  <label> Minimum Kargo Ağırlığı (kg):</label>
                  <input
                    type="number"
                    step="1"
                    value={parameters.min_cargo_weight}
                    onChange={(e) => setParameters({...parameters, min_cargo_weight: parseInt(e.target.value)})}
                    placeholder="Örn: 5"
                  />
                </div>
              </div>
              <button 
                type="button"
                className="btn btn-info"
                onClick={async () => {
                  try {
                    await axios.post(
                      `${API_URL}/routes/parameters`,
                      parameters
                    );
                    setMessage('✅ Parametreler kaydedildi!');
                    setTimeout(() => setMessage(''), 3000);
                  } catch (error) {
                    setMessage('❌ Parametreler kaydedilemedi!');
                  }
                }}
                style={{ marginTop: '10px' }}
              >
                 Parametreleri Kaydet
              </button>
            </div>

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
                 Araç Kirala
              </button>
            </form>
          </section>
        )}
      </div>
    </div>
  );
}

export default Admin;
