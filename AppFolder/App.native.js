// import React, { useEffect, useRef, useState } from 'react';
// import { StyleSheet, View, Text, ActivityIndicator, Platform, Linking, TouchableOpacity, TouchableWithoutFeedback, Keyboard } from 'react-native';
// import MapView, { Polyline, Marker } from 'react-native-maps';
// import polyline from 'polyline';
// import * as Location from 'expo-location';
// import { StatusBar } from 'expo-status-bar';

// import { fetchAllRoutes } from './osuBusAPI';

// import SearchDrawer from './SearchDrawer';
// import buildingData from './osu_building_points.json';
// import { Colors } from './style/theme';

// import BusRouteLegend from './BusRouteLegend';

// import { findBestRoute, describeRoute, formatTime } from './busRouting';
import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ActivityIndicator,
  Platform,
  Linking,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import MapView, { Polyline, Marker } from 'react-native-maps';
import polyline from 'polyline';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';

import { fetchAllRoutes } from '../BackEnd/osuBusAPI';

import SearchDrawer from '../UXUI/SearchDrawer';
import buildingData from '../Data/osu_building_points.json';
import { Colors } from '../style/theme';

import BusRouteLegend from '../UXUI/BusRouteLegend';

import { findBestRoute, describeRoute, formatTime } from '../BackEnd/busRouting';

const ALL_BUILDINGS = (buildingData?.buildings || []).map((b) => ({
  id: b.number,
  name: b.name,
  latitude: b.latitude,
  longitude: b.longitude,
}));

// Hard-set OSU camera start
const OSU_REGION = {
  latitude: 40.0000,
  longitude: -83.0145,
  latitudeDelta: 0.04,
  longitudeDelta: 0.04,
};

export default function App() {
  const mapRef = useRef(null);

  const [userRegion, setUserRegion] = useState(null);   // real GPS (for blue dot + distances)
  const [errorMsg, setErrorMsg] = useState(null);
  const [destination, setDestination] = useState(null);
  const [startLocation, setStartLocation] = useState(null); // Custom start location for routing

  const [routes, setRoutes] = useState(null);
  const [loadingRoutes, setLoadingRoutes] = useState(true);

  const [routeResult, setRouteResult] = useState(null);
  const [calculatingRoute, setCalculatingRoute] = useState(false);

  const [resetOriginTrigger, setResetOriginTrigger] = useState(false);

  // Get GPS and move camera to it once obtained
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setErrorMsg('Permission to access location was denied.');
          return;
        }
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        const { latitude, longitude } = loc.coords;
        const userLoc = { latitude, longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 };
        setUserRegion(userLoc);
        
        // Move camera to user location on startup
        setTimeout(() => {
          mapRef.current?.animateToRegion(userLoc, 1000);
        }, 500);
      } catch (e) {
        setErrorMsg(e.message || 'Failed to get location');
      }
    })();
  }, []);

  // Fetch OSU bus routes
  useEffect(() => {
    const fetchRoutes = async () => {
      try {
        const data = await fetchAllRoutes();
        setRoutes(data);
      } catch (err) {
        console.error('Error fetching routes:', err);
      } finally {
        setLoadingRoutes(false);
      }
    };

    // Initial fetch
    fetchRoutes();

    // Refresh every 15 seconds
    const interval = setInterval(fetchRoutes, 15000);

    // Cleanup on unmount
    return () => clearInterval(interval);
  }, []);

  const handleSelectBuilding = (b) => {
    setDestination(b);
    // Clear previous route result when destination changes
    setRouteResult(null);
    // Camera movement now handled by onFlyTo callback
  };

  // Implement the flyTo handler for camera movement
  const handleFlyTo = (coords, zoomDelta) => {
    if (!coords) return;
    mapRef.current?.animateToRegion(
      {
        latitude: coords.latitude,
        longitude: coords.longitude,
        latitudeDelta: zoomDelta || 0.004,
        longitudeDelta: zoomDelta || 0.004,
      },
      700
    );
  };

  // Directions calculation handler
  const handleGetDirections = async () => {
    // Use startLocation if set, otherwise use userRegion (current GPS)
    const fromLocation = startLocation || userRegion;
    
    if (!fromLocation) {
      alert('Starting location not available. Please enable location services or select a starting building.');
      return;
    }
    
    if (!destination) {
      alert('Please select a destination first by searching for a building.');
      return;
    }
    
    if (!routes || loadingRoutes) {
      alert('Bus routes are still loading. Please wait a moment.');
      return;
    }
    
    setCalculatingRoute(true);
    
    try {
      const result = await findBestRoute(fromLocation, destination, routes);
      setRouteResult(result);
      
      // No more alert - results will be displayed in the SearchDrawer
      console.log('Route calculated successfully:', result);
      
    } catch (error) {
      console.error('Error calculating route:', error);
      // Set error result to display in SearchDrawer
      setRouteResult({
        error: 'Error calculating route. Please try again.',
        errorDetails: error.message
      });
    } finally {
      setCalculatingRoute(false);
    }
  };

  // Clear route result when start location changes
  useEffect(() => {
    if (routeResult && !routeResult.error) {
      setRouteResult(null);
    }
  }, [startLocation]);

  if (errorMsg && !userRegion) {
    // Only block if we have an error *and* no map yet — otherwise we still show OSU.
    return (
      <View style={styles.center}>
        <Text style={{ textAlign: 'center' }}>{errorMsg}</Text>
        <Text style={{ marginTop: 8, color: '#BA0c2F' }} onPress={() => Linking.openSettings && Linking.openSettings()}>
          Open app settings
        </Text>
      </View>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={OSU_REGION}                 // 1) default to OSU
        onMapReady={() => {
          // 2) force snap to OSU right away (covers platforms where initialRegion isn't immediate)
          // If we already have user location, move there instead
          if (userRegion) {
            mapRef.current?.animateToRegion(userRegion, 0);
          } else {
            mapRef.current?.animateToRegion(OSU_REGION, 0);
          }
        }}
        showsUserLocation={true}                   // show blue dot when permission granted
        showsMyLocationButton={true}
        mapType={Platform.OS === 'ios' ? 'standard' : 'standard'}
      >

        {/* Start Location Marker (if custom start is set) */}
        {startLocation && (
          <Marker
            coordinate={{ latitude: startLocation.latitude, longitude: startLocation.longitude }}
            title={`Start: ${startLocation.name}`}
            pinColor="#4CAF50"
          />
        )}

        {/* Destination after selection */}
        {destination && (
          <Marker
            key={String(destination.id)}
            coordinate={{ latitude: destination.latitude, longitude: destination.longitude }}
            title={`End: ${destination.name}`}
            pinColor="#ba0c2f"
          />
        )}

        {/* === OSU Bus Routes === */}
        {!loadingRoutes && routes &&
          Object.values(routes).map((route, index) => {
            if (!route) return null;

            // Use API color if provided; otherwise rotate through theme's busRoute palette; final fallback to busRouteDefault
            const baseColor =
            Colors.busRouteColors[route.id] ||           // Use route ID to get color
            Colors.busRoute[index % Colors.busRoute.length] || // Fallback to index
            Colors.busRouteDefault;                      // Final fallback

            const z = 10;

            return (
              <React.Fragment key={String(route.id)}>
                {/* 🛣️ Route Lines */}
                {Array.isArray(route.patterns) && route.patterns.map((pattern) => {
                  if (!pattern?.encodedPolyline) return null;

                  let coords = [];
                  try {
                    coords = polyline.decode(pattern.encodedPolyline).map(([lat, lng]) => ({
                      latitude: Number(lat),
                      longitude: Number(lng),
                    }));
                  } catch (e) {
                    console.warn('Failed to decode polyline for pattern', pattern?.id, e);
                    return null;
                  }

                  coords = coords.filter(c => isFinite(c.latitude) && isFinite(c.longitude));
                  if (coords.length < 2) return null;

                  return (
                    <Polyline
                      key={String(pattern.id)}
                      coordinates={coords}
                      strokeColor={baseColor}
                      strokeWidth={4}
                      zIndex={z}
                      lineCap="round"
                      lineJoin="round"
                      geodesic
                    />
                  );
                })}

                {/* 🚏 Stop Markers */}
                {Array.isArray(route.stops) && route.stops.map((stop) => {
                  const lat = Number(stop?.latitude);
                  const lng = Number(stop?.longitude);
                  if (!isFinite(lat) || !isFinite(lng)) return null;

                  return (
                    <Marker
                      key={String(stop?.id ?? `${lat},${lng}`)}
                      coordinate={{ latitude: lat, longitude: lng }}
                      title={stop?.name ?? 'Stop'}
                      zIndex={z + 1}
                      anchor={{ x: 0.5, y: 0.5 }}
                    >
                      <View style={styles.stopMarker}>
                        <View style={[styles.stopMarkerInner, { backgroundColor: '#333' }]} />
                      </View>
                    </Marker>
                  );
                })}

                {/* 🚌 Bus Vehicles */}
                {Array.isArray(route.vehicles) && route.vehicles.map((vehicle) => {
                  const lat = Number(vehicle?.latitude);
                  const lng = Number(vehicle?.longitude);
                  if (!isFinite(lat) || !isFinite(lng)) return null;

                  return (
                    <Marker
                      key={`bus-${route.id}-${vehicle?.id ?? `${lat},${lng}`}`}
                      coordinate={{ latitude: lat, longitude: lng }}
                      title={`Bus ${vehicle?.id ?? 'Unknown'} (${vehicle?.routeCode ?? route.id})`}
                      description={`Next: ${vehicle?.nextStop}`}
                      pinColor={baseColor}
                      zIndex={z + 2}
                      // Optional: rotate the marker based on heading
                      rotation={vehicle?.heading ?? 0}
                      flat={true}
                    >
                      {/* Optional: Custom bus icon instead of pin */}
                      <View style={{
                        backgroundColor: baseColor,
                        padding: 6,
                        borderRadius: 4,
                        borderWidth: 2,
                        borderColor: 'white',
                      }}>
                        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 12 }}>🚌</Text>
                      </View>
                      
                    </Marker>
                  );
                })}
              </React.Fragment>
            );
          })
        }

      </MapView>
      

      {/* Bus Route Legend - Top Left */}
      <BusRouteLegend routes={routes} />

      {/* Get Directions Button */}
      {destination && (
        <View style={styles.directionsContainer}>
          {/* Clear Start Location Button - Only show if custom start is set */}
          {startLocation && (
            <TouchableOpacity
              style={[styles.directionsButton, styles.clearStartButton]}
              onPress={() => {
                setStartLocation(null);
                setResetOriginTrigger(prev => !prev);
              }}
            >
              <Text style={styles.directionsButtonText}>
                ✕ Use Current Location
              </Text>
            </TouchableOpacity>
          )}
          
          {/* Get Directions Button */}
          <TouchableOpacity
            style={styles.directionsButton}
            onPress={handleGetDirections}
            disabled={calculatingRoute}
          >
            {calculatingRoute ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.directionsButtonText}>
                🚌 Directions
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Bottom search drawer with route results */}
      <SearchDrawer
        userLocation={
          userRegion ? { latitude: userRegion.latitude, longitude: userRegion.longitude } : null
        }
        buildings={ALL_BUILDINGS}
        onSelect={handleSelectBuilding}
        onFlyTo={handleFlyTo}
        onSetStart={(building) => {
          setStartLocation(building);
          if (building) {
            // Clear previous route results when start location changes
            setRouteResult(null);
          }
        }}
        routes={routes}
        resetOrigin={resetOriginTrigger}
        routeResult={routeResult}
        startLocation={startLocation}
        destination={destination}
        calculatingRoute={calculatingRoute}
      />

      <StatusBar style="auto" />
    </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  stopMarker: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopMarkerInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  directionsContainer: {
    position: 'absolute',
    top: 60,
    right: 20,
    flexDirection: 'column',
    gap: 10,
  },
  directionsButton: {
    backgroundColor: '#BA0C2F',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 140,
  },
  setStartButton: {
    backgroundColor: '#4CAF50',
  },
  clearStartButton: {
    backgroundColor: '#FF9800',
  },
  directionsButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
