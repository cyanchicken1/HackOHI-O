import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Polyline, Marker } from 'react-native-maps';
import polyline from 'polyline';
import { Colors } from '../style/theme';

/**
 * Component that renders bus routes, stops, and vehicles on the map
 */
export default function BusRouteMapLayer({ routes, loadingRoutes }) {
  if (loadingRoutes || !routes) {
    return null;
  }

  return (
    <>
      {Object.values(routes).map((route) => {
        if (!route) return null;

        // Use API color if provided; otherwise fallback to busRouteDefault
        const baseColor =
          Colors.busRouteColors[route.id] || // Use route ID to get color
          Colors.busRouteDefault; // Fallback to default

        const z = 10;

        return (
          <React.Fragment key={String(route.id)}>
            {/* 🛣️ Route Lines */}
            {Array.isArray(route.patterns) &&
              route.patterns.map((pattern) => {
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

                coords = coords.filter((c) => isFinite(c.latitude) && isFinite(c.longitude));
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
            {Array.isArray(route.stops) &&
              route.stops.map((stop) => {
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
            {Array.isArray(route.vehicles) &&
              route.vehicles.map((vehicle) => {
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
                    <View
                      style={{
                        backgroundColor: baseColor,
                        padding: 6,
                        borderRadius: 4,
                        borderWidth: 2,
                        borderColor: 'white',
                      }}
                    >
                      <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 12 }}>🚌</Text>
                    </View>
                  </Marker>
                );
              })}
          </React.Fragment>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
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
});

