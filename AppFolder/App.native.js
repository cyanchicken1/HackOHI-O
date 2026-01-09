import React, { useEffect, useRef, useState } from 'react';
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
import MapView, { Marker } from 'react-native-maps';
import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';

import SearchDrawer from '../UXUI/SearchDrawer';
import poiData from '../Data/osu_all_pois.json';
import BusRouteLegend from '../UXUI/BusRouteLegend';
import BusRouteMapLayer from '../UXUI/BusRouteMapLayer';
import ErrorBoundary from '../UXUI/ErrorBoundary';

import { fetchAllRoutes } from '../BackEnd/osuBusAPI';
import aggregateRouteInfo from '../BackEnd/aggregateRouteInfo';

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

function App() {
  const mapRef = useRef(null);

  // Location state
  const [userRegion, setUserRegion] = useState(null); // real GPS (for blue dot + distances)
  const [errorMsg, setErrorMsg] = useState(null);

  // Bus routes state
  const [routes, setRoutes] = useState(null);
  const [loadingRoutes, setLoadingRoutes] = useState(true);

  // App state
  const [destination, setDestination] = useState(null);
  const [startLocation, setStartLocation] = useState(null); // Custom start location for routing
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
        initialRegion={OSU_REGION} // 1) default to OSU
        onMapReady={() => {
          // 2) force snap to OSU right away (covers platforms where initialRegion isn't immediate)
          // If we already have user location, move there instead
          if (userRegion) {
            mapRef.current?.animateToRegion(userRegion, 0);
          } else {
            mapRef.current?.animateToRegion(OSU_REGION, 0);
          }
        }}
        showsUserLocation={true} // show blue dot when permission granted
        showsMyLocationButton={true}
        mapType={Platform.OS === 'ios' ? 'standard' : 'standard'}
      >
        {/* Start Location Marker */}
        {startLocation && (
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
            pinColor="#ba0c2f"
          />
        )}

        {/* Bus Route Layer (Routes, Stops, Vehicles) */}
        <BusRouteMapLayer routes={routes} loadingRoutes={loadingRoutes} />
      </MapView>
      

      {/* Bus Route Legend - Top Left */}
      <BusRouteLegend routes={routes} />

      {/* Directions Button */}
      {destination && (
        <View style={styles.directionsContainer}>
          {startLocation && (
            <TouchableOpacity
              style={[styles.directionsButton, styles.clearStartButton]}
              onPress={() => {
                setStartLocation(null);
                setResetOriginTrigger((prev) => !prev);
              }}
            >
              <Text style={styles.directionsButtonText}>✕ Use Current Location</Text>
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
              <Text style={styles.directionsButtonText}>🚌 Directions</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Bottom search drawer with route results */}
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
  clearStartButton: {
    backgroundColor: '#FF9800',
  },
  directionsButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

// Export with Error Boundary
export default function AppWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
