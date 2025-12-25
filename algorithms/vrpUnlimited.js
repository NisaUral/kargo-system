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

  // ✅ AŞAMA 1: 2-OPT - Rota sırasını optimize et
  improve2Opt(stations) {
    let improved = true;
    let bestDistance = this.calculateRouteDistance(stations);
    let bestRoute = [...stations];
    let iterations = 0;
    const maxIterations = 50;

    console.log(`[2-OPT] Başlangıç mesafe: ${bestDistance.toFixed(2)} km`);

    while (improved && iterations < maxIterations) {
      improved = false;
      iterations++;

      for (let i = 0; i < bestRoute.length - 2; i++) {
        for (let k = i + 2; k < bestRoute.length; k++) {
          // Rotayı ters çevir
          const newRoute = [
            ...bestRoute.slice(0, i + 1),
            ...bestRoute.slice(i + 1, k + 1).reverse(),
            ...bestRoute.slice(k + 1)
          ];

          const newDistance = this.calculateRouteDistance(newRoute);

          if (newDistance < bestDistance - 0.01) {
            bestDistance = newDistance;
            bestRoute = newRoute;
            improved = true;
            console.log(`[2-OPT] ✅ İterasyon ${iterations}: ${bestDistance.toFixed(2)} km`);
            break;
          }
        }
        if (improved) break;
      }
    }

    console.log(`[2-OPT] ✔️ Sonuç: ${bestDistance.toFixed(2)} km (${iterations} iterasyon)`);
    return { stations: bestRoute, distance: bestDistance };
  }

  // Rota mesafesini hesapla
  calculateRouteDistance(stations) {
    let total = 0;
    for (let i = 0; i < stations.length - 1; i++) {
      const currentStationId = stations[i];
      const nextStationId = stations[i + 1];
      
      if (currentStationId === 0) {
        // Üniversiteden - haversine kullan
        const lastStation = this.stations.find(s => s.id === stations[i - 1]);
        if (lastStation) {
          total += this.getDistanceFromUniversity(lastStation);
        }
      } else if (nextStationId === 0) {
        // Üniversiteye - haversine kullan
        const currentStation = this.stations.find(s => s.id === currentStationId);
        if (currentStation) {
          total += this.getDistanceFromUniversity(currentStation);
        }
      } else {
        // İki istasyon arası - matrix kullan
        const currentIdx = this.stations.findIndex(s => s.id === currentStationId);
        const nextIdx = this.stations.findIndex(s => s.id === nextStationId);
        if (currentIdx !== -1 && nextIdx !== -1) {
          total += this.distanceMatrix[currentIdx][nextIdx];
        }
      }
    }
    return total;
  }

  // ✅ AŞAMA 2: Savings Algorithm - İlçe-araç optimal assignment
  calculateSavings() {
    const savings = [];
    const stationIds = Object.keys(this.cargoByStation).map(id => parseInt(id));

    // Her iki istasyon çifti için savings hesapla
    for (let i = 0; i < stationIds.length; i++) {
      for (let j = i + 1; j < stationIds.length; j++) {
        const station1Id = stationIds[i];
        const station2Id = stationIds[j];
        
        const station1 = this.stations.find(s => s.id === station1Id);
        const station2 = this.stations.find(s => s.id === station2Id);
        
        if (!station1 || !station2) continue;

        // Savings = her ikisine ayrı gidiş - birlikte gidiş
        const dist1ToUni = this.getDistanceFromUniversity(station1);
        const dist2ToUni = this.getDistanceFromUniversity(station2);
        
        const station1Idx = this.stations.findIndex(s => s.id === station1Id);
        const station2Idx = this.stations.findIndex(s => s.id === station2Id);
        const directDist = this.distanceMatrix[station1Idx][station2Idx];

        const saving = (dist1ToUni + dist2ToUni - directDist) * this.costs.km_cost;

        savings.push({
          station1Id,
          station2Id,
          saving,
          directDistance: directDist,
          weight1: this.cargoByStation[station1Id]?.totalWeight || 0,
          weight2: this.cargoByStation[station2Id]?.totalWeight || 0,
          totalWeight: (this.cargoByStation[station1Id]?.totalWeight || 0) + 
                       (this.cargoByStation[station2Id]?.totalWeight || 0)
        });
      }
    }

    // En yüksek savings'e göre sırala
    savings.sort((a, b) => b.saving - a.saving);
    
    console.log('[SAVINGS] Top 5 tasarrufu:');
    savings.slice(0, 5).forEach((s, idx) => {
      console.log(`${idx + 1}. S${s.station1Id}-S${s.station2Id}: ₺${s.saving.toFixed(2)} (Toplam: ${s.totalWeight}kg)`);
    });

    return savings;
  }

  // Rotaları savings'e göre optimize et
  optimizeWithSavings(routes) {
    console.log('[SAVINGS] Rotalar optimize ediliyor...');
    const savings = this.calculateSavings();

    let improved = true;
    let iteration = 0;

    while (improved && iteration < 10) {
      improved = false;
      iteration++;

      // En yüksek saving'li çiftleri birleştirmeyi dene
      for (const s of savings) {
        const route1 = routes.find(r => r.stations.includes(s.station1Id));
        const route2 = routes.find(r => r.stations.includes(s.station2Id));

        if (!route1 || !route2 || route1 === route2) continue;

        // Kapasitesi yeterse birleştir
        const combinedWeight = route1.totalWeight + route2.totalWeight;
        if (combinedWeight <= route1.capacity) {
          console.log(`[SAVINGS] ✅ Rota birleştirme: ${route1.stations.join('->')} + ${route2.stations.join('->')}`);
          
          // Station 2 rotasını Station 1'e ekle
          route1.stations = [
            ...route1.stations.slice(0, -1), // Üniversite hariç
            ...route2.stations.slice(0, -1)  // Üniversite hariç
          ];
          route1.stations.push(0); // Üniversiteyi ekle

          route1.totalWeight = combinedWeight;
          route1.totalDistance = this.calculateRouteDistance(route1.stations);
          route1.utilization = (combinedWeight / route1.capacity * 100).toFixed(1);

          // Route 2'yi kaldır
          const route2Idx = routes.findIndex(r => r === route2);
          routes.splice(route2Idx, 1);

          improved = true;
          break;
        }
      }
    }

    console.log(`[SAVINGS] ✔️ Optimizasyon tamamlandı (${iteration} iterasyon)`);
    return routes;
  }

  // ✅ AŞAMA 3: Maliyet-based Sorting - Pahalı rotaları önce optimize et
  sortRoutesByCost(routes) {
    console.log('[COST-SORT] Rotalar maliyet açısından sıralanıyor...');
    
    // Her rotanın maliyet/km'sini hesapla
    const routesWithMetrics = routes.map(route => ({
      ...route,
      costPerKm: parseFloat(route.totalCost) / parseFloat(route.totalDistance),
      costPerKg: parseFloat(route.totalCost) / route.totalWeight,
      efficiency: (route.totalWeight / route.capacity) // Kapasite kullanım oranı
    }));

    // Pahalı rotaları (yüksek costPerKm) önce sırayla
    routesWithMetrics.sort((a, b) => b.costPerKm - a.costPerKm);

    console.log('[COST-SORT] Rotalar maliyet sırasına göre:');
    routesWithMetrics.forEach((r, idx) => {
      console.log(`${idx + 1}. Araç ${r.vehicleId}: ₺${r.costPerKm.toFixed(4)}/km, ${(r.efficiency * 100).toFixed(1)}% dolu`);
    });

    return routesWithMetrics;
  }

  // Pahalı rotaları ek optimizasyon ile iyileştir
  optimizeExpensiveRoutes(routes) {
    console.log('[EXPENSIVE] Pahalı rotalar ek optimizasyon ile iyileştiriliyor...');
    
    const sortedRoutes = this.sortRoutesByCost(routes);
    let savings = 0;

    // En pahalı %30'luk rotaları iyileştir
    const expensiveCount = Math.max(1, Math.floor(sortedRoutes.length * 0.3));

    for (let i = 0; i < expensiveCount; i++) {
      const route = sortedRoutes[i];
      const originalCost = parseFloat(route.totalCost);
      const originalDistance = parseFloat(route.totalDistance);

      // Başka rotalarla birleştirilebilir mi kontrol et
      for (let j = 0; j < sortedRoutes.length; j++) {
        if (i === j) continue;

        const otherRoute = sortedRoutes[j];
        const combinedWeight = route.totalWeight + otherRoute.totalWeight;

        // Kapasite yeterli ve maliyet daha az olacaksa
        if (combinedWeight <= route.capacity) {
          const combinedDistance = this.calculateRouteDistance([
            ...route.stations.slice(0, -1),
            ...otherRoute.stations.slice(0, -1),
            0
          ]);

          const combinedCost = combinedDistance * this.costs.fuel_price_per_liter + 
                             combinedDistance * this.costs.km_cost;

          if (combinedCost < originalCost + parseFloat(otherRoute.totalCost)) {
            console.log(`[EXPENSIVE] ✅ Rota ${route.vehicleId} + ${otherRoute.vehicleId} birleştirildi`);
            console.log(`    Tasarruf: ₺${(originalCost + parseFloat(otherRoute.totalCost) - combinedCost).toFixed(2)}`);
            
            route.stations = [
              ...route.stations.slice(0, -1),
              ...otherRoute.stations.slice(0, -1),
              0
            ];
            route.totalDistance = combinedDistance.toFixed(2);
            route.totalWeight += otherRoute.totalWeight;
            route.totalCost = combinedCost.toFixed(2);
            
            savings += (originalCost + parseFloat(otherRoute.totalCost) - combinedCost);
            
            // Diğer rotayı sil
            sortedRoutes.splice(j, 1);
            break;
          }
        }
      }
    }

    console.log(`[EXPENSIVE] ✔️ Pahalı rota optimizasyonu tamamlandı. Toplam Tasarruf: ₺${savings.toFixed(2)}`);
    return sortedRoutes;
  }

  // Rota verimliliğini kontrol et
  checkRouteEfficiency(routes) {
    console.log('[EFFICIENCY] Rota verimliliği analizi:');
    
    let totalEfficiency = 0;
    routes.forEach((route, idx) => {
      const efficiency = (route.totalWeight / route.capacity * 100).toFixed(1);
      const costEfficiency = (parseFloat(route.totalCost) / route.totalWeight).toFixed(4);
      
      console.log(`Rota ${idx + 1}: ${efficiency}% dolu, ₺${costEfficiency}/kg maliyet`);
      totalEfficiency += parseFloat(efficiency);
    });

    const avgEfficiency = (totalEfficiency / routes.length).toFixed(1);
    console.log(`[EFFICIENCY] Ortalama verimlilik: ${avgEfficiency}%`);
    
    return avgEfficiency;
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
      if (nearestStation === null) {
        console.log(`[NN] No more stations can be added. Current route: ${route.length} stations, weight: ${totalWeight}`);
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

    // ✅ 2-OPT UYGULA
    const optimized = this.improve2Opt(route);
    const optimizedRoute = optimized.stations;
    const optimizedDistance = optimized.distance;

    console.log(`[NN] 2-OPT Orijinal: ${totalDistance.toFixed(2)}km → Optimize: ${optimizedDistance.toFixed(2)}km`);

    return {
      stations: optimizedRoute,
      totalDistance: optimizedDistance,
      totalWeight: parseInt(totalWeight),
      capacity: vehicle.capacity_kg,
      utilization: (parseInt(totalWeight) / vehicle.capacity_kg * 100).toFixed(1)
    };
  }

  // ✅ En optimal başlangıç noktasını seç
selectOptimalStartingStation(availableStations) {
  console.log('[START-OPT] Optimal başlangıç noktası aranıyor...');
  
  let bestStation = availableStations[0];
  let bestScore = Infinity;

  availableStations.forEach(stationId => {
    // Her istasyon için puan hesapla
    const station = this.stations.find(s => s.id === stationId);
    
    // 1. Üniversiteye olan mesafe (düşük = iyi)
    const distToUni = this.getDistanceFromUniversity(station);
    
    // 2. Kargo ağırlığı (yüksek = iyi, başlamak için)
    const cargoWeight = this.cargoByStation[stationId]?.totalWeight || 0;
    
    // 3. Diğer istasyonlara ortalama mesafe
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

    // ✅ PUAN HESAPLA: Üniversiteye yakın + Ağır kargo + Diğerlerine merkezi
    const score = (distToUni * 0.3) + (avgDistToOthers * 0.4) - (cargoWeight * 0.3);

    console.log(`[START-OPT] Station ${stationId}: distToUni=${distToUni.toFixed(2)}, weight=${cargoWeight}, avgDist=${avgDistToOthers.toFixed(2)}, score=${score.toFixed(2)}`);

    if (score < bestScore) {
      bestScore = score;
      bestStation = stationId;
    }
  });

  console.log(`[START-OPT] ✅ Seçilen başlangıç: Station ${bestStation} (skor: ${bestScore.toFixed(2)})`);
  return bestStation;
}
  // Ana algoritma - ✅ DÜZELTILMIŞ VERSİYON
  solve() {
  const availableStations = Object.keys(this.cargoByStation)
    .map(id => parseInt(id));

  let allRoutes = [];
  let totalCost = 0;
  let newVehiclesRented = 0;
  let vehicleIdx = 0;
  const vehiclesToUse = [...this.vehicles];
  
  const assignedStations = new Set();

  console.log(`[SOLVE] Toplam kargo: ${availableStations.length}`);

  while (assignedStations.size < availableStations.length) {
    // ✅ SADECE ATANMAYAN istasyonları al
    const remainingStations = availableStations.filter(s => !assignedStations.has(s));
    
    if (remainingStations.length === 0) {
      console.log(`[SOLVE] ✔️ Tüm kargolar atandı!`);
      break;
    }

    // ✅ EĞER TÜM ARAÇLAR BİTTİYSE YENİ KIRALA
    if (vehicleIdx >= vehiclesToUse.length) {
      const newVehicle = {
        id: 100 + newVehiclesRented,
        name: `Kiralandı Araç ${newVehiclesRented + 1}`,
        capacity_kg: this.costs.rental_capacity,
        fuel_consumption: 0,
        rental_cost: this.costs.rental_cost_new_vehicle,
        isRented: true
      };
      vehiclesToUse.push(newVehicle);
      newVehiclesRented++;
      console.log(`[SOLVE] ➕ Yeni araç kiralandı: ${newVehicle.name}`);
    }

    const currentVehicle = vehiclesToUse[vehicleIdx];
    console.log(`\n[SOLVE] 🚗 Araç ${vehicleIdx} (ID=${currentVehicle.id}): Cap=${currentVehicle.capacity_kg}kg, Kalan=${remainingStations.length}`);

    // ✅ OPTIMAL BAŞLANGIÇ NOKTASINI SEÇ
    const startingStation = this.selectOptimalStartingStation(remainingStations);
    
    // ✅ KOPYA OLUŞTUR (nearestNeighbor içinde modifiye edilir)
    const stationsForRoute = [...remainingStations];
    
    const route = this.nearestNeighborRoute(
      startingStation,
      stationsForRoute,  // ✅ SADECE KALAN istasyonlar
      currentVehicle
    );

    const usedStations = route.stations.filter(s => s !== 0);
    
    // ✅ KULLANILAN istasyonları assignedStations'a ekle
    for (const station of usedStations) {
      assignedStations.add(station);
    }

    console.log(`[SOLVE] ✅ Bu rota: ${route.stations.join('->')}, Weight=${route.totalWeight}kg, Used=${usedStations.length}`);

    // ✅ ONE-WAY MALIYET HESABI (dönüş yok)
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

    // ✅ SONRAKI ARAÇLARA GEÇ
    vehicleIdx++;
  }

  // ✅ AŞAMA 2: SAVINGS OPTIMIZATION UYGULA
  console.log(`\n[SOLVE] Savings optimization uygulanıyor...`);
  allRoutes = this.optimizeWithSavings(allRoutes);

  // ✅ AŞAMA 3: MALIYET-BASED SORTING VE OPTIMIZASYON UYGULA
  console.log(`\n[SOLVE] Maliyet-based optimization uygulanıyor...`);
  allRoutes = this.optimizeExpensiveRoutes(allRoutes);

  // Verimliliği kontrol et
  this.checkRouteEfficiency(allRoutes);

  // Maliyetleri yeniden hesapla
  totalCost = 0;
  allRoutes.forEach(route => {
    const fuelCost = parseFloat(route.totalDistance) * this.costs.fuel_price_per_liter;
    const distanceCost = parseFloat(route.totalDistance) * this.costs.km_cost;
    const rentalCost = route.isRented ? this.costs.rental_cost_new_vehicle : 0;
    route.totalCost = (fuelCost + distanceCost + rentalCost).toFixed(2);
    totalCost += parseFloat(route.totalCost);
  });

  return {
    routes: allRoutes,
    totalCost: totalCost.toFixed(2),
    vehiclesUsed: allRoutes.length,
    newVehiclesRented,
    summary: {
      totalDistance: allRoutes.reduce((sum, r) => sum + parseFloat(r.totalDistance), 0).toFixed(2),
      totalWeight: allRoutes.reduce((sum, r) => sum + r.totalWeight, 0),
      averageCostPerVehicle: allRoutes.length > 0 ? (totalCost / allRoutes.length).toFixed(2) : 0
    }
  };
}
}

module.exports = UnlimitedVehicleVRP;