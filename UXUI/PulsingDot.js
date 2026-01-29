import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Colors } from '../style/theme';

/**
 * PulsingDot - Animated marker for waypoints on the map
 * Used to highlight the next destination during navigation
 *
 * @param {string} color - The color of the dot (defaults to primary)
 * @param {number} size - The size of the dot in pixels (defaults to 20)
 * @param {boolean} active - Whether the pulsing animation is active
 */
export default function PulsingDot({
  color = Colors.primary,
  size = 20,
  active = true,
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    if (active) {
      const pulse = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(scaleAnim, {
              toValue: 2,
              duration: 1200,
              useNativeDriver: true,
            }),
            Animated.timing(scaleAnim, {
              toValue: 1,
              duration: 0,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(opacityAnim, {
              toValue: 0,
              duration: 1200,
              useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
              toValue: 0.6,
              duration: 0,
              useNativeDriver: true,
            }),
          ]),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [active]);

  const pulseSize = size * 2;

  return (
    <View style={[styles.container, { width: pulseSize, height: pulseSize }]}>
      {/* Pulsing ring */}
      {active && (
        <Animated.View
          style={[
            styles.pulseRing,
            {
              width: pulseSize,
              height: pulseSize,
              borderRadius: pulseSize / 2,
              borderColor: color,
              transform: [{ scale: scaleAnim }],
              opacity: opacityAnim,
            },
          ]}
        />
      )}

      {/* Center dot */}
      <View
        style={[
          styles.centerDot,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
          },
        ]}
      />

      {/* Inner white dot */}
      <View
        style={[
          styles.innerDot,
          {
            width: size * 0.4,
            height: size * 0.4,
            borderRadius: (size * 0.4) / 2,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    borderWidth: 2,
  },
  centerDot: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  innerDot: {
    position: 'absolute',
    backgroundColor: 'white',
  },
});
