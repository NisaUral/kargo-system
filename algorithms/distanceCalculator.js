// Haversine formülü ile iki nokta arasındaki mesafe (km)
function haversineDistance(lat1, lon1, lat2, lon2) {
  const EARTH_RADIUS_KM = 6371;
  
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

// Tüm istasyonlar arasında distance matrix oluştur
function createDistanceMatrix(stations) {
  const n = stations.length;
  const matrix = Array(n).fill(null).map(() => Array(n).fill(0));
  
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i !== j) {
        matrix[i][j] = haversineDistance(
          stations[i].latitude,
          stations[i].longitude,
          stations[j].latitude,
          stations[j].longitude
        );
      }
    }
  }
  
  return matrix;
}

module.exports = { haversineDistance, createDistanceMatrix };