import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Spacing, Typography } from '../style/theme';

export default function BusRouteLegend({ routes }) {
  if (!routes || Object.keys(routes).length === 0) {
    return null; // Don't show legend if no routes loaded
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Bus Routes</Text>
      {Object.values(routes).map((route) => {
        if (!route) return null;
        const baseColor = Colors.busRouteColors?.[route.id] || Colors.busRouteDefault;
        
        return (
          <View key={String(route.id)} style={styles.row}>
            <View style={[styles.swatch, { backgroundColor: baseColor }]} />
            <Text style={styles.label}>{route.id}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: 20,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.md,
    ...Colors.shadow,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 100,
  },
  title: {
    fontFamily: Typography.fontFamily,
    ...Typography.caption,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: Spacing.sm,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  swatch: {
    width: 16,
    height: 16,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: Spacing.sm,
  },
  label: {
    fontFamily: Typography.fontFamily,
    ...Typography.body,
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '500',
  },
});