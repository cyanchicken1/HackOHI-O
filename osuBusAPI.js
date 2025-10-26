export async function fetchAllRoutes() {
  const routeIds = ['BE', 'CC', 'CLS', 'ER', 'MC', 'MWC', 'WMC'];

  const promises = routeIds.map(async (id) => {
    try {
      // Fetch route data
      const response = await fetch(`https://content.osu.edu/v2/bus/routes/${id}`);
      if (!response.ok) {
        console.warn(`Route ${id} fetch failed: HTTP ${response.status}`);
        return null;
      }

      const routeJson = await response.json();
      const routeData = routeJson.data;

      if (!routeData) return null;

      const stops = routeData.stops?.map((stop) => ({
        id: stop.id,
        name: stop.name,
        latitude: stop.latitude,
        longitude: stop.longitude,
      })) || [];

      const patterns = routeData.patterns?.map((pattern) => ({
        id: pattern.id,
        direction: pattern.direction,
        length: pattern.length,
        encodedPolyline: pattern.encodedPolyline,
      })) || [];

      // Fetch vehicle locations for this route
      let vehicles = [];
      try {
        const vehiclesResponse = await fetch(`https://content.osu.edu/v2/bus/routes/${id}/vehicles`);
        if (vehiclesResponse.ok) {
          const vehiclesJson = await vehiclesResponse.json();
          
          // ✅ The vehicles are in data.vehicles, not just data
          const vehicleArray = vehiclesJson.data?.vehicles || [];
          
          vehicles = vehicleArray.map((vehicle) => ({
  id: vehicle.id,
  latitude: vehicle.latitude,
  longitude: vehicle.longitude,
  heading: vehicle.heading,
  speed: vehicle.speed,
  destination: vehicle.destination,
  routeCode: vehicle.routeCode,
  predictions: vehicle.predictions || [],

  // Get the first prediction's stop name as the next stop
  nextStop:
    (vehicle.predictions && vehicle.predictions[0]?.stopName) ||
    vehicle.destination ||
    'Unknown',
  lastUpdated: vehicle.updated,
}));
        } else {
          console.warn(`Vehicles for route ${id} fetch failed: HTTP ${vehiclesResponse.status}`);
        }
      } catch (vehicleErr) {
        console.error(`Route ${id} vehicles fetch error:`, vehicleErr);
      }

      return {
        id,
        name: routeData.name || 'Unknown',
        color: routeData.color || '#990000',
        stops,
        patterns,
        vehicles,
      };
    } catch (err) {
      console.error(`Route ${id} fetch error:`, err);
      return null;
    }
  });

  const routesArray = (await Promise.all(promises)).filter(Boolean);

  const routes = {};
  routesArray.forEach((r) => (routes[r.id] = r));

  return routes;
}