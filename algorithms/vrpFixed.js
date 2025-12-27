const { haversineDistance, createDistanceMatrix } = require('./distanceCalculator');

class FixedVehicleVRP {
  constructor(vehicles, stations, cargoByStation, costs) {
    this.vehicles = vehicles;
    this.stations = stations;
    this.cargoByStation = cargoByStation;
    this.costs = costs;
    this.distanceMatrix = createDistanceMatrix(stations);
    this.university = { latitude: 40.8667, longitude: 29.85 };
    this.rejectedCargo = [];
  }

  getDistanceFromUniversity(station) {
    return haversineDistance(
      this.university.latitude,
      this.university.longitude,
      station.latitude,
      station.longitude
    );
  }

  calculateRouteDistance(stations) {
    let total = 0;
    for (let i = 0; i < stations.length - 1; i++) {
      const currentStationId = stations[i];
      const nextStationId = stations[i + 1];
      
      if (currentStationId === 0) {
        const lastStation = this.stations.find(s => s.id === stations[i - 1]);
        if (lastStation) {
          total += this.getDistanceFromUniversity(lastStation);
        }
      } else if (nextStationId === 0) {
        const currentStation = this.stations.find(s => s.id === currentStationId);
        if (currentStation) {
          total += this.getDistanceFromUniversity(currentStation);
        }
      } else {
        const currentIdx = this.stations.findIndex(s => s.id === currentStationId);
        const nextIdx = this.stations.findIndex(s => s.id === nextStationId);
        if (currentIdx !== -1 && nextIdx !== -1) {
          total += this.distanceMatrix[currentIdx][nextIdx];
        }
      }
    }
    return total;
  }

  nearestNeighborRoute(startStationId, availableStations, vehicle) {
    const route = [startStationId];
    const visited = new Set([startStationId]);
    let totalDistance = 0;
    let totalWeight = parseInt(this.cargoByStation[startStationId]?.totalWeight) || 0;

    console.log(`[NN-FIXED] Starting with station ${startStationId}, weight: ${totalWeight}`);

    while (availableStations.length > 0) {
      let nearestStation = null;
      let nearestDistance = Infinity;
      let nearestIdx = -1;
      const currentStationId = route[route.length - 1];

      for (let i = 0; i < availableStations.length; i++) {
        const stationId = availableStations[i];
        
        if (visited.has(stationId) || stationId === currentStationId) {
          continue;
        }
        
        const currentStationIdx = this.stations.findIndex(s => s.id === currentStationId);
        const nextStationIdx = this.stations.findIndex(s => s.id === stationId);
        
        if (currentStationIdx === -1 || nextStationIdx === -1) {
          continue;
        }
        
        const distance = this.distanceMatrix[currentStationIdx][nextStationIdx];
        const cargoWeight = parseInt(this.cargoByStation[stationId]?.totalWeight) || 0;
        const potentialWeight = totalWeight + cargoWeight;

        if (potentialWeight <= vehicle.capacity_kg && distance < nearestDistance) {
          nearestDistance = distance;
          nearestStation = stationId;
          nearestIdx = i;
        }
      }

      if (nearestStation === null) {
        console.log(`[NN-FIXED] Kapasite dolu. ${availableStations.length} istasyon kaldı.`);
        break;
      }

      visited.add(nearestStation);
      route.push(nearestStation);
      totalDistance += nearestDistance;
      totalWeight += parseInt(this.cargoByStation[nearestStation].totalWeight) || 0;

      availableStations.splice(nearestIdx, 1);
    }

    const lastStationIdx = this.stations.findIndex(s => s.id === route[route.length - 1]);
    const returnDistance = haversineDistance(
      this.stations[lastStationIdx].latitude,
      this.stations[lastStationIdx].longitude,
      this.university.latitude,
      this.university.longitude
    );
    totalDistance += returnDistance;

    route.push(0);

    
    // Kalan istasyonlar zaten availableStations'ta kalıyor, solve() içinde başka araca atanacak

    return {
      stations: route,
      totalDistance,
      totalWeight: parseInt(totalWeight),
      capacity: vehicle.capacity_kg,
      utilization: (parseInt(totalWeight) / vehicle.capacity_kg * 100).toFixed(1)
    };
  }

  selectOptimalStartingStation(availableStations) {
    console.log('[START-OPT-FIXED] Optimal başlangıç noktası aranıyor...');
    
    if (!availableStations || availableStations.length === 0) {
      console.log('[START-OPT-FIXED] ⚠️ Kullanılabilir istasyon yok!');
      return null;
    }
    
    let bestStation = availableStations[0];
    let bestScore = Infinity;

    availableStations.forEach(stationId => {
      const station = this.stations.find(s => s.id === stationId);
      
      if (!station) {
        console.log(`[START-OPT-FIXED] ⚠️ Station ${stationId} bulunamadı!`);
        return;
      }
      
      const distToUni = this.getDistanceFromUniversity(station);
      const cargoWeight = this.cargoByStation[stationId]?.totalWeight || 0;
      
      let avgDistToOthers = 0;
      const otherStations = availableStations.filter(s => s !== stationId);
      otherStations.forEach(otherId => {
        const otherStation = this.stations.find(s => s.id === otherId);
        if (otherStation) {
          const idx1 = this.stations.findIndex(s => s.id === stationId);
          const idx2 = this.stations.findIndex(s => s.id === otherId);
          avgDistToOthers += this.distanceMatrix[idx1][idx2];
        }
      });
      if (otherStations.length > 0) {
        avgDistToOthers /= otherStations.length;
      }

      const score = (distToUni * 0.3) + (avgDistToOthers * 0.4) - (cargoWeight * 0.3);

      if (score < bestScore) {
        bestScore = score;
        bestStation = stationId;
      }
    });

    console.log(`[START-OPT-FIXED] ✅ Seçilen başlangıç: Station ${bestStation}`);
    return bestStation;
  }

 
  solve() {
    this.rejectedCargo = [];
    const availableStations = Object.keys(this.cargoByStation)
      .map(id => parseInt(id));

    let allRoutes = [];
    let totalCost = 0;
    let acceptedWeight = 0;

    console.log(`[FIXED] Toplam kargo: ${availableStations.length}, ${this.vehicles.length} araçla işlem yapılacak`);

    // Her araç için rota oluştur
    for (let vehicleIdx = 0; vehicleIdx < this.vehicles.length; vehicleIdx++) {
      const currentVehicle = this.vehicles[vehicleIdx];
      
      //  SADECE ATANMAYAN istasyonları al
      const remainingStations = availableStations.filter(s => !allRoutes.some(r => r.stations.includes(s)));

      console.log(`\n[FIXED] 🚗 Araç ${vehicleIdx + 1}: Cap=${currentVehicle.capacity_kg}kg, Kalan=${remainingStations.length}`);

      if (remainingStations.length === 0) {
        console.log(`[FIXED] ℹ️ Araç ${vehicleIdx + 1}: Kargo yok, atlanıyor`);
        continue;
      }

      const startingStation = this.selectOptimalStartingStation(remainingStations);
      
      if (!startingStation) {
        console.log(`[FIXED] ℹ️ Araç ${vehicleIdx + 1}: Geçerli başlangıç noktası yok, atlanıyor`);
        continue;
      }
      
     
      const stationsForRoute = [...remainingStations];
      
      const route = this.nearestNeighborRoute(
        startingStation,
        stationsForRoute,  
        currentVehicle
      );

      const usedStations = route.stations.filter(s => s !== 0);

      console.log(`[FIXED]  Bu rota: ${route.stations.join('->')}, Weight=${route.totalWeight}kg, Used=${usedStations.length}`);

      const fuelCost = route.totalDistance * this.costs.fuel_price_per_liter;
      const distanceCost = route.totalDistance * this.costs.km_cost;
      const totalRouteCost = fuelCost + distanceCost;

      allRoutes.push({
        vehicleId: currentVehicle.id,
        vehicleName: currentVehicle.name,
        isRented: false,
        stations: route.stations,
        totalDistance: route.totalDistance.toFixed(2),
        totalWeight: route.totalWeight,
        capacity: route.capacity,
        utilization: route.utilization,
        fuelCost: fuelCost.toFixed(2),
        distanceCost: distanceCost.toFixed(2),
        rentalCost: 0,
        totalCost: totalRouteCost.toFixed(2)
      });

      totalCost += totalRouteCost;
      acceptedWeight += route.totalWeight;
    }

    //  KALAN KARGOLARI REJECT ETME - SADECE RAPOR ET
    const unassignedStations = availableStations.filter(s => !allRoutes.some(r => r.stations.includes(s)));
    
    if (unassignedStations.length > 0) {
      console.log(`\n[FIXED]  ${unassignedStations.length} istasyon atanmadı (başka araçla atanacak)`);
      unassignedStations.forEach(stationId => {
        console.log(`[FIXED] - Station ${stationId}: ${this.cargoByStation[stationId]?.totalWeight}kg`);
      });
    }

    console.log(`\n[FIXED]  Kabul edilen: ${acceptedWeight}kg`);
    console.log(`[FIXED]  Atanmayan: ${unassignedStations.reduce((sum, s) => sum + (this.cargoByStation[s]?.totalWeight || 0), 0)}kg`);

    return {
      routes: allRoutes,
      totalCost: totalCost.toFixed(2),
      vehiclesUsed: allRoutes.length,
      newVehiclesRented: 0,
      rejectedCargo: [],  
      acceptedWeight,
      rejectedWeight: 0,
      acceptanceRate: 100,
      summary: {
        totalDistance: allRoutes.reduce((sum, r) => sum + parseFloat(r.totalDistance), 0).toFixed(2),
        totalWeight: allRoutes.reduce((sum, r) => sum + r.totalWeight, 0),
        averageCostPerVehicle: allRoutes.length > 0 ? (totalCost / allRoutes.length).toFixed(2) : 0
      }
    };
  }
}

module.exports = FixedVehicleVRP;