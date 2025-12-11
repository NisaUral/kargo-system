import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/User.css';

const API_URL = 'http://localhost:5000/api';
const USER_TOKEN = localStorage.getItem('userToken') || 'test-token';

function User() {
  const [stations, setStations] = useState([]);
  const [myCargos, setMyCargos] = useState([]);
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
    
    // Listeyi yenile (3. satır olarak)
    await loadMyCargos();
    
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
            </tr>
          </thead>
          <tbody>
            {myCargos.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center' }}>Kargo yok</td>
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
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default User;