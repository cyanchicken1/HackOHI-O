import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Platform,
  Linking,
  TouchableWithoutFeedback,
  Keyboard,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import MapView, { Marker } from 'react-native-maps';
import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';

import SearchDrawer from '../UXUI/SearchDrawer';
import TripProgressView from '../UXUI/TripProgressView';
import poiData from '../Data/osu_all_pois.json';
import BusRouteLegend from '../UXUI/BusRouteLegend';
import BusRouteMapLayer from '../UXUI/BusRouteMapLayer';
import ErrorBoundary from '../UXUI/ErrorBoundary';
import Icon, { IconSizes } from '../UXUI/Icons';
import { Colors, Spacing } from '../style/theme';

import { fetchAllRoutes } from '../BackEnd/osuBusAPI';
import aggregateRouteInfo from '../BackEnd/aggregateRouteInfo';

// Haversine distance calculation for trip tracking
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// Safely parse POI data with error handling
let ALL_POIS = [];
try {
  ALL_POIS = (poiData?.pois || []).map((p, index) => ({
    id: p.number || `poi-${index}`,
    name: p.name,
    latitude: p.latitude,
    longitude: p.longitude,
    type: p.type,
    category: p.category,
  }));
} catch (error) {
  console.error('Error parsing POI data:', error);
  ALL_POIS = [];
}

// Hard-set OSU camera start
const OSU_REGION = {
  latitude: 40.0000,
  longitude: -83.0145,
  latitudeDelta: 0.04,
  longitudeDelta: 0.04,
};

// Arrival threshold in meters
const ARRIVAL_THRESHOLD = 30;

function App() {
  const mapRef = useRef(null);

  // Location state
  const [userRegion, setUserRegion] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // Bus routes state
  const [routes, setRoutes] = useState(null);
  const [loadingRoutes, setLoadingRoutes] = useState(true);

  // App state
  const [destination, setDestination] = useState(null);
  const [startLocation, setStartLocation] = useState(null);
  const [routeResult, setRouteResult] = useState(null);
  const [calculatingRoute, setCalculatingRoute] = useState(false);
  const [resetOriginTrigger, setResetOriginTrigger] = useState(false);

  // Trip navigation state
  const [tripPhase, setTripPhase] = useState('planning'); // 'planning' | 'navigating'
  const [activeTrip, setActiveTrip] = useState(null);
  const locationSubscription = useRef(null);

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

    fetchRoutes();
    const interval = setInterval(fetchRoutes, 15000);
    return () => clearInterval(interval);
  }, []);

  // Location tracking for active trip
  useEffect(() => {
    if (tripPhase !== 'navigating' || !activeTrip || !routeResult) {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
        locationSubscription.current = null;
      }
      return;
    }

    const startTracking = async () => {
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 10,
        },
        (location) => handleLocationUpdate(location)
      );
    };

    startTracking();

    return () => {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
        locationSubscription.current = null;
      }
    };
  }, [tripPhase, activeTrip?.currentSegmentIndex]);

  // Handle location updates during trip
  const handleLocationUpdate = useCallback((location) => {
    if (!activeTrip || !routeResult) return;

    const currentSegment = routeResult.segments[activeTrip.currentSegmentIndex];
    if (!currentSegment) return;

    const { latitude, longitude } = location.coords;

    // Get target coordinates based on segment type
    let targetCoords = null;
    if (currentSegment.type === 'walk' && currentSegment.to) {
      targetCoords = currentSegment.to;
    } else if (currentSegment.type === 'wait' && currentSegment.stop) {
      targetCoords = currentSegment.stop;
    } else if (currentSegment.type === 'ride' && currentSegment.toStop) {
      targetCoords = currentSegment.toStop;
    }

    if (!targetCoords) return;

    const distance = haversineDistance(
      latitude,
      longitude,
      targetCoords.latitude,
      targetCoords.longitude
    );

    // Check if user has arrived at waypoint
    if (distance < ARRIVAL_THRESHOLD) {
      advanceSegment();
    }
  }, [activeTrip, routeResult]);

  // Advance to next segment
  const advanceSegment = useCallback(() => {
    if (!activeTrip || !routeResult) return;

    const nextIndex = activeTrip.currentSegmentIndex + 1;

    if (nextIndex >= routeResult.segments.length) {
      // Trip completed
      handleEndTrip();
    } else {
      setActiveTrip(prev => ({
        ...prev,
        currentSegmentIndex: nextIndex,
      }));
    }
  }, [activeTrip, routeResult]);

  const handleSelectBuilding = (b) => {
    setDestination(b);
    setRouteResult(null);
  };

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

  const handleGetDirections = async () => {
    const fromLocation = startLocation || userRegion;

    if (!fromLocation) {
      alert('Starting location not available. Please enable location services or select a starting building.');
      return;
    }

    if (!destination) {
      alert('Please select a destination first by searching for a building.');
      return;
    }

    setCalculatingRoute(true);

    try {
      const result = await aggregateRouteInfo(fromLocation, destination);
      setRouteResult(result);
      console.log('Route calculated successfully:', result);
    } catch (error) {
      console.error('Error calculating route:', error);
      setRouteResult({
        recommendation: 'error',
        error: 'Error calculating route. Please try again.',
        errorDetails: error.message
      });
    } finally {
      setCalculatingRoute(false);
    }
  };

  // Start trip handler
  const handleStartTrip = useCallback(() => {
    if (!routeResult || routeResult.recommendation === 'error') return;

    setActiveTrip({
      currentSegmentIndex: 0,
      startTime: new Date(),
    });
    setTripPhase('navigating');

    // Zoom to show the first segment
    const firstSegment = routeResult.segments[0];
    if (firstSegment?.to) {
      handleFlyTo(firstSegment.to, 0.005);
    }
  }, [routeResult]);

  // End trip handler
  const handleEndTrip = useCallback(() => {
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }
    setActiveTrip(null);
    setTripPhase('planning');
  }, []);

  // Clear route result when start location changes
  useEffect(() => {
    if (routeResult && !routeResult.error) {
      setRouteResult(null);
    }
  }, [startLocation]);

  if (errorMsg && !userRegion) {
    return (
      <View style={styles.center}>
        <Text style={{ textAlign: 'center' }}>{errorMsg}</Text>
        <Text style={{ marginTop: 8, color: Colors.primary }} onPress={() => Linking.openSettings && Linking.openSettings()}>
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
          initialRegion={OSU_REGION}
          onMapReady={() => {
            if (userRegion) {
              mapRef.current?.animateToRegion(userRegion, 0);
            } else {
              mapRef.current?.animateToRegion(OSU_REGION, 0);
            }
          }}
          showsUserLocation={true}
          showsMyLocationButton={true}
          mapType={Platform.OS === 'ios' ? 'standard' : 'standard'}
        >
          {/* Start Location Marker */}
          {startLocation && tripPhase === 'planning' && (
            <Marker
              coordinate={{
                latitude: startLocation.latitude,
                longitude: startLocation.longitude,
              }}
              title={`Start: ${startLocation.name}`}
              pinColor="#4CAF50"
            />
          )}

          {/* Destination Marker */}
          {destination && (
            <Marker
              key={String(destination.id)}
              coordinate={{
                latitude: destination.latitude,
                longitude: destination.longitude,
              }}
              title={`End: ${destination.name}`}
              pinColor={Colors.primary}
            />
          )}

          {/* Bus Route Layer (Routes, Stops, Vehicles, Active Trip) */}
          <BusRouteMapLayer
            routes={routes}
            loadingRoutes={loadingRoutes}
            activeTrip={activeTrip}
            routeResult={tripPhase === 'navigating' ? routeResult : null}
          />
        </MapView>

        {/* Bus Route Legend - Top Left (hide during navigation) */}
        {tripPhase === 'planning' && <BusRouteLegend routes={routes} />}

        {/* Directions Button (only in planning mode) */}
        {destination && tripPhase === 'planning' && (
          <View style={styles.directionsContainer}>
            {startLocation && (
              <TouchableOpacity
                style={[styles.directionsButton, styles.clearStartButton]}
                onPress={() => {
                  setStartLocation(null);
                  setResetOriginTrigger((prev) => !prev);
                }}
              >
                <Icon name="close" size={IconSizes.sm} color="white" />
                <Text style={styles.directionsButtonText}>Use Current Location</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.directionsButton}
              onPress={handleGetDirections}
              disabled={calculatingRoute}
            >
              {calculatingRoute ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Icon name="bus" size={IconSizes.md} color="white" />
                  <Text style={styles.directionsButtonText}>Directions</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Bottom UI: SearchDrawer or TripProgressView */}
        {tripPhase === 'planning' ? (
          <SearchDrawer
            userLocation={
              userRegion ? { latitude: userRegion.latitude, longitude: userRegion.longitude } : null
            }
            buildings={ALL_POIS}
            onSelect={handleSelectBuilding}
            onFlyTo={handleFlyTo}
            onSetStart={(building) => {
              setStartLocation(building);
              if (building) {
                setRouteResult(null);
              }
            }}
            routes={routes}
            resetOrigin={resetOriginTrigger}
            routeResult={routeResult}
            startLocation={startLocation}
            destination={destination}
            calculatingRoute={calculatingRoute}
            onStartTrip={handleStartTrip}
          />
        ) : (
          <TripProgressView
            activeTrip={activeTrip}
            routeResult={routeResult}
            destination={destination}
            onEndTrip={handleEndTrip}
            onNextStep={advanceSegment}
          />
        )}

        <StatusBar style="auto" />
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  directionsContainer: {
    position: 'absolute',
    top: 60,
    right: 20,
    flexDirection: 'column',
    gap: 10,
  },
  directionsButton: {
    backgroundColor: Colors.primary,
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
    gap: Spacing.sm,
    minWidth: 140,
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

// Export with Error Boundary, SafeAreaProvider, and GestureHandler
export default function AppWithErrorBoundary() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
