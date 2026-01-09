import fetchAllRoutes from './osuBusAPI.js';
import findBestRoute from './busRouting.js';
import getWalkingDirections from './walkingDirectionsAPI.js';

/*
 * Returns: { bestBusRoute, walkingDirections }
 * (shoutout to Claude Code for this documentation)
 *
 * If bestBusRoute.recommendation === 'error', walkingDirections will be null.
 *
 * bestBusRoute - Best route recommendation (from findBestRoute)
 * {
 *   recommendation: 'bus' | 'error',
 *   route: {
 *     id: string,                       // e.g., "BE"
 *     name: string,                     // e.g., "Buckeye Express"
 *     routeColor: string,
 *     routeShortName: string,
 *     routeLongName: string
 *   },
 *   trip: {
 *     routeId: string,
 *     routeName: string,
 *     routeColor: string,
 *     startStop: { id, name, latitude, longitude },
 *     endStop: { id, name, latitude, longitude },
 *     fromStop: string,                 // startStop.name
 *     toStop: string,                   // endStop.name
 *     busId: string,
 *     busETA: number,                   // minutes
 *     busCountdown: string,             // e.g., "5 mins"
 *     isDelayed: boolean,
 *     arrivalTime: string,
 *     walkToStopTime: number,           // minutes
 *     waitTime: number,                 // minutes (same as busWaitTime)
 *     busWaitTime: number,              // minutes
 *     busTime: number,                  // minutes (same as busTravelTime)
 *     busTravelTime: number,            // minutes
 *     walkFromStopTime: number,         // minutes
 *     totalTime: number,                // minutes
 *     ETA: string,                      // e.g., "3:45"
 *     stopsBetween: number
 *   },
 *   directWalkTime: number,             // minutes
 *   alternativeTrips: [{ ...same as trip... }, ...]
 * }
 *
 * walkingDirections - Walking directions for both segments (from getWalkingDirections)
 * [
 *   {                                   // Walk TO bus stop
 *     polyline: [{ latitude, longitude }, ...],
 *     distance: number,                 // meters
 *     duration: number,                 // seconds
 *     steps: [{
 *       distance: number,               // meters
 *       duration: number,               // seconds
 *       instruction: string,            // e.g., "Turn left onto Neil Ave"
 *       type: number,                   // instruction type code
 *       name: string,                   // street name
 *       wayPoints: [number, number]     // indices into polyline
 *     }, ...]
 *   },
 *   {                                   // Walk FROM bus stop
 *     polyline: [{ latitude, longitude }, ...],
 *     distance: number,
 *     duration: number,
 *     steps: [{ ... }]
 *   }
 * ]
 */

export default async function aggregateRouteInfo(startCoords, endCoords) {
    const busRoutes = await fetchAllRoutes();
    const bestBusRoute = await findBestRoute(startCoords, endCoords, busRoutes);

    if (bestBusRoute.recommendation === 'error') {
        const walkingOnlyDirections = await getWalkingDirections(startCoords, endCoords);
        return { bestBusRoute, walkingDirections: walkingOnlyDirections };
    }

    const firstStopCoords = [bestBusRoute.trip.startStop.longitude, bestBusRoute.trip.startStop.latitude];
    const lastStopCoords = [bestBusRoute.trip.endStop.longitude, bestBusRoute.trip.endStop.latitude];
    const walkingDirections = await getWalkingDirections(
        [startCoords.longitude, startCoords.latitude],
        firstStopCoords,
        
        lastStopCoords,
        [endCoords.longitude, endCoords.latitude]
    );

    return { bestBusRoute, walkingDirections };
}