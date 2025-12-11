const { haversineDistance, createDistanceMatrix } = require('./distanceCalculator');

class UnlimitedVehicleVRP {
  constructor(stations, vehicles, cargoByStation, costs) {
    this.stations = stations;
    this.vehicles = vehicles;
    this.cargoByStation = cargoByStation;
    this.costs = costs;
    this.distanceMatrix = createDistanceMatrix(stations);
    this.university = { latitude: 40.8667, longitude: 29.85 }; // KOU merkez
  }

  // Üniversiteden istasyona uzaklık
  getDistanceFromUniversity(station) {
    return haversineDistance(
      this.university.latitude,
      this.university.longitude,
      station.latitude,
      station.longitude
    );
  }

  // Nearest Neighbor - En yakın şehri seç
  nearestNeighborRoute(startStationId, availableStations, vehicle) {
    const route = [startStationId];
    const visited = new Set([startStationId]);
    let totalDistance = 0;
    let totalWeight = this.cargoByStation[startStationId]?.totalWeight || 0;

    while (availableStations.length > 0) {
      let nearestStation = null;
      let nearestDistance = Infinity;
      let nearestIdx = -1;

      for (let i = 0; i < availableStations.length; i++) {
        const stationId = availableStations[i];
        
        if (!visited.has(stationId)) {
          const currentStationIdx = this.stations.findIndex(s => s.id === route[route.length - 1]);
          const nextStationIdx = this.stations.findIndex(s => s.id === stationId);
          
          const distance = this.distanceMatrix[currentStationIdx][nextStationIdx];
          const cargoWeight = this.cargoByStation[stationId]?.totalWeight || 0;
          const potentialWeight = totalWeight + cargoWeight;

          // Kapasite kontrol
          if (distance < nearestDistance && potentialWeight <= vehicle.capacity_kg) {
            nearestDistance = distance;
            nearestStation = stationId;
            nearestIdx = i;
          }
        }
      }

      if (nearestStation === null) {
        break; // Daha fazla istasyon eklenetemez
      }

      visited.add(nearestStation);
      route.push(nearestStation);
      totalDistance += nearestDistance;
      totalWeight += this.cargoByStation[nearestStation].totalWeight;

      // Kullanılan istasyonu sil
      availableStations.splice(nearestIdx, 1);
    }

    // Üniversiteye dönüş
    const lastStationIdx = this.stations.findIndex(s => s.id === route[route.length - 1]);
    const returnDistance = haversineDistance(
      this.stations[lastStationIdx].latitude,
      this.stations[lastStationIdx].longitude,
      this.university.latitude,
      this.university.longitude
    );
    totalDistance += returnDistance;

    return {
      stations: route,
      totalDistance,
      totalWeight,
      capacity: vehicle.capacity_kg,
      utilization: (totalWeight / vehicle.capacity_kg * 100).toFixed(1)
    };
  }

  // Ana algoritma
  solve() {
    const availableStations = Object.keys(this.cargoByStation)
      .map(id => parseInt(id));

    let activeVehicleIdx = 0;
    let allRoutes = [];
    let totalCost = 0;
    let vehiclesUsed = [];
    let newVehiclesRented = 0;

    const vehiclesToUse = [...this.vehicles];

    while (availableStations.length > 0) {
      // Yeni araç kiralanması gerekirse
      if (activeVehicleIdx >= vehiclesToUse.length) {
        vehiclesUsed.push({
          id: 100 + newVehiclesRented,
          name: `Kiralandı Araç ${newVehiclesRented + 1}`,
          capacity_kg: this.costs.rental_capacity,
          rental_cost: this.costs.rental_cost_new_vehicle,
          isRented: true
        });
        vehiclesToUse.push(vehiclesUsed[vehiclesUsed.length - 1]);
        newVehiclesRented++;
      }

      const currentVehicle = vehiclesToUse[activeVehicleIdx];
      const stationsCopy = [...availableStations];

      // Rota oluştur
      const route = this.nearestNeighborRoute(
        stationsCopy[0],
        stationsCopy,
        currentVehicle
      );

      // Maliyet hesapla
      const fuelCost = route.totalDistance * this.costs.fuel_price_per_liter;
      const distanceCost = route.totalDistance * this.costs.km_cost;
      const rentalCost = currentVehicle.isRented ? this.costs.rental_cost_new_vehicle : 0;
      const totalRouteCost = fuelCost + distanceCost + rentalCost;

      allRoutes.push({
        vehicleId: currentVehicle.id,
        vehicleName: currentVehicle.name,
        isRented: currentVehicle.isRented || false,
        stations: route.stations,
        totalDistance: route.totalDistance.toFixed(2),
        totalWeight: route.totalWeight,
        capacity: route.capacity,
        utilization: route.utilization,
        fuelCost: fuelCost.toFixed(2),
        distanceCost: distanceCost.toFixed(2),
        rentalCost: rentalCost,
        totalCost: totalRouteCost.toFixed(2)
      });

      // Kullanılan istasyonları kaldır
      route.stations.forEach(stationId => {
        const idx = availableStations.indexOf(stationId);
        if (idx > -1) availableStations.splice(idx, 1);
      });

      totalCost += totalRouteCost;
      vehiclesUsed.push(currentVehicle);
      activeVehicleIdx++;
    }

    return {
      routes: allRoutes,
      totalCost: totalCost.toFixed(2),
      vehiclesUsed: vehiclesUsed.length,
      newVehiclesRented,
      summary: {
        totalDistance: allRoutes.reduce((sum, r) => sum + parseFloat(r.totalDistance), 0).toFixed(2),
        totalWeight: allRoutes.reduce((sum, r) => sum + r.totalWeight, 0),
        averageCostPerVehicle: allRoutes.length > 0 
          ? (totalCost / allRoutes.length).toFixed(2)
          : 0
      }
    };
  }
}

module.exports = UnlimitedVehicleVRP;