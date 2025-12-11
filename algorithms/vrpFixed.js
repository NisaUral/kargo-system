const { haversineDistance, createDistanceMatrix } = require('./distanceCalculator');

class FixedVehicleVRP {
  constructor(stations, vehicles, cargoByStation, costs) {
    this.stations = stations;
    this.vehicles = vehicles;
    this.cargoByStation = cargoByStation;
    this.costs = costs;
    this.distanceMatrix = createDistanceMatrix(stations);
    this.university = { latitude: 40.8667, longitude: 29.85 };
  }

  // Greedy Assignment - Her kargoyı en uygun araca ata
  greedyAssignment(cargoByStation) {
    const stationArray = Object.entries(cargoByStation).map(([id, data]) => ({
      id: parseInt(id),
      ...data
    }));

    // Ağırlığa göre sırala (ağır olanları önce ata)
    stationArray.sort((a, b) => b.totalWeight - a.totalWeight);

    const assignments = {};
    const vehicleLoads = {};

    // Her araç için başlangıç yüklemesi
    this.vehicles.forEach(v => {
      vehicleLoads[v.id] = 0;
      assignments[v.id] = [];
    });

    let rejectedStations = [];

    // Her kargo istasyonunu en uygun araca ata
    stationArray.forEach(station => {
      let bestVehicle = null;
      let minCost = Infinity;

      // Her araç için maliyet hesapla
      for (const vehicle of this.vehicles) {
        const currentLoad = vehicleLoads[vehicle.id];
        
        // Kapasite kontrol
        if (currentLoad + station.totalWeight > vehicle.capacity_kg) {
          continue;
        }

        // Mesafe maliyeti
        const stationIdx = this.stations.findIndex(s => s.id === station.id);
        const distanceFromUniversity = haversineDistance(
          this.university.latitude,
          this.university.longitude,
          this.stations[stationIdx].latitude,
          this.stations[stationIdx].longitude
        );
        const cost = distanceFromUniversity * this.costs.km_cost;

        if (cost < minCost) {
          minCost = cost;
          bestVehicle = vehicle.id;
        }
      }

      if (bestVehicle !== null) {
        assignments[bestVehicle].push(station.id);
        vehicleLoads[bestVehicle] += station.totalWeight;
      } else {
        rejectedStations.push(station.id);
      }
    });

    return { assignments, rejectedStations };
  }

  // Rota mesafesini hesapla
  calculateRouteDistance(stations) {
    let total = 0;
    for (let i = 0; i < stations.length - 1; i++) {
      const station1Idx = this.stations.findIndex(s => s.id === stations[i]);
      const station2Idx = this.stations.findIndex(s => s.id === stations[i + 1]);
      total += this.distanceMatrix[station1Idx][station2Idx];
    }
    return total;
  }

  // Ana algoritma
  solve() {
    const { assignments, rejectedStations } = this.greedyAssignment(this.cargoByStation);

    const routes = [];
    let totalCost = 0;

    // Her araç için rota oluştur
    for (const vehicle of this.vehicles) {
      const stationIds = assignments[vehicle.id];

      if (!stationIds || stationIds.length === 0) {
        continue; // Bu araç kullanılmayacak
      }

      const distance = this.calculateRouteDistance(stationIds);
      const weight = stationIds.reduce(
        (sum, stationId) => sum + (this.cargoByStation[stationId]?.totalWeight || 0),
        0
      );

      const cost = distance * this.costs.km_cost;
      totalCost += cost;

      routes.push({
        vehicleId: vehicle.id,
        vehicleName: vehicle.name,
        stations: stationIds,
        totalDistance: distance.toFixed(2),
        totalWeight: weight,
        capacity: vehicle.capacity_kg,
        utilization: ((weight / vehicle.capacity_kg) * 100).toFixed(1),
        cost: cost.toFixed(2)
      });
    }

    return {
      routes,
      totalCost: totalCost.toFixed(2),
      acceptedStations: Object.keys(this.cargoByStation)
        .map(id => parseInt(id))
        .filter(id => !rejectedStations.includes(id)),
      rejectedStations,
      summary: {
        totalDistance: routes.reduce((sum, r) => sum + parseFloat(r.totalDistance), 0).toFixed(2),
        totalWeight: routes.reduce((sum, r) => sum + r.totalWeight, 0),
        averageUtilization: routes.length > 0
          ? (routes.reduce((sum, r) => sum + parseFloat(r.utilization), 0) / routes.length).toFixed(1)
          : 0,
        vehiclesUsed: routes.length,
        rejectedCargoCount: rejectedStations.length
      }
    };
  }
}

module.exports = FixedVehicleVRP;