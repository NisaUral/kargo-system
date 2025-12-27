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

  //  CARGO SPLITTING - Her istasyonun kargosunu parçalara böl
  splitCargoByStation() {
    const splitCargo = {};
    
    Object.entries(this.cargoByStation).forEach(([stationId, cargo]) => {
      const itemWeight = cargo.totalWeight / cargo.totalCount;  // Her item kaç kg
      
      splitCargo[stationId] = {
        station: cargo.station,
        totalCount: cargo.totalCount,
        totalWeight: cargo.totalWeight,
        itemWeight: itemWeight,  // Tek item ağırlığı
        remainingItems: cargo.totalCount,  // Kalan kaç item
        remainingWeight: cargo.totalWeight  // Kalan kaç kg
      };
    });
    
    return splitCargo;
  }

  //  AŞAMA 1: 2-OPT - Rota sırasını optimize et
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

  calculateSavings() {
    const savings = [];
    const stationIds = Object.keys(this.cargoByStation).map(id => parseInt(id));

    for (let i = 0; i < stationIds.length; i++) {
      for (let j = i + 1; j < stationIds.length; j++) {
        const station1Id = stationIds[i];
        const station2Id = stationIds[j];
        
        const station1 = this.stations.find(s => s.id === station1Id);
        const station2 = this.stations.find(s => s.id === station2Id);
        
        if (!station1 || !station2) continue;

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

    savings.sort((a, b) => b.saving - a.saving);
    
    console.log('[SAVINGS] Top 5 tasarrufu:');
    savings.slice(0, 5).forEach((s, idx) => {
      console.log(`${idx + 1}. S${s.station1Id}-S${s.station2Id}: ₺${s.saving.toFixed(2)} (Toplam: ${s.totalWeight}kg)`);
    });

    return savings;
  }

  optimizeWithSavings(routes) {
    console.log('[SAVINGS] Rotalar optimize ediliyor...');
    const savings = this.calculateSavings();

    let improved = true;
    let iteration = 0;

    while (improved && iteration < 10) {
      improved = false;
      iteration++;

      for (const s of savings) {
        const route1 = routes.find(r => r.stations.includes(s.station1Id));
        const route2 = routes.find(r => r.stations.includes(s.station2Id));

        if (!route1 || !route2 || route1 === route2) continue;

        const combinedWeight = route1.totalWeight + route2.totalWeight;
        if (combinedWeight <= route1.capacity) {
          console.log(`[SAVINGS] ✅ Rota birleştirme: ${route1.stations.join('->')} + ${route2.stations.join('->')}`);
          
          route1.stations = [
            ...route1.stations.slice(0, -1),
            ...route2.stations.slice(0, -1)
          ];
          route1.stations.push(0);

          route1.totalWeight = combinedWeight;
          route1.totalDistance = this.calculateRouteDistance(route1.stations);
          route1.utilization = (combinedWeight / route1.capacity * 100).toFixed(1);

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

  sortRoutesByCost(routes) {
    console.log('[COST-SORT] Rotalar maliyet açısından sıralanıyor...');
    
    const routesWithMetrics = routes.map(route => ({
      ...route,
      costPerKm: parseFloat(route.totalCost) / parseFloat(route.totalDistance),
      costPerKg: parseFloat(route.totalCost) / route.totalWeight,
      efficiency: (route.totalWeight / route.capacity)
    }));

    routesWithMetrics.sort((a, b) => b.costPerKm - a.costPerKm);

    console.log('[COST-SORT] Rotalar maliyet sırasına göre:');
    routesWithMetrics.forEach((r, idx) => {
      console.log(`${idx + 1}. Araç ${r.vehicleId}: ₺${r.costPerKm.toFixed(4)}/km, ${(r.efficiency * 100).toFixed(1)}% dolu`);
    });

    return routesWithMetrics;
  }

  optimizeExpensiveRoutes(routes) {
    console.log('[EXPENSIVE] Pahalı rotalar ek optimizasyon ile iyileştiriliyor...');
    
    const sortedRoutes = this.sortRoutesByCost(routes);
    let savings = 0;

    const expensiveCount = Math.max(1, Math.floor(sortedRoutes.length * 0.3));

    for (let i = 0; i < expensiveCount; i++) {
      const route = sortedRoutes[i];
      const originalCost = parseFloat(route.totalCost);
      const originalDistance = parseFloat(route.totalDistance);

      for (let j = 0; j < sortedRoutes.length; j++) {
        if (i === j) continue;

        const otherRoute = sortedRoutes[j];
        const combinedWeight = route.totalWeight + otherRoute.totalWeight;

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
            
            sortedRoutes.splice(j, 1);
            break;
          }
        }
      }
    }

    console.log(`[EXPENSIVE]  Pahalı rota optimizasyonu tamamlandı. Toplam Tasarruf: ₺${savings.toFixed(2)}`);
    return sortedRoutes;
  }

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

  //  PARÇA PARÇA KARGO EKLEME
  nearestNeighborRoute(startStationId, splitCargo, vehicle, stations) {
    const startWeight = splitCargo[startStationId]?.remainingWeight || 0;
    const itemWeight = splitCargo[startStationId]?.itemWeight || 0;

    //  BAŞLANGIÇ BİR İTEM KAPASİTEYE SAĞLAMAZSA NULL DÖN
    if (itemWeight > vehicle.capacity_kg) {
      console.log(`[NN] ⚠️ Station ${startStationId}: 1 item ${itemWeight}kg > ${vehicle.capacity_kg}kg - BAŞLAYAMAZ!`);
      return null;
    }

    const route = [startStationId];
    let totalDistance = 0;
    let totalWeight = 0;
    let addedItems = 0;

    //  BAŞLANGIÇ İSTASYONUNDAN KAPASITE DOLUSANA KADAR İTEM EKLE
    while (
      splitCargo[startStationId].remainingItems > 0 &&
      totalWeight + splitCargo[startStationId].itemWeight <= vehicle.capacity_kg
    ) {
      const iWeight = splitCargo[startStationId].itemWeight;
      totalWeight += iWeight;
      addedItems += 1;
      splitCargo[startStationId].remainingWeight -= iWeight;
      splitCargo[startStationId].remainingItems -= 1;
    }

    console.log(`[NN] Starting with station ${startStationId}, weight: ${totalWeight}kg, items: ${addedItems}`);

    //  KALAN İSTASYONLARDAN PARÇA PARÇA KARGO EKLE
    let stationsProcessed = new Set([startStationId]);
    let foundMore = true;

    while (foundMore) {
      foundMore = false;
      let nearestStation = null;
      let nearestDistance = Infinity;

      // Tüm kargo istasyonlarını kontrol et
      Object.keys(splitCargo).forEach(stationIdStr => {
        const stationId = parseInt(stationIdStr);
        
        if (stationsProcessed.has(stationId)) return;
        if (splitCargo[stationId].remainingItems === 0) return;

        const station = stations.find(s => s.id === stationId);
        const currentStation = stations.find(s => s.id === route[route.length - 1]);
        
        if (!station || !currentStation) return;

        const currentIdx = stations.findIndex(s => s.id === route[route.length - 1]);
        const nextIdx = stations.findIndex(s => s.id === stationId);
        
        if (currentIdx === -1 || nextIdx === -1) return;

        const distance = this.distanceMatrix[currentIdx][nextIdx];
        const iWeight = splitCargo[stationId].itemWeight;

        // ✅ BİR İTEM KAPASİTEYE SAĞLARSA EKLE
        if (totalWeight + iWeight <= vehicle.capacity_kg && distance < nearestDistance) {
          nearestDistance = distance;
          nearestStation = stationId;
        }
      });

      // Uygun istasyon bulunduysa, 1 item ekle
      if (nearestStation !== null) {
        foundMore = true;
        const iWeight = splitCargo[nearestStation].itemWeight;
        
        totalWeight += iWeight;
        totalDistance += nearestDistance;
        addedItems += 1;

        //  KARGO BÖLMELERINDEN 1 İTEM ÇIKARt
        splitCargo[nearestStation].remainingWeight -= iWeight;
        splitCargo[nearestStation].remainingItems -= 1;

        console.log(`[NN] Added 1 item from station ${nearestStation} (${iWeight}kg), total: ${totalWeight}kg, items: ${addedItems}`);

        // Eğer istasyonun tüm kargosı biterse, rota listesine ekle
        if (splitCargo[nearestStation].remainingItems === 0 && !route.includes(nearestStation)) {
          route.push(nearestStation);
          stationsProcessed.add(nearestStation);
        }
      }
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
    route.push(0);

    console.log(`[NN] Final route: ${route.join('->')}, weight: ${totalWeight}kg, items: ${addedItems}`);

    //  2-OPT UYGULA
    const optimized = this.improve2Opt(route);
    const optimizedRoute = optimized.stations;
    const optimizedDistance = optimized.distance;

    console.log(`[NN] 2-OPT Orijinal: ${totalDistance.toFixed(2)}km → Optimize: ${optimizedDistance.toFixed(2)}km`);

    return {
      stations: optimizedRoute,
      totalDistance: optimizedDistance,
      totalWeight: parseInt(totalWeight),
      itemsCount: addedItems,
      capacity: vehicle.capacity_kg,
      utilization: (parseInt(totalWeight) / vehicle.capacity_kg * 100).toFixed(1)
    };
  }

  selectOptimalStartingStation(splitCargo, vehicle) {
    console.log('[START-OPT] Optimal başlangıç noktası aranıyor...');
    
    //  HENÜz KARGOSu BİTMEMİŞ İSTASYONLARDAN SEÇ
    const stationsWithCargo = Object.entries(splitCargo)
      .filter(([_, cargo]) => cargo.remainingItems > 0)
      .map(([id, _]) => parseInt(id));

    if (stationsWithCargo.length === 0) {
      console.log('[START-OPT]  Kargo bitmedi!');
      return null;
    }

    let bestStation = stationsWithCargo[0];
    let bestScore = Infinity;

    stationsWithCargo.forEach(stationId => {
      const station = this.stations.find(s => s.id === stationId);
      
      const distToUni = this.getDistanceFromUniversity(station);
      const cargoWeight = splitCargo[stationId]?.remainingWeight || 0;
      
      let avgDistToOthers = 0;
      const otherStations = stationsWithCargo.filter(s => s !== stationId);
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

    console.log(`[START-OPT] ✅ Seçilen başlangıç: Station ${bestStation}`);
    return bestStation;
  }

  //  ANA ALGORITMA - CARGO SPLITTING İLE
  solve() {
    //  KARGOLARI PARÇALARA BÖL
    let splitCargo = this.splitCargoByStation();
    
    let allRoutes = [];
    let totalCost = 0;
    let newVehiclesRented = 0;
    let vehicleIdx = 0;
    const vehiclesToUse = [...this.vehicles];

    console.log(`[SOLVE] Toplam kargo: ${Object.keys(this.cargoByStation).length} istasyon`);
    console.log(`[SOLVE] Toplam ağırlık: ${Object.values(splitCargo).reduce((sum, c) => sum + c.totalWeight, 0)}kg`);

    //  KARGO BİTMEYİ DÖNGÜ
    while (Object.values(splitCargo).some(cargo => cargo.remainingItems > 0)) {
      //  HENÜz KARGOSu BİTMEMİŞ İSTASYONLAR
      const stationsWithCargo = Object.keys(splitCargo)
        .filter(stationId => splitCargo[stationId].remainingItems > 0)
        .map(id => parseInt(id));

      if (stationsWithCargo.length === 0) {
        console.log(`[SOLVE] ✔️ Tüm kargolar dağıtıldı!`);
        break;
      }

      //  YENİ ARAÇ GEREKLİYSE KİRA
      if (vehicleIdx >= vehiclesToUse.length) {
        //  KALAN KARGO AĞIRLIĞINI HESAPLA
        const remainingWeight = Object.values(splitCargo)
          .filter(c => c.remainingItems > 0)
          .reduce((sum, c) => sum + c.remainingWeight, 0);

        //  KİRALANDI ARACIN KAPASİTESİ = KALAN KARGO + %10 BUFFER
        const rentalCapacity = Math.ceil(remainingWeight * 1.1);

        const newVehicle = {
          id: 100 + newVehiclesRented,
          name: `Kiralandı Araç ${newVehiclesRented + 1}`,
          capacity_kg: rentalCapacity,  //  DINAMIK KAPASİTE
          fuel_consumption: 0,
          rental_cost: this.costs.rental_cost_new_vehicle,
          isRented: true
        };
        vehiclesToUse.push(newVehicle);
        newVehiclesRented++;
        console.log(`[SOLVE]  Yeni araç kiralandı: ${newVehicle.name} (${rentalCapacity}kg kapasite, kalan kargo: ${remainingWeight}kg)`);
      }

      const currentVehicle = vehiclesToUse[vehicleIdx];
      const remainingWeight = Object.values(splitCargo)
        .filter(c => c.remainingItems > 0)
        .reduce((sum, c) => sum + c.remainingWeight, 0);

      console.log(`\n[SOLVE]  Araç ${vehicleIdx} (ID=${currentVehicle.id}): Cap=${currentVehicle.capacity_kg}kg, Kalan=${remainingWeight}kg`);

      //  OPTIMAL BAŞLANGIÇ SEÇ
      const startingStation = this.selectOptimalStartingStation(splitCargo, currentVehicle);
      
      if (!startingStation) {
        console.log(`[SOLVE]  Başlangıç istasyonu bulunamadı!`);
        vehicleIdx++;
        continue;
      }

      //  PARÇA PARÇA KARGO EKLEME
      const route = this.nearestNeighborRoute(
        startingStation,
        splitCargo,  
        currentVehicle,
        this.stations
      );

      if (!route) {
        console.log(`[SOLVE]  Rota oluşturulamadı, sonraki araçla dene...`);
        vehicleIdx++;
        continue;
      }

      //  SPLITCARGO'YU GÜNCELLE (o araçta taşınanlar)
      const usedStations = route.stations.filter(s => s !== 0);
      for (const stationId of usedStations) {
        if (splitCargo[stationId].remainingItems > 0) {
          console.log(`[SOLVE] Station ${stationId}: ${splitCargo[stationId].remainingItems} item kaldı`);
          // Kalan itemler sonraki araçla taşınacak
        }
      }

      console.log(`[SOLVE]  Bu rota: ${route.stations.join('->')}, Weight=${route.totalWeight}kg, Items=${route.itemsCount}`);

      //  MALIYET HESABI
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
        itemsCount: route.itemsCount,
        capacity: route.capacity,
        utilization: route.utilization,
        fuelCost: fuelCost.toFixed(2),
        distanceCost: distanceCost.toFixed(2),
        rentalCost: rentalCost,
        totalCost: totalRouteCost.toFixed(2)
      });

      totalCost += totalRouteCost;
      vehicleIdx++;
    }

    //  AŞAMA 2: SAVINGS OPTIMIZATION
    console.log(`\n[SOLVE] Savings optimization uygulanıyor...`);
    allRoutes = this.optimizeWithSavings(allRoutes);

    //  AŞAMA 3: MALIYET-BASED OPTIMIZATION
    console.log(`\n[SOLVE] Maliyet-based optimization uygulanıyor...`);
    allRoutes = this.optimizeExpensiveRoutes(allRoutes);

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
      rentalVehicles: vehiclesToUse
        .filter(v => v.isRented)
        .map(v => ({
          id: v.id,
          name: v.name,
          capacity_kg: v.capacity_kg,
          rental_cost: v.rental_cost
        })),
      summary: {
        totalDistance: allRoutes.reduce((sum, r) => sum + parseFloat(r.totalDistance), 0).toFixed(2),
        totalWeight: allRoutes.reduce((sum, r) => sum + r.totalWeight, 0),
        averageCostPerVehicle: allRoutes.length > 0 ? (totalCost / allRoutes.length).toFixed(2) : 0
      }
    };
  }
}

module.exports = UnlimitedVehicleVRP;