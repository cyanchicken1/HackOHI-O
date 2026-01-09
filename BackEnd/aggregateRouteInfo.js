import { fetchAllRoutes } from './osuBusAPI.js';
import { findBestRoute } from './busRouting.js';
import { getWalkingDirections } from './walkingDirectionsAPI.js';

/*
 * Returns a clean route object with segments array (shoutout to Claude Code)
 *
 * {
 *   recommendation: 'bus' | 'walk' | 'error',
 *   error?: string,                     // only if recommendation === 'error'
 *
 *   route: {                            // bus route info (null if walk-only)
 *     id: string,                       // e.g., "BE"
 *     name: string,                     // e.g., "Buckeye Express"
 *     color: string                     // e.g., "#BB0000"
 *   },
 *
 *   segments: [                         // walk → wait → ride → walk
 *     {
 *       type: 'walk',
 *       from: { latitude, longitude },
 *       to: { latitude, longitude, name },
 *       duration: number,               // minutes
 *       distance: number,               // meters
 *       polyline: [{ latitude, longitude }, ...],
 *       steps: [{ instruction, distance, duration, type, name, wayPoints }, ...]
 *     },
 *     {
 *       type: 'wait',
 *       stop: { id, name, latitude, longitude },
 *       duration: number,               // minutes
 *       bus: { id, countdown, isDelayed }
 *     },
 *     {
 *       type: 'ride',
 *       fromStop: { id, name, latitude, longitude },
 *       toStop: { id, name, latitude, longitude },
 *       duration: number,               // minutes
 *       stopsBetween: number
 *     },
 *     {
 *       type: 'walk',
 *       from: { latitude, longitude, name },
 *       to: { latitude, longitude },
 *       duration: number,               // minutes
 *       distance: number,               // meters
 *       polyline: [{ latitude, longitude }, ...],
 *       steps: [{ ... }]
 *     }
 *   ],
 *
 *   totalTime: number,                  // minutes
 *   eta: string,                        // e.g., "3:45"
 *   directWalkTime: number,             // minutes (for comparison)
 *   alternativeTrips: [...]             // other route options (raw format)
 * }
 */

export default async function aggregateRouteInfo(startCoords, endCoords) {
    const busRoutes = await fetchAllRoutes();
    const rawRoute = await findBestRoute(startCoords, endCoords, busRoutes);

    // Handle error case - return walk-only directions
    if (rawRoute.recommendation === 'error') {
        const walkingDirections = await getWalkingDirections(
            [startCoords.longitude, startCoords.latitude],
            [endCoords.longitude, endCoords.latitude]
        );
        const walkDuration = walkingDirections[0].duration / 60;

        return {
            recommendation: 'walk',
            error: rawRoute.reason,
            route: null,
            segments: [{
                type: 'walk',
                from: { latitude: startCoords.latitude, longitude: startCoords.longitude },
                to: { latitude: endCoords.latitude, longitude: endCoords.longitude },
                duration: walkDuration,
                distance: walkingDirections[0].distance,
                polyline: walkingDirections[0].polyline,
                steps: walkingDirections[0].steps
            }],
            totalTime: walkDuration,
            eta: formatETA(walkDuration),
            directWalkTime: rawRoute.directWalkTime,
            alternativeTrips: []
        };
    }

    // Fetch actual walking directions
    const firstStopCoords = [rawRoute.trip.startStop.longitude, rawRoute.trip.startStop.latitude];
    const lastStopCoords = [rawRoute.trip.endStop.longitude, rawRoute.trip.endStop.latitude];
    const walkingDirections = await getWalkingDirections(
        [startCoords.longitude, startCoords.latitude],
        firstStopCoords,
        lastStopCoords,
        [endCoords.longitude, endCoords.latitude]
    );

    // Calculate actual walk times
    const walkToStopDuration = walkingDirections[0].duration / 60;
    const walkFromStopDuration = walkingDirections[1].duration / 60;
    const totalTime = walkToStopDuration + rawRoute.trip.busWaitTime + rawRoute.trip.busTravelTime + walkFromStopDuration;

    return {
        recommendation: 'bus',
        route: {
            id: rawRoute.route.id,
            name: rawRoute.route.name,
            color: rawRoute.route.routeColor
        },
        segments: [
            {
                type: 'walk',
                from: { latitude: startCoords.latitude, longitude: startCoords.longitude },
                to: rawRoute.trip.startStop,
                duration: walkToStopDuration,
                distance: walkingDirections[0].distance,
                polyline: walkingDirections[0].polyline,
                steps: walkingDirections[0].steps
            },
            {
                type: 'wait',
                stop: rawRoute.trip.startStop,
                duration: rawRoute.trip.busWaitTime,
                bus: {
                    id: rawRoute.trip.busId,
                    countdown: rawRoute.trip.busCountdown,
                    isDelayed: rawRoute.trip.isDelayed
                }
            },
            {
                type: 'ride',
                fromStop: rawRoute.trip.startStop,
                toStop: rawRoute.trip.endStop,
                duration: rawRoute.trip.busTravelTime,
                stopsBetween: rawRoute.trip.stopsBetween
            },
            {
                type: 'walk',
                from: rawRoute.trip.endStop,
                to: { latitude: endCoords.latitude, longitude: endCoords.longitude },
                duration: walkFromStopDuration,
                distance: walkingDirections[1].distance,
                polyline: walkingDirections[1].polyline,
                steps: walkingDirections[1].steps
            }
        ],
        totalTime,
        eta: formatETA(totalTime),
        directWalkTime: rawRoute.directWalkTime,
        alternativeTrips: rawRoute.alternativeTrips
    };
}

function formatETA(totalMinutes) {
    const now = new Date();
    now.setMinutes(now.getMinutes() + totalMinutes);
    let hours = now.getHours();
    if (hours > 12) hours -= 12;
    if (hours === 0) hours = 12;
    const minutes = now.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
}