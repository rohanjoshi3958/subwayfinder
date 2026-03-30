// MBTA API service for finding nearby subway stations
const MBTA_BASE_URL = 'https://api-v3.mbta.com';

// MBTA line colors and emojis
const MBTA_LINES = {
  'Red': { emoji: '🔴', color: '#DA291C' },
  'Orange': { emoji: '🟠', color: '#ED8B00' },
  'Blue': { emoji: '🔵', color: '#003DA5' },
  'Green-B': { emoji: 'B🟢', color: '#00843D' },
  'Green-C': { emoji: 'C🟢', color: '#00843D' },
  'Green-D': { emoji: 'D🟢', color: '#00843D' },
  'Green-E': { emoji: 'E🟢', color: '#00843D' },
  'Mattapan': { emoji: 'M🔴', color: '#FFC72C' }
};

// Helper function to add delay between API calls (retries / rate limits)
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const throwIfAborted = (signal) => {
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }
};

/** Like delay(), but bails out quickly when the user moves the pin (AbortSignal). */
const delayCancellable = async (ms, signal) => {
  if (!ms || ms <= 0) return;
  const step = 150;
  let remaining = ms;
  while (remaining > 0) {
    throwIfAborted(signal);
    const chunk = Math.min(step, remaining);
    await delay(chunk);
    remaining -= chunk;
  }
};

/**
 * MBTA `filter[radius]` is a circle in lat/lon space (not true miles on the ground).
 * Use a generous radius, then filter by real distance (Haversine) in the client.
 */
const milesToStopFilterRadiusDegrees = (radiusMiles, latitude) => {
  const latRad = (latitude * Math.PI) / 180;
  const milesPerDegLat = 69;
  const milesPerDegLon = 69 * Math.cos(latRad);
  const dLat = radiusMiles / milesPerDegLat;
  const dLon = radiusMiles / milesPerDegLon;
  return Math.max(dLat, dLon) * 1.45;
};

/** Prefer parent station id so one `/routes` call returns all lines at that complex. */
const canonicalStopIdForRoutes = (stop) => {
  const parent = stop.relationships?.parent_station?.data?.id;
  return parent || stop.id;
};

/** MBTA unauthenticated limit is ~20 requests/min; keep stop pagination minimal. */
const STOPS_PAGE_LIMIT = 1000;
const MAX_STOP_PAGES = 2;

const appendApiKey = (url) => {
  const key = process.env.REACT_APP_MBTA_API_KEY;
  if (!key) return url;
  try {
    const u = new URL(url);
    u.searchParams.set('api_key', key);
    return u.toString();
  } catch {
    return url;
  }
};

/**
 * At most MAX_STOP_PAGES requests. One page almost always covers a 1.25mi search in Boston.
 */
const fetchStopsInRadiusPages = async (latitude, longitude, radiusDeg, signal) => {
  const params = new URLSearchParams({
    'filter[route_type]': '0,1',
    'filter[latitude]': String(latitude),
    'filter[longitude]': String(longitude),
    'filter[radius]': String(radiusDeg),
    'page[limit]': String(STOPS_PAGE_LIMIT),
  });
  const all = [];
  let url = appendApiKey(`${MBTA_BASE_URL}/stops?${params.toString()}`);
  let pages = 0;
  while (url && pages < MAX_STOP_PAGES) {
    throwIfAborted(signal);
    const page = await makeApiCall(url, { signal });
    if (page.data?.length) {
      all.push(...page.data);
    }
    const next = page.links?.next || null;
    url = next ? appendApiKey(next) : null;
    pages += 1;
    if (!page.data || page.data.length < STOPS_PAGE_LIMIT) {
      break;
    }
  }
  return all;
};

// Helper function to make API calls with rate limiting and retry logic
const makeApiCall = async (url, options = {}) => {
  const { signal, maxRetries = 4 } = options;
  const requestUrl = appendApiKey(url);
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    throwIfAborted(signal);
    try {
      const response = await fetch(requestUrl, { signal });

      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '0', 10);
        const waitMs =
          retryAfter > 0
            ? Math.min(retryAfter * 1000, 45000)
            : Math.min(12000, Math.pow(2, attempt) * 800);
        console.warn(`MBTA rate limit (429), waiting ${waitMs}ms before retry ${attempt}/${maxRetries}`);
        await delayCancellable(waitMs, signal);
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      if (error.name === 'AbortError') {
        throw error;
      }
      console.error(`API call failed (attempt ${attempt}): ${requestUrl}`, error);

      if (attempt === maxRetries) {
        throw error;
      }

      await delayCancellable(Math.pow(2, attempt) * 500, signal);
    }
  }
};

// Calculate distance between two points using Haversine formula
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distanceKm = R * c; // Distance in kilometers
  return distanceKm * 0.621371; // Convert to miles
};

// Get line information from route data (MBTA `route.id` is the most reliable key)
const getLineInfo = (route) => {
  if (!route || !route.attributes) {
    return null;
  }

  const id = String(route.id || '');
  const routeName = `${route.attributes.long_name || ''} ${route.attributes.short_name || ''}`;

  if (id === 'Red' || id.startsWith('Red')) {
    return MBTA_LINES['Red'];
  }
  if (id === 'Orange' || id.includes('Orange')) {
    return MBTA_LINES['Orange'];
  }
  if (id === 'Blue' || id.startsWith('Blue')) {
    return MBTA_LINES['Blue'];
  }
  if (id === 'Mattapan' || id.includes('Mattapan')) {
    return MBTA_LINES['Mattapan'];
  }
  if (id === 'Green-B' || id.includes('Green-B')) {
    return MBTA_LINES['Green-B'];
  }
  if (id === 'Green-C' || id.includes('Green-C')) {
    return MBTA_LINES['Green-C'];
  }
  if (id === 'Green-D' || id.includes('Green-D')) {
    return MBTA_LINES['Green-D'];
  }
  if (id === 'Green-E' || id.includes('Green-E')) {
    return MBTA_LINES['Green-E'];
  }

  if (routeName.includes('Red')) {
    return MBTA_LINES['Red'];
  }
  if (routeName.includes('Orange')) {
    return MBTA_LINES['Orange'];
  }
  if (routeName.includes('Blue')) {
    return MBTA_LINES['Blue'];
  }
  if (routeName.includes('Mattapan')) {
    return MBTA_LINES['Mattapan'];
  }
  if (routeName.includes('Green') && routeName.includes('B')) {
    return MBTA_LINES['Green-B'];
  }
  if (routeName.includes('Green') && routeName.includes('C')) {
    return MBTA_LINES['Green-C'];
  }
  if (routeName.includes('Green') && routeName.includes('D')) {
    return MBTA_LINES['Green-D'];
  }
  if (routeName.includes('Green') && routeName.includes('E')) {
    return MBTA_LINES['Green-E'];
  }
  if (routeName.includes('Green') || id.includes('Green')) {
    return MBTA_LINES['Green-B'];
  }

  return null;
};

const routeToDisplay = (route) => {
  const line = getLineInfo(route);
  const name = route.attributes.long_name || route.attributes.short_name || route.id;
  if (line) {
    return {
      id: route.id,
      name,
      ...line,
    };
  }
  return {
    id: route.id,
    name,
    emoji: '🚇',
    color: '#555',
  };
};

// Fetch nearby MBTA stations (pass { signal } to cancel when the pin moves)
export const fetchNearbyStations = async (latitude, longitude, radius = 1.25, options = {}) => {
  const { signal } = options;
  try {
    console.log('Starting optimized MBTA API calls...');

    const radiusDeg = milesToStopFilterRadiusDegrees(radius, latitude);
    const stopRows = await fetchStopsInRadiusPages(latitude, longitude, radiusDeg, signal);

    if (!stopRows.length) {
      console.log('No stops returned from MBTA within filter radius');
    }

    const data = { data: stopRows };
    console.log('Stops loaded:', stopRows.length);

    // Helper function to create a unique key for a station
    const createStationKey = (stop) => {
      const lat = stop.attributes.latitude.toFixed(6);
      const lon = stop.attributes.longitude.toFixed(6);
      return `${stop.attributes.name}_${lat}_${lon}`;
    };

    // Group stops by location and name to deduplicate
    const stationGroups = new Map();
    
    data.data
      .filter(stop => stop.attributes.latitude && stop.attributes.longitude)
      .forEach(stop => {
        const stationKey = createStationKey(stop);
        
        if (!stationGroups.has(stationKey)) {
          stationGroups.set(stationKey, {
            stops: [],
            name: stop.attributes.name,
            latitude: stop.attributes.latitude,
            longitude: stop.attributes.longitude,
            wheelchair_accessible: stop.attributes.wheelchair_boarding === 1
          });
        }
        
        stationGroups.get(stationKey).stops.push(stop);
      });

    // Process each unique station
    const stationsWithDistance = Array.from(stationGroups.values())
      .map(stationGroup => {
        const distance = calculateDistance(
          latitude, 
          longitude, 
          stationGroup.latitude, 
          stationGroup.longitude
        );
        
        return {
          stationGroup,
          distance
        };
      })
      .filter(station => station.distance <= radius) // Filter by radius (in miles)
      .sort((a, b) => a.distance - b.distance) // Sort by distance
      .slice(0, 3); // Limit to 3 closest stations

    // Optimized approach: Use individual requests for accurate route mapping
    console.log('Getting routes for all stops efficiently...');
    
    // Since we're only showing 3 stations, fetch routes for all of them
    const maxStationsToFetch = 3; // Only fetch routes for the 3 closest stations
    const limitedStations = stationsWithDistance.slice(0, maxStationsToFetch);
    
    console.log(`Limiting to ${maxStationsToFetch} closest stations to reduce API calls`);
    
    // Collect stop IDs from only the closest stations
    const canonicalIds = [
      ...new Set(
        limitedStations.map(({ stationGroup }) =>
          canonicalStopIdForRoutes(stationGroup.stops[0])
        )
      ),
    ];
    console.log('Canonical stop IDs for route lookup:', canonicalIds);

    const canonicalRoutesMap = new Map();

    for (const stopId of canonicalIds) {
      throwIfAborted(signal);
      try {
        const stopRoutesData = await makeApiCall(
          `${MBTA_BASE_URL}/routes?filter[stop]=${encodeURIComponent(stopId)}&filter[type]=0,1`,
          { signal }
        );
        const routes = [];
        if (stopRoutesData.data) {
          stopRoutesData.data.forEach((route) => {
            routes.push(routeToDisplay(route));
          });
        }
        canonicalRoutesMap.set(stopId, routes);
      } catch (error) {
        if (error.name === 'AbortError') {
          throw error;
        }
        console.error(`Error fetching routes for stop ${stopId}:`, error);
        canonicalRoutesMap.set(stopId, []);
      }
      await delayCancellable(70, signal);
    }

    const stopRoutesMap = new Map();
    limitedStations.forEach(({ stationGroup }) => {
      const canonical = canonicalStopIdForRoutes(stationGroup.stops[0]);
      const routes = canonicalRoutesMap.get(canonical) || [];
      stationGroup.stops.forEach((stop) => {
        stopRoutesMap.set(stop.id, routes);
      });
    });

    console.log('Stop routes map (via canonical parents):', stopRoutesMap);

    // Process stations with their routes
    const stationsWithRoutes = stationsWithDistance.map((stationData) => {
      const { stationGroup, distance } = stationData;
      
      // Collect all routes from all stops in this station group
      const allRoutes = new Map(); // Use Map to avoid duplicates by route ID
      
      console.log(`Processing station group: ${stationGroup.name} with ${stationGroup.stops.length} stops`);
      
      const hasRouteData = stationGroup.stops.some(
        (stop) => (stopRoutesMap.get(stop.id) || []).length > 0
      );

      if (hasRouteData) {
        stationGroup.stops.forEach((stop) => {
          const stopRoutes = stopRoutesMap.get(stop.id) || [];
          stopRoutes.forEach((route) => {
            allRoutes.set(route.id, route);
          });
        });
      }
      
      console.log(`Final allRoutes for ${stationGroup.name}:`, Array.from(allRoutes.values()));
      
      const station = {
        id: stationGroup.stops[0].id, // Use the first stop's ID as the station ID
        name: stationGroup.name,
        latitude: stationGroup.latitude,
        longitude: stationGroup.longitude,
        distance: distance,
        wheelchair_accessible: stationGroup.wheelchair_accessible,
        routes: Array.from(allRoutes.values()),
        hasRouteData: hasRouteData // Flag to indicate if we have route data for this station
      };
      
      console.log(`Final station data for ${station.name}:`, station);
      
      return station;
    });

    // Remove duplicates by station name
    const finalStations = stationsWithRoutes.reduce((unique, station) => {
      // Remove duplicates by station name (case-insensitive)
      const stationNameLower = station.name.toLowerCase().trim();
      const existingStation = unique.find(s => s.name.toLowerCase().trim() === stationNameLower);
      
      if (!existingStation) {
        // Add new station
        unique.push(station);
      } else {
        // Merge routes from duplicate station into existing one
        const existingRoutes = new Map();
        existingStation.routes.forEach(route => existingRoutes.set(route.id, route));
        
        station.routes.forEach(route => {
          if (!existingRoutes.has(route.id)) {
            existingRoutes.set(route.id, route);
          }
        });
        
        existingStation.routes = Array.from(existingRoutes.values());
        
        // Keep the closer station if distances are different
        if (station.distance < existingStation.distance) {
          existingStation.distance = station.distance;
          existingStation.latitude = station.latitude;
          existingStation.longitude = station.longitude;
        }
        
        // Update wheelchair accessibility if either station has it
        if (station.wheelchair_accessible) {
          existingStation.wheelchair_accessible = true;
        }
      }
      
      return unique;
    }, []);

    console.log('Final stations with routes:', finalStations);
    return finalStations;
  } catch (error) {
    console.error('Error fetching MBTA stations:', error);
    throw error;
  }
};

// Get station details including routes
export const getStationDetails = async (stationId) => {
  try {
    const data = await makeApiCall(`${MBTA_BASE_URL}/stops/${stationId}?include=route`);
    return data.data;
  } catch (error) {
    console.error('Error fetching station details:', error);
    throw error;
  }
};
