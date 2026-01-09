import polyline from 'polyline';
import Constants from 'expo-constants';

const ORS_API_KEY = Constants.expoConfig?.extra?.openRouteServiceApiKey || "";

// Coordinates should be in [longitude, latitude] format
// For direct walk: pass only first two params → returns [directions]
// For bus trip: pass all four params → returns [toStopDirections, fromStopDirections]
export async function getWalkingDirections(startCoordsFirst, endCoordsFirst, startCoordsSecond, endCoordsSecond) {
    const firstDirections = fetchDirections(startCoordsFirst, endCoordsFirst);

    if (!startCoordsSecond || !endCoordsSecond) {
        return [await firstDirections];
    }

    const secondDirections = fetchDirections(startCoordsSecond, endCoordsSecond);
    return Promise.all([firstDirections, secondDirections]);
}

async function fetchDirections(startCoords, endCoords) {
    const OSREndpoint = "https://api.openrouteservice.org/v2/directions/foot-walking/json";
    try {
        const response = await fetch(OSREndpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json; charset=utf-8",
                "Accept": "application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8",
                "Authorization": ORS_API_KEY
            },
            body: JSON.stringify({coordinates: [startCoords, endCoords]})
        });
        if (!response.ok) {
            throw new Error(`Response status: ${response.status}`);
        }

        const result = await response.json();
        const route = result.routes[0];
        const segments = route.segments[0];

        return {
            polyline: polyline.decode(route.geometry).map(([lat, lng]) => ({
                latitude: lat,
                longitude: lng
            })),
            distance: segments.distance,
            duration: segments.duration,
            steps: segments.steps.map((step) => ({
                distance: step.distance,
                duration: step.duration,
                instruction: step.instruction,
                type: step.type,
                name: step.name,
                wayPoints: step.way_points
            }))
        };

    } catch (error) {
        console.error(error.message);
        throw error;
    }
}