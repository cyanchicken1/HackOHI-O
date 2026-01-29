import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Polyline, Marker } from 'react-native-maps';
import polyline from 'polyline';
import { Colors, Spacing } from '../style/theme';
import Icon, { IconSizes } from './Icons';
import PulsingDot from './PulsingDot';

/**
 * Component that renders bus routes, stops, vehicles, and active trip visualization on the map
 */
export default function BusRouteMapLayer({
  routes,
  loadingRoutes,
  activeTrip,
  routeResult,
}) {
  // Render active trip polylines and waypoint
  const renderActiveTrip = () => {
    if (!activeTrip || !routeResult || !routeResult.segments) return null;

    const currentIndex = activeTrip.currentSegmentIndex;
    const routeColor = routeResult.route?.color || Colors.primary;
    const elements = [];

    // Render polylines for each segment
    routeResult.segments.forEach((segment, index) => {
      if (!segment.polyline || segment.polyline.length < 2) return;

      const isCompleted = index < currentIndex;
      const isCurrent = index === currentIndex;
      const isPending = index > currentIndex;

      // Skip completed segments (don't show them anymore)
      if (isCompleted) return;

      // Determine color and style based on segment state
      let strokeColor;
      let strokeWidth = 3;
      let lineDashPattern = null;

      if (segment.type === 'walk') {
        // Walking segments - dashed gray line
        strokeColor = isCurrent ? Colors.secondary : Colors.textSecondary;
        lineDashPattern = Platform.OS === 'ios' ? [2, 4] : [3, 4];
        strokeWidth = isCurrent ? 3 : 2;
      } else if (segment.type === 'ride') {
        // Bus ride segment - solid colored line
        strokeColor = isCurrent ? routeColor : Colors.border;
        strokeWidth = isCurrent ? 4 : 3;
      }

      if (strokeColor) {
        elements.push(
          <Polyline
            key={`trip-segment-${index}`}
            coordinates={segment.polyline}
            strokeColor={strokeColor}
            strokeWidth={strokeWidth}
            lineDashPattern={lineDashPattern}
            zIndex={isCurrent ? 100 : 50}
            lineCap="round"
            lineJoin="round"
          />
        );
      }
    });

    // Add pulsing marker at next waypoint
    const currentSegment = routeResult.segments[currentIndex];
    if (currentSegment) {
      let waypointCoord = null;

      if (currentSegment.type === 'walk' && currentSegment.to) {
        waypointCoord = {
          latitude: currentSegment.to.latitude,
          longitude: currentSegment.to.longitude,
        };
      } else if (currentSegment.type === 'wait' && currentSegment.stop) {
        waypointCoord = {
          latitude: currentSegment.stop.latitude,
          longitude: currentSegment.stop.longitude,
        };
      } else if (currentSegment.type === 'ride' && currentSegment.toStop) {
        waypointCoord = {
          latitude: currentSegment.toStop.latitude,
          longitude: currentSegment.toStop.longitude,
        };
      }

      if (waypointCoord) {
        const waypointColor = currentSegment.type === 'walk'
          ? Colors.secondary
          : routeColor;

        elements.push(
          <Marker
            key="trip-waypoint"
            coordinate={waypointCoord}
            anchor={{ x: 0.5, y: 0.5 }}
            zIndex={150}
          >
            <PulsingDot color={waypointColor} size={24} active={true} />
          </Marker>
        );
      }
    }

    return elements;
  };

  // Render standard bus routes (when not in active trip)
  const renderBusRoutes = () => {
    if (loadingRoutes || !routes) return null;

    return Object.values(routes).map((route) => {
      if (!route) return null;

      const baseColor =
        route.color ||
        Colors.busRouteColors[route.id];

      const z = 10;

      return (
        <React.Fragment key={String(route.id)}>
          {/* Route Lines */}
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
                  strokeWidth={3}
                  zIndex={z}
                  lineCap="round"
                  lineJoin="round"
                  geodesic
                />
              );
            })}

          {/* Stop Markers */}
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

          {/* Bus Vehicles */}
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
                  flat={true}
                >
                  <View
                    style={[
                      styles.busMarker,
                      {
                        backgroundColor: baseColor,
                        transform: [{ rotate: `${(vehicle?.heading ?? 0) + 90}deg` }]
                      }
                    ]}
                  >
                    <Icon name="bus" size={IconSizes.sm} color="white" />
                  </View>
                </Marker>
              );
            })}
        </React.Fragment>
      );
    });
  };

  return (
    <>
      {renderBusRoutes()}
      {renderActiveTrip()}
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
  busMarker: {
    padding: 6,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
