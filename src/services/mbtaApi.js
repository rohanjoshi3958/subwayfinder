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

// Cache for routes data to avoid repeated API calls
let routesCache = null;
let routesCacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Helper function to add delay between API calls
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to make API calls with rate limiting and retry logic
const makeApiCall = async (url, maxRetries = 2) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Making API call (attempt ${attempt}): ${url}`);
      
      const response = await fetch(url);
      
      if (response.status === 429) {
        const waitTime = Math.pow(2, attempt) * 1000; // Exponential backoff: 2s, 4s
        console.log(`Rate limit hit, waiting ${waitTime}ms before retry...`);
        await delay(waitTime);
        continue; // Retry
      }
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`API call successful: ${url}`);
      return data;
      
    } catch (error) {
      console.error(`API call failed (attempt ${attempt}): ${url}`, error);
      
      if (attempt === maxRetries) {
        throw error; // Re-throw on final attempt
      }
      
      // Wait before retry (exponential backoff)
      const waitTime = Math.pow(2, attempt) * 1000;
      console.log(`Waiting ${waitTime}ms before retry...`);
      await delay(waitTime);
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

// Get line information from route data
const getLineInfo = (route) => {
  if (!route || !route.attributes) {
    console.log('Invalid route object:', route);
    return null;
  }
  
  const routeName = route.attributes.long_name || route.attributes.short_name || '';
  const routeId = route.id || '';
  
  // Map route names to line colors
  if (routeName.includes('Red') || routeId.includes('Red')) {
    return MBTA_LINES['Red'];
  }
  if (routeName.includes('Orange') || routeId.includes('Orange')) {
    return MBTA_LINES['Orange'];
  }
  if (routeName.includes('Blue') || routeId.includes('Blue')) {
    return MBTA_LINES['Blue'];
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
  if (routeName.includes('Mattapan') || routeId.includes('Mattapan')) {
    return MBTA_LINES['Mattapan'];
  }
  
  // Default for Green line without specific branch
  if (routeName.includes('Green') || routeId.includes('Green')) {
    return MBTA_LINES['Green-B'];
  }
  
  return null;
};

// Get cached routes or fetch new ones
const getRoutesData = async () => {
  const now = Date.now();
  
  // Check if we have valid cached data
  if (routesCache && (now - routesCacheTimestamp) < CACHE_DURATION) {
    console.log('Using cached routes data');
    return routesCache;
  }
  
  console.log('Fetching fresh routes data');
  const routesData = await makeApiCall(`${MBTA_BASE_URL}/routes?filter[type]=0,1`);
  
  // Cache the data
  routesCache = routesData;
  routesCacheTimestamp = now;
  
  return routesData;
};

// Fetch nearby MBTA stations
export const fetchNearbyStations = async (latitude, longitude, radius = 1.25) => {
  try {
    console.log('Starting optimized MBTA API calls...');
    
    // Get routes data (cached if possible)
    const routesData = await getRoutesData();
    
    console.log('Routes API Response:', routesData);
    
    // Create a map of route IDs to line information
    const routeLineMap = {};
    if (routesData.data) {
      console.log('Processing routes data:', routesData.data.length, 'routes');
      routesData.data.forEach((route, index) => {
        const lineInfo = getLineInfo(route);
        if (lineInfo) {
          routeLineMap[route.id] = {
            id: route.id,
            name: route.attributes.long_name || route.attributes.short_name,
            ...lineInfo
          };
        }
      });
    }
    
    console.log('Route Line Map:', routeLineMap);

    // Get all stops with rate limiting
    const data = await makeApiCall(`${MBTA_BASE_URL}/stops?filter[route_type]=0,1`);
    
    if (!data.data) {
      throw new Error('No station data received');
    }

    console.log('Stops API Response:', data);

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
    const allStopIds = [];
    limitedStations.forEach(({ stationGroup }) => {
      stationGroup.stops.forEach(stop => {
        allStopIds.push(stop.id);
      });
    });
    
    console.log('Stop IDs to fetch routes for (limited):', allStopIds);
    
    // Use individual requests for accurate route mapping
    const stopRoutesMap = new Map();
    
    for (const stopId of allStopIds) {
      try {
        console.log(`Fetching routes for stop: ${stopId}`);
        
        // Add delay between requests to avoid rate limiting
        if (stopId !== allStopIds[0]) {
          await delay(500); // Reduced delay for faster performance
        }
        
        const stopRoutesData = await makeApiCall(`${MBTA_BASE_URL}/routes?filter[stop]=${stopId}&filter[type]=0,1`);
        
        console.log(`Routes for stop ${stopId}:`, stopRoutesData);
        
        if (stopRoutesData.data) {
          const routes = [];
          stopRoutesData.data.forEach(route => {
            const lineInfo = getLineInfo(route);
            if (lineInfo) {
              const routeInfo = {
                id: route.id,
                name: route.attributes.long_name || route.attributes.short_name,
                ...lineInfo
              };
              routes.push(routeInfo);
            }
          });
          stopRoutesMap.set(stopId, routes);
        } else {
          stopRoutesMap.set(stopId, []);
        }
        
      } catch (error) {
        console.error(`Error fetching routes for stop ${stopId}:`, error);
        stopRoutesMap.set(stopId, []);
      }
    }
    
    console.log('Stop routes map:', stopRoutesMap);

    // Process stations with their routes
    const stationsWithRoutes = stationsWithDistance.map((stationData) => {
      const { stationGroup, distance } = stationData;
      
      // Collect all routes from all stops in this station group
      const allRoutes = new Map(); // Use Map to avoid duplicates by route ID
      
      console.log(`Processing station group: ${stationGroup.name} with ${stationGroup.stops.length} stops`);
      
      // Check if this station is in our limited set (has route data)
      const hasRouteData = stationGroup.stops.some(stop => stopRoutesMap.has(stop.id));
      
      if (hasRouteData) {
        // Get routes for each stop in the station group
        stationGroup.stops.forEach(stop => {
          const stopRoutes = stopRoutesMap.get(stop.id) || [];
          console.log(`Routes for stop ${stop.id}:`, stopRoutes);
          
          stopRoutes.forEach(route => {
            allRoutes.set(route.id, route);
          });
        });
      } else {
        // For stations beyond our limit, show a placeholder message
        console.log(`Station ${stationGroup.name} is beyond the ${maxStationsToFetch} closest stations - no route data fetched`);
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
