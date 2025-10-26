// src/osuBusAPI.js

export async function fetchAllRoutesFast() {
  const routeIds = ['BE', 'CC', 'CLS', 'ER', 'MC', 'MWC', 'WMC'];

  try {
    // Fetch all route endpoints in parallel
    const promises = routeIds.map(async (id) => {
      const response = await fetch(`https://content.osu.edu/v2/bus/routes/${id}`);

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status} for route ${id}`);
      }

      const data = await response.json();
      return { id, data };
    });

    const resultsArray = await Promise.all(promises);

    // Convert array into an object keyed by route ID
    const results = {};
    resultsArray.forEach(({ id, data }) => {
      results[id] = data;
    });

    console.log('Fetched all routes:', results);
    return results;
  } catch (error) {
    console.error('Error fetching all routes:', error);
    return null;
  }
}
