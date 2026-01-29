import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Colors, Spacing, Typography, Layout } from '../style/theme';
import Icon, { IconSizes } from './Icons';
import { formatTime } from '../BackEnd/busRouting';

/**
 * TimeRow component for displaying time breakdown
 */
function TimeRow({ icon, iconColor, label, time, delayed }) {
  return (
    <View style={styles.timeRow}>
      <View style={styles.timeIconContainer}>
        <Icon name={icon} size={IconSizes.md} color={iconColor || Colors.textSecondary} />
      </View>
      <Text style={styles.timeLabel}>{label}</Text>
      <View style={styles.timeValueContainer}>
        <Text style={[styles.timeValue, delayed && styles.delayedText]}>
          {time}
        </Text>
        {delayed && (
          <Icon name="alert" size={IconSizes.sm} color={Colors.error} style={styles.delayedIcon} />
        )}
      </View>
    </View>
  );
}

/**
 * Format distance for display
 */
const formatDistance = (meters) => {
  if (!isFinite(meters)) return '';

  const METERS_IN_MILE = 1609.34;
  const METERS_IN_FOOT = 0.3048;
  const MILES_IN_METER = 0.000621371;
  const FEET_THRESHOLD_METERS = 0.25 * METERS_IN_MILE;

  if (meters < FEET_THRESHOLD_METERS) {
    const feet = meters / METERS_IN_FOOT;
    const roundedFeet = Math.round(feet / 10) * 10;
    return `${roundedFeet} ft`;
  } else {
    const miles = meters * MILES_IN_METER;
    const roundedMiles = Math.round(miles * 10) / 10;
    const formatted = roundedMiles.toFixed(1);
    return `${formatted.replace(/\.0$/, '')} mi`;
  }
};

/**
 * RouteResultsCard - displays route calculation results
 * Extracted from SearchDrawer for better separation of concerns
 */
export default function RouteResultsCard({
  routeResult,
  calculatingRoute,
  onStartTrip,
}) {
  if (calculatingRoute) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Calculating best route...</Text>
      </View>
    );
  }

  if (!routeResult) return null;

  // Bus route recommendation
  if (routeResult.recommendation === 'bus') {
    return (
      <View style={styles.routeContainer}>
        <View style={styles.routeTitleRow}>
          <Icon name="bus" size={IconSizes.lg} color={Colors.primary} />
          <Text style={styles.routeTitle}>Best Route</Text>
        </View>

        {routeResult.route && (
          <View style={styles.routeHeader}>
            <Text style={styles.busNumber}>
              Bus #{routeResult.segments[1]?.bus?.id || 'Unknown'}
            </Text>
            <View
              style={[
                styles.routeBadge,
                { backgroundColor: routeResult.route.color || Colors.primary }
              ]}
            >
              <Text style={styles.routeBadgeText}>
                Route {routeResult.route.id || 'Unknown'}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.routeStops}>
          <View style={styles.stopRow}>
            <Icon name="stop" size={IconSizes.md} color={Colors.success} />
            <Text style={styles.stopText}>
              Board at: {routeResult.segments[0]?.to?.name || 'Unknown stop'}
            </Text>
          </View>
          <View style={styles.arrowContainer}>
            <Icon name="arrow-down" size={IconSizes.md} color={Colors.textSecondary} />
          </View>
          <View style={styles.stopRow}>
            <Icon name="stop-circle" size={IconSizes.md} color={Colors.primary} />
            <Text style={styles.stopText}>
              Get off at: {routeResult.segments[2]?.toStop?.name || 'Unknown stop'}
            </Text>
          </View>
        </View>

        <View style={styles.timeBreakdown}>
          <TimeRow
            icon="walk"
            iconColor={Colors.secondary}
            label="Walk to bus stop"
            time={formatTime(routeResult.segments[0]?.duration || 0)}
          />
          <TimeRow
            icon="time"
            iconColor={Colors.secondary}
            label="Wait for bus"
            time={formatTime(routeResult.segments[1]?.duration || 0)}
            delayed={routeResult.segments[1]?.duration > 15}
          />
          <TimeRow
            icon="bus"
            iconColor={routeResult.route?.color || Colors.primary}
            label="Bus ride"
            time={formatTime(routeResult.segments[2]?.duration || 0)}
          />
          <TimeRow
            icon="walk"
            iconColor={Colors.secondary}
            label="Walk to destination"
            time={formatTime(routeResult.segments[3]?.duration || 0)}
          />
        </View>

        <View style={styles.totalTime}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Trip Time</Text>
            <Text style={styles.totalValue}>{formatTime(routeResult.totalTime)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>ETA</Text>
            <Text style={styles.totalValue}>{routeResult.eta}</Text>
          </View>
        </View>

        {routeResult.directWalkTime && (
          <View style={styles.comparisonRow}>
            <Icon name="bulb" size={IconSizes.sm} color={Colors.textSecondary} />
            <Text style={styles.walkComparison}>
              Walking directly: {formatTime(routeResult.directWalkTime)}
            </Text>
          </View>
        )}

        {onStartTrip && (
          <TouchableOpacity style={styles.startTripButton} onPress={onStartTrip}>
            <Icon name="navigate" size={IconSizes.md} color={Colors.surface} />
            <Text style={styles.startTripButtonText}>Start Trip</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // Walk recommendation
  if (routeResult.recommendation === 'walk') {
    return (
      <View style={styles.routeContainer}>
        <View style={styles.routeTitleRow}>
          <Icon name="walk" size={IconSizes.lg} color={Colors.secondary} />
          <Text style={styles.routeTitle}>Walking Recommended</Text>
        </View>

        {routeResult.error && (
          <Text style={styles.walkReasonText}>
            {routeResult.error}
          </Text>
        )}

        <View style={styles.timeBreakdown}>
          <TimeRow
            icon="walk"
            iconColor={Colors.secondary}
            label="Walk to destination"
            time={formatTime(routeResult.totalTime || routeResult.segments?.[0]?.duration || routeResult.directWalkTime)}
          />
          {routeResult.segments?.[0]?.distance && (
            <TimeRow
              icon="ruler"
              iconColor={Colors.secondary}
              label="Distance"
              time={formatDistance(routeResult.segments[0].distance)}
            />
          )}
        </View>

        <View style={styles.totalTime}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Trip Time</Text>
            <Text style={styles.totalValue}>{formatTime(routeResult.totalTime || routeResult.directWalkTime || 0)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>ETA</Text>
            <Text style={styles.totalValue}>{routeResult.eta || '--:--'}</Text>
          </View>
        </View>

        {routeResult.isEstimate && (
          <View style={styles.warningRow}>
            <Icon name="warning" size={IconSizes.sm} color="#B8860B" />
            <Text style={styles.estimateWarning}>
              Walking time is estimated (routing service unavailable)
            </Text>
          </View>
        )}

        {onStartTrip && (
          <TouchableOpacity style={[styles.startTripButton, styles.startTripButtonWalk]} onPress={onStartTrip}>
            <Icon name="navigate" size={IconSizes.md} color={Colors.surface} />
            <Text style={styles.startTripButtonText}>Start Trip</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // Error state
  if (routeResult.error) {
    return (
      <View style={styles.errorContainer}>
        <View style={styles.errorTitleRow}>
          <Icon name="alert" size={IconSizes.lg} color={Colors.error} />
          <Text style={styles.errorTitle}>Route Error</Text>
        </View>
        <Text style={styles.errorText}>{routeResult.error}</Text>
        {routeResult.errorDetails && (
          <Text style={styles.errorText}>Details: {routeResult.errorDetails}</Text>
        )}
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  loadingText: {
    marginTop: Spacing.md,
    fontFamily: Typography.fontFamily,
    ...Typography.body,
    color: Colors.textSecondary,
  },
  routeContainer: {
    backgroundColor: Colors.surface,
    borderRadius: Layout.borderRadius,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    ...Layout.shadow,
  },
  routeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  routeTitle: {
    fontFamily: Typography.fontFamily,
    fontSize: 20,
    fontWeight: '700',
    color: Colors.primary,
  },
  routeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  busNumber: {
    fontFamily: Typography.fontFamily,
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginRight: Spacing.sm,
  },
  routeBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 6,
  },
  routeBadgeText: {
    fontFamily: Typography.fontFamily,
    fontSize: 14,
    fontWeight: '700',
    color: Colors.surface,
  },
  routeStops: {
    backgroundColor: Colors.background,
    padding: Spacing.md,
    borderRadius: Layout.borderRadius,
    marginBottom: Spacing.md,
  },
  stopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  stopText: {
    fontFamily: Typography.fontFamily,
    fontSize: 15,
    color: Colors.textPrimary,
    flex: 1,
  },
  arrowContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  timeBreakdown: {
    marginVertical: Spacing.md,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  timeIconContainer: {
    width: 28,
    alignItems: 'center',
  },
  timeLabel: {
    flex: 1,
    fontFamily: Typography.fontFamily,
    fontSize: 14,
    color: Colors.textSecondary,
    marginLeft: Spacing.sm,
  },
  timeValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeValue: {
    fontFamily: Typography.fontFamily,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  delayedText: {
    color: Colors.error,
  },
  delayedIcon: {
    marginLeft: Spacing.xs,
  },
  totalTime: {
    backgroundColor: Colors.primary,
    padding: Spacing.md,
    borderRadius: Layout.borderRadius,
    marginTop: Spacing.md,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 2,
  },
  totalLabel: {
    fontFamily: Typography.fontFamily,
    fontSize: 16,
    fontWeight: '600',
    color: Colors.surface,
  },
  totalValue: {
    fontFamily: Typography.fontFamily,
    fontSize: 20,
    fontWeight: '700',
    color: Colors.surface,
  },
  comparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.md,
    gap: Spacing.xs,
  },
  walkComparison: {
    fontFamily: Typography.fontFamily,
    fontSize: 13,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  walkReasonText: {
    fontFamily: Typography.fontFamily,
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    fontStyle: 'italic',
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.md,
    gap: Spacing.xs,
  },
  estimateWarning: {
    fontFamily: Typography.fontFamily,
    fontSize: 12,
    color: '#B8860B',
    fontStyle: 'italic',
  },
  errorContainer: {
    backgroundColor: '#FFE5E5',
    padding: Spacing.md,
    borderRadius: Layout.borderRadius,
    borderWidth: 1,
    borderColor: '#FFCCCC',
  },
  errorTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  errorTitle: {
    fontFamily: Typography.fontFamily,
    fontSize: 18,
    fontWeight: '600',
    color: Colors.error,
  },
  errorText: {
    fontFamily: Typography.fontFamily,
    ...Typography.body,
    color: Colors.error,
  },
  startTripButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: Layout.borderRadius,
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  startTripButtonWalk: {
    backgroundColor: Colors.secondary,
  },
  startTripButtonText: {
    fontFamily: Typography.fontFamily,
    fontSize: 16,
    fontWeight: '700',
    color: Colors.surface,
  },
});
