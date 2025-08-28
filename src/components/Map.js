import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { fetchNearbyStations } from '../services/mbtaApi';

// Fix for default markers in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

// Custom icon for MBTA stations
const createStationIcon = (color = '#ff6b35') => {
  return L.divIcon({
    className: 'custom-station-icon',
    html: `<div style="
      background-color: ${color};
      width: 20px;
      height: 20px;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      font-size: 12px;
    ">🚇</div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });
};

// Component to handle map center updates and click events
function MapUpdater({ center, onMapClick }) {
  const map = useMap();
  
  useEffect(() => {
    if (center) {
      map.setView(center, 13);
    }
  }, [center, map]);

  useEffect(() => {
    const handleMapClick = (e) => {
      onMapClick([e.latlng.lat, e.latlng.lng]);
    };

    map.on('click', handleMapClick);

    return () => {
      map.off('click', handleMapClick);
    };
  }, [map, onMapClick]);
  
  return null;
}

// Component to render line emojis
const LineEmojis = ({ routes, hasRouteData, distance }) => {
  if (!hasRouteData) {
    return (
      <div style={{ color: '#999', fontSize: '11px', marginTop: '4px' }}>
        Route info not available (beyond closest 3 stations)
      </div>
    );
  }
  
  if (!routes || routes.length === 0) {
    return (
      <div style={{ color: '#999', fontSize: '11px', marginTop: '4px' }}>
        No line info available
      </div>
    );
  }
  
  return (
    <div style={{ display: 'flex', gap: '3px', marginTop: '4px', alignItems: 'center' }}>
      {routes.map((route, index) => (
        <span 
          key={route.id || index} 
          title={`${route.name} (${route.emoji})`} 
          style={{ 
            fontSize: '16px',
            filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))'
          }}
        >
          {route.emoji}
        </span>
      ))}
    </div>
  );
};

const Map = () => {
  const [position, setPosition] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isUserLocation, setIsUserLocation] = useState(true);
  const [stations, setStations] = useState([]);
  const [loadingStations, setLoadingStations] = useState(false);
  const [showStations, setShowStations] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);

  useEffect(() => {
    // Get user's current location
    if (navigator.geolocation) {
      console.log('Geolocation is supported, attempting to get location...');
      
      let geolocationTimeout;
      let isLocationSet = false;
      
      const successCallback = (pos) => {
        if (isLocationSet) return; // Prevent multiple calls
        isLocationSet = true;
        
        console.log('Geolocation successful:', pos);
        const { latitude, longitude } = pos.coords;
        const userPos = [latitude, longitude];
        setUserLocation(userPos);
        setPosition(userPos);
        setLoading(false);
        
        // Clear the timeout since we got location successfully
        if (geolocationTimeout) {
          clearTimeout(geolocationTimeout);
        }
      };
      
      const errorCallback = (err) => {
        if (isLocationSet) return; // Prevent multiple calls
        isLocationSet = true;
        
        console.error('Geolocation error details:', {
          code: err.code,
          message: err.message,
          PERMISSION_DENIED: err.code === 1,
          POSITION_UNAVAILABLE: err.code === 2,
          TIMEOUT: err.code === 3
        });
        
        let errorMessage = 'Unable to get your location. ';
        
        switch (err.code) {
          case 1:
            errorMessage += 'Location access was denied. Please allow location access in your browser settings.';
            break;
          case 2:
            errorMessage += 'Location information is unavailable. This might be due to poor GPS signal or network issues.';
            break;
          case 3:
            errorMessage += 'Location request timed out. Please try again.';
            break;
          default:
            errorMessage += 'Please enable location services and try again.';
        }
        
        setError(errorMessage);
        setLoading(false);
        
        // Default to a fallback location (Boston)
        const fallbackPos = [42.3601, -71.0589];
        setUserLocation(fallbackPos);
        setPosition(fallbackPos);
        
        // Clear the timeout since we handled the error
        if (geolocationTimeout) {
          clearTimeout(geolocationTimeout);
        }
      };
      
      navigator.geolocation.getCurrentPosition(
        successCallback,
        errorCallback,
        {
          enableHighAccuracy: false, // Changed to false for better compatibility
          timeout: 15000, // Increased timeout to 15 seconds
          maximumAge: 300000 // 5 minutes
        }
      );
      
      // Add a fallback timeout in case geolocation hangs
      geolocationTimeout = setTimeout(() => {
        if (!isLocationSet && loading) {
          console.log('Geolocation timeout, using fallback location');
          isLocationSet = true;
          setError('Location request timed out. Using default location (Boston).');
          setLoading(false);
          const fallbackPos = [42.3601, -71.0589];
          setUserLocation(fallbackPos);
          setPosition(fallbackPos);
        }
      }, 20000); // 20 second timeout
      
      // Cleanup timeout
      return () => {
        if (geolocationTimeout) {
          clearTimeout(geolocationTimeout);
        }
      };
      
    } else {
      console.log('Geolocation is not supported by this browser');
      setError('Geolocation is not supported by this browser. Using default location (Boston).');
      setLoading(false);
      // Default to a fallback location (Boston)
      const fallbackPos = [42.3601, -71.0589];
      setUserLocation(fallbackPos);
      setPosition(fallbackPos);
    }
  }, []); // Empty dependency array - only run once on mount

  const fetchStations = useCallback(async () => {
    if (!position) return;
    
    setLoadingStations(true);
    try {
      console.log('Fetching stations for position:', position);
      const nearbyStations = await fetchNearbyStations(position[0], position[1], 1.25);
      setStations(nearbyStations);
      // Clear any previous errors when stations are fetched successfully
      setError(null);
    } catch (error) {
      console.error('Error fetching stations:', error);
      setError('Unable to fetch nearby stations. Showing default location (Boston).');
      // Set position to Boston when there's an error
      const bostonPosition = [42.3601, -71.0589];
      setPosition(bostonPosition);
      setUserLocation(bostonPosition);
      setStations([]);
      
      // Auto-clear the error after 3 seconds to show the map
      setTimeout(() => {
        setError(null);
      }, 3000);
    } finally {
      setLoadingStations(false);
    }
  }, [position]);

  // Fetch nearby stations when position changes
  useEffect(() => {
    if (position && showStations) {
      // Clear old data first
      setStations([]);
      setLoadingStations(true);
      // Small delay to ensure state updates are processed
      setTimeout(() => {
        fetchStations();
      }, 10);
    }
  }, [position, showStations, fetchStations]);

  const handleMapClick = (newPosition) => {
    setPosition(newPosition);
    setIsUserLocation(false);
    // Clear any error messages when user manually changes location
    setError(null);
    // Don't clear stations here - let the useEffect handle it
  };

  const goToMyLocation = () => {
    if (!userLocation) return;
    
    setGettingLocation(true);
    
    // Get fresh location if available
    if (navigator.geolocation) {
      console.log('Attempting to get fresh location...');
      
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          console.log('Fresh geolocation successful:', pos);
          const { latitude, longitude } = pos.coords;
          const newUserPos = [latitude, longitude];
          setUserLocation(newUserPos);
          setPosition(newUserPos);
          setIsUserLocation(true);
          setGettingLocation(false);
          // Clear old station data immediately
          setStations([]);
          setLoadingStations(true);
          if (showStations) {
            fetchStations();
          }
        },
        (err) => {
          console.error('Fresh geolocation error:', {
            code: err.code,
            message: err.message
          });
          
          // Use stored user location as fallback
          console.log('Using stored user location as fallback');
          setPosition(userLocation);
          setIsUserLocation(true);
          setGettingLocation(false);
          // Clear old station data immediately
          setStations([]);
          setLoadingStations(true);
          if (showStations) {
            fetchStations();
          }
        },
        {
          enableHighAccuracy: false, // Use lower accuracy for better compatibility
          timeout: 10000, // 10 second timeout
          maximumAge: 60000 // 1 minute
        }
      );
    } else {
      // Use stored user location
      console.log('Geolocation not supported, using stored location');
      setPosition(userLocation);
      setIsUserLocation(true);
      setGettingLocation(false);
      // Clear old station data immediately
      setStations([]);
      setLoadingStations(true);
      if (showStations) {
        fetchStations();
      }
    }
  };

  const toggleStations = () => {
    setShowStations(!showStations);
    if (!showStations && position) {
      // Clear old data and show loading when enabling stations
      setStations([]);
      setLoadingStations(true);
      // Clear any previous errors when toggling stations
      setError(null);
      fetchStations();
    }
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '18px'
      }}>
        Getting your location...
      </div>
    );
  }

  if (error && !position) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column',
        gap: '15px',
        textAlign: 'center',
        padding: '20px'
      }}>
        <div style={{ 
          fontSize: '24px', 
          color: '#ff6b35',
          marginBottom: '10px'
        }}>
          🚇
        </div>
        <div style={{ 
          color: '#d32f2f', 
          fontSize: '18px',
          fontWeight: 'bold'
        }}>
          {error}
        </div>
        <div style={{ 
          color: '#666', 
          fontSize: '16px',
          maxWidth: '400px',
          lineHeight: '1.5'
        }}>
          Loading default location (Boston) and placing pin in the center of the city...
        </div>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid #f3f3f3',
          borderTop: '4px solid #ff6b35',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          marginTop: '20px'
        }}></div>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', width: '100%', position: 'relative' }}>
      {/* Info Panel */}
      <div style={{
        position: 'absolute',
        top: '10px',
        left: '10px',
        zIndex: 1000,
        background: 'white',
        padding: '10px',
        borderRadius: '5px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        fontSize: '14px'
      }}>
        <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
          {isUserLocation ? '📍 Your Current Location' : '📍 Selected Location'}
          {error && position && position[0] === 42.3601 && position[1] === -71.0589 && (
            <span style={{ color: '#ff6b35', fontSize: '12px', marginLeft: '8px' }}>
              (Default: Boston)
            </span>
          )}
        </div>
        <div>Click anywhere on the map to move the pin</div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          <button 
            onClick={toggleStations}
            style={{
              padding: '5px 10px',
              backgroundColor: showStations ? '#ff6b35' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            {showStations ? 'Hide' : 'Show'} Nearby Stations
          </button>
          <button 
            onClick={goToMyLocation}
            disabled={gettingLocation}
            style={{
              padding: '5px 10px',
              backgroundColor: gettingLocation ? '#ccc' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '3px',
              cursor: gettingLocation ? 'not-allowed' : 'pointer',
              fontSize: '12px'
            }}
          >
            {gettingLocation ? 'Getting...' : '📍 My Location'}
          </button>
        </div>
      </div>

      {/* Stations Sidebar */}
      {showStations && (
        <div 
          key={`stations-${position?.[0]}-${position?.[1]}`} // Force re-render when position changes
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            zIndex: 1000,
            background: 'white',
            padding: '15px',
            borderRadius: '5px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            maxWidth: '300px',
            maxHeight: '80vh',
            overflowY: 'auto'
          }}
        >
          <h3 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>🚇 Nearby MBTA Stations</h3>
          {loadingStations ? (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              color: '#666',
              fontSize: '14px'
            }}>
              <div style={{
                width: '16px',
                height: '16px',
                border: '2px solid #f3f3f3',
                borderTop: '2px solid #007bff',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}></div>
              Loading nearby stations...
            </div>
          ) : stations.length > 0 ? (
            <div>
              {stations.map((station, index) => (
                <div key={station.id} style={{
                  padding: '8px',
                  borderBottom: '1px solid #eee',
                  fontSize: '13px'
                }}>
                  <div style={{ fontWeight: 'bold', color: '#333' }}>
                    {station.name}
                  </div>
                  <div style={{ color: '#666', fontSize: '12px' }}>
                    {station.distance.toFixed(2)} miles away
                  </div>
                  <LineEmojis routes={station.routes} hasRouteData={station.hasRouteData} distance={station.distance} />
                  {station.wheelchair_accessible && (
                    <div style={{ color: '#28a745', fontSize: '11px', marginTop: '4px' }}>
                      ♿ Wheelchair accessible
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#666', fontSize: '13px' }}>
              No stations found within 1.25 miles radius
            </div>
          )}
        </div>
      )}
      
      <MapContainer
        center={position}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapUpdater center={position} onMapClick={handleMapClick} />
        
        {/* User/Selected Location Marker */}
        {position && (
          <Marker position={position}>
            <Popup>
              <div>
                <h3>{isUserLocation ? 'Your Current Location' : 'Selected Location'}</h3>
                <p>Latitude: {position[0].toFixed(6)}</p>
                <p>Longitude: {position[1].toFixed(6)}</p>
                <p style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                  Click anywhere on the map to move this pin
                </p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Station Markers */}
        {showStations && stations.map((station) => (
          <Marker 
            key={station.id}
            position={[station.latitude, station.longitude]}
            icon={createStationIcon()}
          >
            <Popup>
              <div>
                <h3>🚇 {station.name}</h3>
                <p>Distance: {station.distance.toFixed(2)} miles</p>
                <LineEmojis routes={station.routes} hasRouteData={station.hasRouteData} distance={station.distance} />
                {station.wheelchair_accessible && (
                  <p style={{ color: '#28a745', marginTop: '4px' }}>♿ Wheelchair accessible</p>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default Map;
