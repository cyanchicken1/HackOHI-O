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
 * @param {number} maxWalkMeters - Maximum walking distance (default 750m)
 * @returns {Array} Array of nearby stops with route info
 */
function findNearbyStops(location, routes, maxWalkMeters = 750) {
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
 * @returns {Object} { travelTime: minutes, stopsBetween: count } or { travelTime: 0 } if invalid
 */
function estimateBusTravelTime(route, startStopId, endStopId, busInfo = null) {
  // PRIORITY: Use live prediction data from the vehicle's predictions array
  if (busInfo && busInfo.vehicle && busInfo.vehicle.predictions) {
    const predictions = busInfo.vehicle.predictions;

    // Find the first prediction for the start stop
    const startPred = predictions.find(p => p.stopId === startStopId);
    if (!startPred || startPred.timeToArrivalInSeconds === undefined) {
      return { travelTime: 0, stopsBetween: 0 }; // No valid start prediction
    }

    const startTime = startPred.timeToArrivalInSeconds;

    // Find the next occurrence of the start stop (when bus loops back)
    // We only want to consider end stops BEFORE the bus returns to start
    const nextStartPred = predictions.find(
      p => p.stopId === startStopId && p.timeToArrivalInSeconds > startTime
    );
    const loopBackTime = nextStartPred ? nextStartPred.timeToArrivalInSeconds : Infinity;

    // Find the end stop prediction that comes AFTER start but BEFORE loop back
    const endPred = predictions.find(
      p => p.stopId === endStopId &&
           p.timeToArrivalInSeconds !== undefined &&
           p.timeToArrivalInSeconds > startTime &&
           p.timeToArrivalInSeconds < loopBackTime
    );

    if (endPred) {
      const travelTimeSec = endPred.timeToArrivalInSeconds - startTime;
      const endTime = endPred.timeToArrivalInSeconds;

      // Count unique stops between start and end (exclusive of start, inclusive of end)
      const stopsBetween = new Set(
        predictions
          .filter(p =>
            p.timeToArrivalInSeconds > startTime &&
            p.timeToArrivalInSeconds <= endTime
          )
          .map(p => p.stopId)
      ).size;

      return {
        travelTime: travelTimeSec / 60, // Convert to minutes
        stopsBetween: stopsBetween
      };
    }

    // No valid end stop found before loop back
    return { travelTime: 0, stopsBetween: 0 };
  }

  // FALLBACK: No prediction data - return 0 to indicate we can't validate this trip
  // We require live prediction data to confirm direction
  return { travelTime: 0, stopsBetween: 0 };
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
  const startStops = findNearbyStops(userLocation, routes, 750);
  const endStops = findNearbyStops(destinationLocation, routes, 750);
  
  if (startStops.length === 0) {
    return {
      recommendation: 'error',
      reason: 'No bus stops nearby (within 750m)',
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

      // Same stop - skip
      if (startStop.stopId === endStop.stopId) continue;

      // Get the next bus that arrives AFTER user can walk to the stop
      const nextBus = findNextBus(route, startStop.stopId, startStop.walkTimeMinutes);
      if (!nextBus) {
        continue;
      }

      // Calculate bus travel time using live prediction data
      // This also validates direction - if travelTime <= 0, the bus goes the wrong way
      const busEstimate = estimateBusTravelTime(
        route,
        startStop.stopId,
        endStop.stopId,
        nextBus
      );

      // Skip if bus doesn't go from start to end (wrong direction or no valid prediction)
      if (busEstimate.travelTime <= 0) continue;

      // Calculate walk time from end stop to destination
      const walkFromStop = calculateWalkTime(
        { latitude: endStop.latitude, longitude: endStop.longitude },
        destinationLocation
      );

      // Total time = walk to stop + wait for bus + ride + walk from stop
      const totalTime =
        startStop.walkTimeMinutes +  // Walk to start stop
        nextBus.waitTime +           // Wait at stop (bus arrival - user arrival)
        busEstimate.travelTime +     // Ride the bus
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
        busTravelTime: busEstimate.travelTime,
        walkFromStopTime: walkFromStop,
        totalTime: totalTime,
        ETA: calculateETA(totalTime),
        stopsBetween: busEstimate.stopsBetween,
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
