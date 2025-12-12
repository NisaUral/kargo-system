const { haversineDistance, createDistanceMatrix } = require('./distanceCalculator');

class UnlimitedVehicleVRP {
  constructor(stations, vehicles, cargoByStation, costs) {
    this.stations = stations;
    this.vehicles = vehicles;
    this.cargoByStation = cargoByStation;
    this.costs = costs;
    this.distanceMatrix = createDistanceMatrix(stations);
    this.university = { latitude: 40.8667, longitude: 29.85 };
  }

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
    let totalWeight = parseInt(this.cargoByStation[startStationId]?.totalWeight) || 0;

    console.log(`[NN] Starting with station ${startStationId}, available: ${availableStations.length}, weight: ${totalWeight}`);

    while (availableStations.length > 0) {
      let nearestStation = null;
      let nearestDistance = Infinity;
      let nearestIdx = -1;
      const currentStationId = route[route.length - 1];

      // Ziyaret edilmemiş en yakın istasyonu bul
     for (let i = 0; i < availableStations.length; i++) {
  const stationId = availableStations[i];
  
  // Zaten visited'te varsa atla
  if (visited.has(stationId)) {
    continue;
  }
  
  // currentStationId ile aynı değilse kontrol et
  if (stationId === currentStationId) {
    console.log(`[NN] Skipping current station ${stationId}`);
    continue;
  }
        
        const currentStationIdx = this.stations.findIndex(s => s.id === currentStationId);
        const nextStationIdx = this.stations.findIndex(s => s.id === stationId);
        
        if (currentStationIdx === -1 || nextStationIdx === -1) {
          console.log(`[NN] Station not found in distance matrix`);
          continue;
        }
        
        const distance = this.distanceMatrix[currentStationIdx][nextStationIdx];
        const cargoWeight = parseInt(this.cargoByStation[stationId]?.totalWeight) || 0;
        const potentialWeight = totalWeight + cargoWeight;

        console.log(`[NN] Checking station ${stationId}: distance=${distance}, weight=${cargoWeight}, potential=${potentialWeight}, capacity=${vehicle.capacity_kg}`);

        // Kapasite kontrol + mesafe karşılaştırması
        if (potentialWeight <= vehicle.capacity_kg && distance < nearestDistance) {
          nearestDistance = distance;
          nearestStation = stationId;
          nearestIdx = i;
          console.log(`[NN] New best: station ${stationId}, distance ${distance}`);
        }
      }

      // Uygun istasyon bulunamadı
      // Uygun istasyon bulunamadı
if (nearestStation === null) {
  console.log(`[NN] No more stations can be added. Current route: ${route.length} stations, weight: ${totalWeight}`);
  
  // Tüm rotada olan istasyonları availableStations'tan kaldır
  for (let i = availableStations.length - 1; i >= 0; i--) {
    if (visited.has(availableStations[i])) {
      availableStations.splice(i, 1);
    }
  }
  break;
}

// Yeni istasyonu rotaya ekle
visited.add(nearestStation);
route.push(nearestStation);
      totalDistance += nearestDistance;
      totalWeight += parseInt(this.cargoByStation[nearestStation].totalWeight) || 0;

      console.log(`[NN] Added station ${nearestStation}, route now: ${route.length} stations, total weight: ${totalWeight}`);

      // availableStations'tan sil
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

    // ÖNEMLİ: Üniversiteyi rotaya ekle!
    route.push(0); // 0 = University (university için özel ID)

    console.log(`[NN] Final route: ${route.join('->')} (${route.length} stations)`);

    return {
      stations: route,
      totalDistance,
      totalWeight: parseInt(totalWeight),
      capacity: vehicle.capacity_kg,
      utilization: (parseInt(totalWeight) / vehicle.capacity_kg * 100).toFixed(1)
    };
  }

  // Ana algoritma
  solve() {
    const availableStations = Object.keys(this.cargoByStation)
      .map(id => parseInt(id));

    console.log(`[SOLVE] Starting VRP with ${availableStations.length} stations`);

    let activeVehicleIdx = 0;
    let allRoutes = [];
    let totalCost = 0;
    let vehiclesUsed = [];
    let newVehiclesRented = 0;

    const vehiclesToUse = [...this.vehicles];

    while (availableStations.length > 0) {
      console.log(`[SOLVE] Loop iteration - Remaining stations: ${availableStations.length}`);

      // Yeni araç kiralanması gerekirse
      if (activeVehicleIdx >= vehiclesToUse.length) {
        const newVehicle = {
          id: 100 + newVehiclesRented,
          name: `Kiralandı Araç ${newVehiclesRented + 1}`,
          capacity_kg: this.costs.rental_capacity,
          rental_cost: this.costs.rental_cost_new_vehicle,
          isRented: true
        };
        vehiclesUsed.push(newVehicle);
        vehiclesToUse.push(newVehicle);
        newVehiclesRented++;
        console.log(`[SOLVE] Rented new vehicle: ${newVehicle.name}`);
      }

      const currentVehicle = vehiclesToUse[activeVehicleIdx];
      const firstStation = availableStations[0];

      console.log(`[SOLVE] Using vehicle: ${currentVehicle.name}, capacity: ${currentVehicle.capacity_kg}`);

      // Rota oluştur - orijinal array'ı gönder (splice yapacak)
      const route = this.nearestNeighborRoute(
        firstStation,
        availableStations,
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
        totalWeight: parseInt(route.totalWeight),
        capacity: route.capacity,
        utilization: (parseInt(route.totalWeight) / route.capacity * 100).toFixed(1),
        fuelCost: fuelCost.toFixed(2),
        distanceCost: distanceCost.toFixed(2),
        rentalCost: rentalCost,
        totalCost: totalRouteCost.toFixed(2)
      });

      totalCost += totalRouteCost;
      vehiclesUsed.push(currentVehicle);
      activeVehicleIdx++;
    }

    console.log(`[SOLVE] Completed! Total routes: ${allRoutes.length}, Total cost: ${totalCost}`);

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