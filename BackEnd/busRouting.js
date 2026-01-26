// busRouting.js - OSU Bus Route Planning Algorithm


/**
 * Calculate distance between two points using Haversine formula
 * @returns distance in meters
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

/**
 * Calculate walking time between two points
 * @returns time in minutes
 */
function calculateWalkTime(point1, point2) {
  //console.log('calculateWalkTime called with:', point1, point2);
  
  if (!point1 || !point2 || !point1.latitude || !point1.longitude || !point2.latitude || !point2.longitude) {
    console.error('Invalid points for calculateWalkTime:', point1, point2);
    return 0;
  }
  
  const distance = haversineDistance(
    point1.latitude,
    point1.longitude,
    point2.latitude,
    point2.longitude
  );
  
  //console.log(`Distance: ${distance.toFixed(2)} meters`);
  
  // Average walking speed: 1.1
  const walkingSpeedMPS = 1.1;
  const walkTimeMinutes = distance / walkingSpeedMPS / 60;
  
  //console.log(`Walk time: ${walkTimeMinutes.toFixed(2)} minutes at ${walkingSpeedMPS} m/s`);
  
  return walkTimeMinutes; // Convert to minutes
}

/**
 * Find all stops within walking distance of a location
 * @param {Object} location - {latitude, longitude}
 * @param {Object} routes - All bus routes
 * @param {number} maxWalkMeters - Maximum walking distance (default 400m ~ 5 min walk)
 * @returns {Array} Array of nearby stops with route info
 */
function findNearbyStops(location, routes, maxWalkMeters = 400) {
  const nearbyStops = [];
  
  Object.values(routes).forEach((route) => {
    if (!route || !route.stops) return;
    
    route.stops.forEach((stop) => {
      const distance = haversineDistance(
        location.latitude,
        location.longitude,
        stop.latitude,
        stop.longitude
      );
      
      if (distance <= maxWalkMeters) {
        const walkTimeMinutes = distance / 1.1 / 60; // Use consistent walking speed: 1.1 m/s
        nearbyStops.push({
          stopId: stop.id,
          stopName: stop.name,
          latitude: stop.latitude,
          longitude: stop.longitude,
          routeId: route.id,
          routeName: route.name,
          routeColor: route.color,
          distanceMeters: distance,
          walkTimeMinutes: walkTimeMinutes,
        });
      }
    });
  });
  
  return nearbyStops;
}

/**
 * Check if a trip from startStop to endStop is valid (correct direction)
 * Uses the route's stop list to verify the end stop comes after the start stop
 * Supports circular routes where end index may be lower than start index
 * @returns {Object} {valid: boolean, stopsBetween: number}
 */
function isValidDirection(route, startStopId, endStopId) {
  if (!route || !route.stops) {
    console.log(`isValidDirection: No route or stops for ${startStopId} -> ${endStopId}`);
    return { valid: false, stopsBetween: 0 };
  }

  // Create a map of stop IDs to their positions
  const stopPositions = {};
  route.stops.forEach((stop, index) => {
    stopPositions[stop.id] = index;
  });

  const startIndex = stopPositions[startStopId];
  const endIndex = stopPositions[endStopId];
  const totalStops = route.stops.length;

  if (startIndex === undefined || endIndex === undefined) {
    return { valid: false, stopsBetween: 0 };
  }

  // Same stop - not a valid trip
  if (startIndex === endIndex) {
    return { valid: false, stopsBetween: 0 };
  }

  // Check if route is circular (first and last stops are the same or very close)
  const isCircular = route.isCircular ||
    (route.stops.length > 2 && route.stops[0].id === route.stops[totalStops - 1].id);

  // Standard case: end stop comes after start stop
  if (endIndex > startIndex) {
    return {
      valid: true,
      stopsBetween: endIndex - startIndex
    };
  }

  // For circular routes: can go "around" the loop
  if (isCircular && endIndex < startIndex) {
    // Stops = (remaining stops to end of route) + (stops from start of route to end stop)
    const stopsBetween = (totalStops - startIndex) + endIndex;
    return {
      valid: true,
      stopsBetween: stopsBetween
    };
  }

  return { valid: false, stopsBetween: 0 };
}

/**
 * Find the next bus arriving at a specific stop using live prediction data
 * @param {Object} route - Route object with vehicles
 * @param {string} stopId - Stop ID to check
 * @param {number} minArrivalTime - Minimum arrival time in minutes (user's walk time to stop)
 * @returns {Object|null} Vehicle info with ETA and full prediction, or null if no buses found
 */
function findNextBus(route, stopId, minArrivalTime = 0) {
  if (!route || !route.vehicles || route.vehicles.length === 0) {
    return null;
  }

  let closestBus = null;
  let shortestWait = Infinity;

  // Check each vehicle's predictions for this stop
  route.vehicles.forEach((vehicle) => {
    if (!vehicle.predictions || vehicle.predictions.length === 0) {
      return;
    }

    // Find prediction for this specific stop
    const prediction = vehicle.predictions.find(
      (pred) => pred.stopId === stopId
    );

    if (prediction && prediction.timeToArrivalInSeconds !== undefined) {
      const busArrivalMinutes = prediction.timeToArrivalInSeconds / 60;

      // Only consider buses that arrive AFTER the user can get there
      // Bus must arrive at least when user arrives (busArrival >= minArrivalTime)
      if (busArrivalMinutes >= minArrivalTime && busArrivalMinutes < shortestWait) {
        shortestWait = busArrivalMinutes;
        closestBus = {
          vehicleId: vehicle.id,
          eta: busArrivalMinutes,
          // Actual wait time = bus arrival - user arrival
          waitTime: busArrivalMinutes - minArrivalTime,
          predictionTime: prediction.predictionTime,
          countdown: prediction.predictionCountdown,
          isDelayed: prediction.isDelayed,
          prediction: prediction,
          vehicle: vehicle,
        };
      }
    }
  });

  return closestBus;
}

/**
 * Estimate bus travel time between two stops using live prediction data
 * @param {Object} route - Route object
 * @param {string} startStopId - Starting stop ID
 * @param {string} endStopId - Ending stop ID
 * @param {Object} busInfo - Bus info from findNextBus (includes vehicle and prediction)
 * @returns time in minutes
 */
function estimateBusTravelTime(route, startStopId, endStopId, busInfo = null) {
  // PRIORITY: Use live prediction data from the vehicle's predictions array
  if (busInfo && busInfo.vehicle && busInfo.vehicle.predictions) {
    const predictions = busInfo.vehicle.predictions;
    
    const startPred = predictions.find(p => p.stopId === startStopId);
    const endPred = predictions.find(p => p.stopId === endStopId);
    
    if (startPred && endPred && 
        startPred.timeToArrivalInSeconds !== undefined && 
        endPred.timeToArrivalInSeconds !== undefined) {
      // Calculate difference in arrival times
      const travelTimeSec = endPred.timeToArrivalInSeconds - startPred.timeToArrivalInSeconds;
      
      if (travelTimeSec > 0) {
        return travelTimeSec / 60; // Convert to minutes
      }
    }
  }
  
  // FALLBACK: Calculate based on distance and average bus speed
  const startStop = route.stops?.find(s => s.id === startStopId);
  const endStop = route.stops?.find(s => s.id === endStopId);
  
  if (!startStop || !endStop) {
    return 10; // Default fallback: 10 minutes
  }
  
  const distance = haversineDistance(
    startStop.latitude,
    startStop.longitude,
    endStop.latitude,
    endStop.longitude
  );
  
  // Average bus speed in urban areas: ~6.7 m/s (15 mph / 24 km/h)
  // This accounts for stops, traffic, etc.
  const avgBusSpeedMPS = 6.7;
  return distance / avgBusSpeedMPS / 60; // Convert to minutes
}

/**
 * Main function: Find the best bus route from user location to destination
 * Only considers bus options - no longer compares to walking
 * @param {Object} userLocation - {latitude, longitude}
 * @param {Object} destinationLocation - {latitude, longitude}
 * @param {Object} routes - All available bus routes
 * @returns {Object} Best bus route recommendation
 */
export async function findBestRoute(userLocation, destinationLocation, routes) {
  
  
    // Validation
  if (!userLocation || !destinationLocation || !routes) {
    return {
      recommendation: 'error',
      reason: 'Missing required data',
    };
  }

  const directWalkTime = calculateWalkTime(userLocation, destinationLocation);
  
  // Find all possible bus trips
  const startStops = findNearbyStops(userLocation, routes, 400);
  const endStops = findNearbyStops(destinationLocation, routes, 400);
  
  if (startStops.length === 0) {
    return {
      recommendation: 'error',
      reason: 'No bus stops nearby (within 400m)',
      directWalkTime: directWalkTime,
      nearbyStartStops: startStops,
    };
  }
  
  if (endStops.length === 0) {
    return {
      recommendation: 'error',
      reason: 'No bus stops near destination',
      directWalkTime: directWalkTime,
      nearbyEndStops: endStops,
    };
  }
  
  // Check direction, get live ETAs, and calculate total time
  const possibleTrips = [];
  
  //console.log(`\n=== Checking ${startStops.length} start stops x ${endStops.length} end stops ===`);
  
  for (const startStop of startStops) {
    const route = routes[startStop.routeId];
    if (!route) continue;
    
    //console.log(`\nStart stop: ${startStop.stopName} (${startStop.stopId}) on route ${route.id}`);
    
    for (const endStop of endStops) {
      // Only consider stops on the same route
      if (endStop.routeId !== startStop.routeId) continue;
      
      //console.log(`  End stop: ${endStop.stopName} (${endStop.stopId})`);
      
      // Check if direction is valid
      const directionCheck = isValidDirection(route, startStop.stopId, endStop.stopId);
      if (!directionCheck.valid) continue;
      
      // Get the next bus that arrives AFTER user can walk to the stop
      const nextBus = findNextBus(route, startStop.stopId, startStop.walkTimeMinutes);
      if (!nextBus) {
        continue;
      }

      // Calculate bus travel time using live prediction data
      const busTravelTime = estimateBusTravelTime(
        route,
        startStop.stopId,
        endStop.stopId,
        nextBus
      );

      // Calculate walk time from end stop to destination
      const walkFromStop = calculateWalkTime(
        { latitude: endStop.latitude, longitude: endStop.longitude },
        destinationLocation
      );

      // Total time = walk to stop + wait for bus + ride + walk from stop
      const totalTime =
        startStop.walkTimeMinutes +  // Walk to start stop
        nextBus.waitTime +           // Wait at stop (bus arrival - user arrival)
        busTravelTime +              // Ride the bus
        walkFromStop;                // Walk from end stop to destination

      possibleTrips.push({
        routeId: route.id,
        routeName: route.name,
        routeColor: route.color,
        startStop: {
          id: startStop.stopId,
          name: startStop.stopName,
          latitude: startStop.latitude,
          longitude: startStop.longitude,
        },
        endStop: {
          id: endStop.stopId,
          name: endStop.stopName,
          latitude: endStop.latitude,
          longitude: endStop.longitude,
        },
        busId: nextBus.vehicleId,
        busETA: nextBus.eta,
        busCountdown: nextBus.countdown,
        isDelayed: nextBus.isDelayed,
        arrivalTime: nextBus.predictionTime,
        walkToStopTime: startStop.walkTimeMinutes,
        busWaitTime: nextBus.waitTime,  // Actual wait time at stop
        busTravelTime: busTravelTime,
        walkFromStopTime: walkFromStop,
        totalTime: totalTime,
        ETA: calculateETA(totalTime),
        stopsBetween: directionCheck.stopsBetween,
      });
    }
  }
  
  // Find the best trip
  if (possibleTrips.length === 0) {
    return {
      recommendation: 'error',
      reason: 'No buses running along your route',
      nearbyStartStops: startStops,
      nearbyEndStops: endStops,
    };
  }
  
  // Sort by total time, with closest start stop as tiebreaker when times are similar
  const TIME_SIMILARITY_THRESHOLD = 1; // minutes - consider times "about the same" if within this range
  possibleTrips.sort((a, b) => {
    const timeDiff = a.totalTime - b.totalTime;

    // If arrival times are within threshold, prioritize closer start stop
    if (Math.abs(timeDiff) <= TIME_SIMILARITY_THRESHOLD) {
      return a.walkToStopTime - b.walkToStopTime;
    }

    return timeDiff;
  });
  const bestTrip = possibleTrips[0];
  
  return {
  recommendation: 'bus',
  route: {
    id: bestTrip.routeId,
    name: bestTrip.routeName,
    routeColor: bestTrip.routeColor,
    routeShortName: bestTrip.routeId,
    routeLongName: bestTrip.routeName,
  },
  trip: {
    ...bestTrip,
    fromStop: bestTrip.startStop.name,
    toStop: bestTrip.endStop.name,
    waitTime: bestTrip.busWaitTime,
    busTime: bestTrip.busTravelTime,
  },
  directWalkTime: directWalkTime,
  alternativeTrips: possibleTrips.slice(1, 3),
};
}

/**
 * Format time in a human-readable way
 */
export function formatTime(minutes) {
  if (minutes < 1) {
    return 'less than 1 min';
  }
  const mins = Math.round(minutes);
  return `${mins} min${mins !== 1 ? 's' : ''}`;
}

/**
 * Calculate the ETA for a trip
 * @param {number} totalTime - Total time in minutes
 * @returns {string} ETA in the format of "HH:MM"
 */
function calculateETA(totalTime) {
  const nowInSeconds =  Date.now() / 1000;
  const etaInSeconds = nowInSeconds + totalTime * 60;
  
  const etaDate = new Date(etaInSeconds * 1000);
  let hours = etaDate.getHours();
  if (hours > 12) {
    hours -= 12;
  }
  const minutes = etaDate.getMinutes();

  return `${hours}:${minutes}`;
}
