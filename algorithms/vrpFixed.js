const { haversineDistance, createDistanceMatrix } = require('./distanceCalculator');

class FixedVehicleVRP {
  constructor(vehicles, stations, cargoByStation, costs) {  // ✅ stations parametresi EKLE
    this.vehicles = vehicles;
    this.stations = stations;  // ✅ EKLE
    this.cargoByStation = cargoByStation;
    this.costs = costs;
    this.distanceMatrix = createDistanceMatrix(stations);  // ✅ stations kullan
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

    // ✅ KARGO RED MEKANİZMASI
    const rejectedStations = availableStations.filter(s => !visited.has(s));
    rejectedStations.forEach(stationId => {
      this.rejectedCargo.push({
        stationId,
        weight: this.cargoByStation[stationId]?.totalWeight || 0,
        count: this.cargoByStation[stationId]?.totalCount || 0,
        reason: 'Kapasite yetersiz'
      });
    });

    if (rejectedStations.length > 0) {
      console.log(`[NN-FIXED] ⚠️ ${rejectedStations.length} istasyon reddedildi`);
    }

    return {
      stations: route,
      totalDistance,
      totalWeight: parseInt(totalWeight),
      capacity: vehicle.capacity_kg,
      utilization: (parseInt(totalWeight) / vehicle.capacity_kg * 100).toFixed(1)
    };
  }

  solve() {
    this.rejectedCargo = []; // Reset
    const availableStations = Object.keys(this.cargoByStation)
      .map(id => parseInt(id));

    let allRoutes = [];
    let totalCost = 0;
    let acceptedWeight = 0;
    let rejectedWeight = 0;

    console.log(`[FIXED] Toplam kargo: ${availableStations.length}, 3 araçla işlem yapılacak`);

    // Her araç için rota oluştur
    for (let vehicleIdx = 0; vehicleIdx < this.vehicles.length; vehicleIdx++) {
      const currentVehicle = this.vehicles[vehicleIdx];
      const stationsForRoute = [...availableStations];

      console.log(`\n[FIXED] 🚗 Araç ${vehicleIdx + 1}: Cap=${currentVehicle.capacity_kg}kg`);

      const route = this.nearestNeighborRoute(
        stationsForRoute[0],
        stationsForRoute,
        currentVehicle
      );

      const usedStations = route.stations.filter(s => s !== 0);

      // Kullanılan istasyonları çıkar
      usedStations.forEach(stationId => {
        const idx = availableStations.indexOf(stationId);
        if (idx > -1) {
          availableStations.splice(idx, 1);
        }
      });

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

    // Kalan istasyonları reject et
    availableStations.forEach(stationId => {
      this.rejectedCargo.push({
        stationId,
        weight: this.cargoByStation[stationId]?.totalWeight || 0,
        count: this.cargoByStation[stationId]?.totalCount || 0,
        reason: 'Tüm araçlar dolu'
      });
      rejectedWeight += this.cargoByStation[stationId]?.totalWeight || 0;
    });

    console.log(`\n[FIXED] ✅ Kabul edilen: ${acceptedWeight}kg`);
    console.log(`[FIXED] ❌ Reddedilen: ${rejectedWeight}kg (${this.rejectedCargo.length} istasyon)`);

    return {
      routes: allRoutes,
      totalCost: totalCost.toFixed(2),
      vehiclesUsed: allRoutes.length,
      newVehiclesRented: 0,
      rejectedCargo: this.rejectedCargo, // ✅ RED KARGO DETAYI
      acceptedWeight,
      rejectedWeight,
      acceptanceRate: ((acceptedWeight / (acceptedWeight + rejectedWeight)) * 100).toFixed(1),
      summary: {
        totalDistance: allRoutes.reduce((sum, r) => sum + parseFloat(r.totalDistance), 0).toFixed(2),
        totalWeight: allRoutes.reduce((sum, r) => sum + r.totalWeight, 0),
        averageCostPerVehicle: allRoutes.length > 0 ? (totalCost / allRoutes.length).toFixed(2) : 0
      }
    };
  }
}

module.exports = FixedVehicleVRP;