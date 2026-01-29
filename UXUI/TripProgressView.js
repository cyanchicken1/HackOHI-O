import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  useWindowDimensions,
  ScrollView,
  Modal,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Typography, Layout } from '../style/theme';
import Icon, { IconSizes } from './Icons';
import { formatTime } from '../BackEnd/busRouting';

/**
 * StepsBottomSheet - Modal bottom sheet showing all walking steps
 */
function StepsBottomSheet({ visible, onClose, steps, insets }) {
  const slideAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 65,
        friction: 11,
        useNativeDriver: true,
      }).start();
    } else {
      slideAnim.setValue(300);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={sheetStyles.overlay}>
        <Pressable style={sheetStyles.backdrop} onPress={onClose} />
        <Animated.View
          style={[
            sheetStyles.sheet,
            {
              paddingBottom: insets.bottom + Spacing.md,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Header */}
          <View style={sheetStyles.header}>
            <View style={sheetStyles.headerLeft}>
              <Icon name="walk" size={IconSizes.lg} color={Colors.secondary} />
              <Text style={sheetStyles.headerTitle}>Walking Directions</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={sheetStyles.closeButton}>
              <Icon name="close" size={IconSizes.md} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Steps list */}
          <ScrollView
            style={sheetStyles.stepsList}
            showsVerticalScrollIndicator={false}
          >
            {steps.map((step, idx) => (
              <View key={idx} style={sheetStyles.stepRow}>
                <View style={sheetStyles.stepNumber}>
                  <Text style={sheetStyles.stepNumberText}>{idx + 1}</Text>
                </View>
                <View style={sheetStyles.stepContent}>
                  <Text style={sheetStyles.stepInstruction}>{step.instruction}</Text>
                  {step.distance > 0 && (
                    <Text style={sheetStyles.stepDistance}>
                      {step.distance < 1000
                        ? `${Math.round(step.distance)}m`
                        : `${(step.distance / 1000).toFixed(1)}km`}
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const sheetStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    ...Layout.shadow,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerTitle: {
    fontFamily: Typography.fontFamily,
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  closeButton: {
    padding: Spacing.sm,
    borderRadius: 20,
    backgroundColor: Colors.background,
  },
  stepsList: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
  },
  stepRow: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontFamily: Typography.fontFamily,
    fontSize: 14,
    fontWeight: '700',
    color: Colors.surface,
  },
  stepContent: {
    flex: 1,
    paddingTop: 2,
  },
  stepInstruction: {
    fontFamily: Typography.fontFamily,
    fontSize: 15,
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  stepDistance: {
    fontFamily: Typography.fontFamily,
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
  },
});

/**
 * Get icon and color for segment type
 */
function getSegmentIcon(type, routeColor) {
  switch (type) {
    case 'walk':
      return { icon: 'walk', color: Colors.secondary };
    case 'wait':
      return { icon: 'time', color: routeColor || Colors.primary };
    case 'ride':
      return { icon: 'bus', color: routeColor || Colors.primary };
    default:
      return { icon: 'ellipse', color: Colors.textSecondary };
  }
}

/**
 * Get label for segment type
 */
function getSegmentLabel(segment, index, totalSegments) {
  switch (segment.type) {
    case 'walk':
      if (index === 0) {
        return `Walk to ${segment.to?.name || 'bus stop'}`;
      } else {
        return 'Walk to destination';
      }
    case 'wait':
      return `Wait for bus`;
    case 'ride':
      return `Ride ${segment.stopsBetween || 0} stop${segment.stopsBetween !== 1 ? 's' : ''}`;
    default:
      return 'Unknown step';
  }
}

/**
 * Get detailed instruction for current segment
 */
function getCurrentInstruction(segment, routeResult) {
  switch (segment.type) {
    case 'walk':
      if (segment.steps && segment.steps.length > 0) {
        return segment.steps[0]?.instruction || 'Head towards your destination';
      }
      return `Walk to ${segment.to?.name || 'your destination'}`;
    case 'wait':
      const busId = segment.bus?.id || routeResult?.route?.id;
      return `Board the ${routeResult?.route?.id || ''} bus (Bus #${busId})`;
    case 'ride':
      return `Get off at ${segment.toStop?.name || 'your stop'}`;
    default:
      return 'Continue to next step';
  }
}

/**
 * SegmentRow - displays a single step in the trip
 */
function SegmentRow({ segment, index, currentIndex, routeColor, isLast }) {
  const isCompleted = index < currentIndex;
  const isCurrent = index === currentIndex;
  const isPending = index > currentIndex;

  const { icon, color } = getSegmentIcon(segment.type, routeColor);
  const label = getSegmentLabel(segment, index, 4);
  const duration = segment.duration ? formatTime(segment.duration) : '--';

  // Pulsing animation for current step
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isCurrent) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [isCurrent]);

  return (
    <View style={styles.segmentRow}>
      {/* Status indicator column */}
      <View style={styles.statusColumn}>
        {/* Icon container - matches content row height for vertical centering */}
        <View style={styles.statusIconContainer}>
          {isCompleted ? (
            <Icon name="checkmark-circle" size={IconSizes.lg} color={Colors.success} />
          ) : isCurrent ? (
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <Icon name="radio-button-on" size={IconSizes.lg} color={color} />
            </Animated.View>
          ) : (
            <Icon name="ellipse-outline" size={IconSizes.lg} color={Colors.border} />
          )}
        </View>
        {/* Connector line */}
        {!isLast && (
          <View
            style={[
              styles.connectorLine,
              { backgroundColor: isCompleted ? Colors.success : Colors.border }
            ]}
          />
        )}
      </View>

      {/* Content column */}
      <View style={[styles.segmentContent, isCurrent && styles.segmentContentCurrent]}>
        <View style={styles.segmentHeader}>
          <Icon
            name={icon}
            size={IconSizes.md}
            color={isPending ? Colors.textSecondary : color}
          />
          <Text
            style={[
              styles.segmentLabel,
              isCompleted && styles.segmentLabelCompleted,
              isPending && styles.segmentLabelPending,
            ]}
          >
            {label}
          </Text>
        </View>
        <Text
          style={[
            styles.segmentDuration,
            isCompleted && styles.segmentDurationCompleted,
          ]}
        >
          {isCompleted ? 'Done' : isCurrent ? `~${duration}` : `(${duration})`}
        </Text>
      </View>
    </View>
  );
}

/**
 * TripProgressView - main component for step-by-step navigation
 */
export default function TripProgressView({
  activeTrip,
  routeResult,
  destination,
  onEndTrip,
  onNextStep,
}) {
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [showAllSteps, setShowAllSteps] = useState(false);

  if (!activeTrip || !routeResult) return null;

  const currentSegment = routeResult.segments[activeTrip.currentSegmentIndex];
  const routeColor = routeResult.route?.color || Colors.primary;

  // Calculate remaining time
  const remainingSegments = routeResult.segments.slice(activeTrip.currentSegmentIndex);
  const remainingTime = remainingSegments.reduce((acc, seg) => acc + (seg.duration || 0), 0);

  // Calculate view height - use 55% of screen, no cap, plus safe area
  const viewHeight = (windowHeight * 0.55) + insets.bottom;

  return (
    <View style={[styles.container, { height: viewHeight, paddingBottom: insets.bottom }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Icon name="navigate" size={IconSizes.lg} color={Colors.surface} />
          <View style={styles.headerText}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              Trip to {destination?.name || 'Destination'}
            </Text>
            <Text style={styles.headerSubtitle}>
              {formatTime(remainingTime)} remaining
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={onEndTrip} style={styles.endTripButton}>
          <Icon name="close" size={IconSizes.md} color={Colors.surface} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: Spacing.xl }}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={true}
      >
        {/* Step list */}
        <View style={styles.stepList}>
          {routeResult.segments.map((segment, index) => (
            <SegmentRow
              key={index}
              segment={segment}
              index={index}
              currentIndex={activeTrip.currentSegmentIndex}
              routeColor={routeColor}
              isLast={index === routeResult.segments.length - 1}
            />
          ))}
        </View>

        {/* Current step details */}
        <View style={styles.currentStepCard}>
          <Text style={styles.currentStepTitle}>Current Step</Text>
          <View style={styles.currentStepContent}>
            <Icon
              name={getSegmentIcon(currentSegment?.type, routeColor).icon}
              size={IconSizes.xl}
              color={routeColor}
            />
            <Text style={styles.currentStepInstruction}>
              {getCurrentInstruction(currentSegment, routeResult)}
            </Text>
          </View>

          {/* Bus countdown for wait segment */}
          {currentSegment?.type === 'wait' && currentSegment?.bus?.countdown && (
            <View style={styles.countdownContainer}>
              <Icon name="time" size={IconSizes.md} color={Colors.primary} />
              <Text style={styles.countdownText}>
                Bus arriving in {currentSegment.bus.countdown}
              </Text>
            </View>
          )}

          {/* Walking steps for walk segment */}
          {currentSegment?.type === 'walk' && currentSegment?.steps?.length > 0 && (
            <View style={styles.walkingSteps}>
              {currentSegment.steps.slice(0, 3).map((step, idx) => (
                <View key={idx} style={styles.walkingStep}>
                  <Icon name="chevron-forward" size={IconSizes.sm} color={Colors.textSecondary} />
                  <Text style={styles.walkingStepText} numberOfLines={2}>
                    {step.instruction}
                  </Text>
                </View>
              ))}
              {currentSegment.steps.length > 3 && (
                <TouchableOpacity
                  onPress={() => setShowAllSteps(true)}
                  style={styles.moreStepsButton}
                >
                  <Text style={styles.moreSteps}>
                    +{currentSegment.steps.length - 3} more steps
                  </Text>
                  <Icon name="chevron-forward" size={IconSizes.sm} color={Colors.primary} />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Action buttons */}
        <View style={styles.actionButtons}>
          {activeTrip.currentSegmentIndex < routeResult.segments.length - 1 ? (
            <TouchableOpacity style={styles.nextStepButton} onPress={onNextStep}>
              <Text style={styles.nextStepButtonText}>Next Step</Text>
              <Icon name="chevron-forward" size={IconSizes.md} color={Colors.surface} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.completeButton} onPress={onEndTrip}>
              <Icon name="checkmark-circle" size={IconSizes.md} color={Colors.surface} />
              <Text style={styles.nextStepButtonText}>Complete Trip</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.endTripFullButton} onPress={onEndTrip}>
            <Icon name="close-circle" size={IconSizes.sm} color={Colors.error} />
            <Text style={styles.endTripButtonTextSmall}>End Trip</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Walking steps bottom sheet */}
      <StepsBottomSheet
        visible={showAllSteps}
        onClose={() => setShowAllSteps(false)}
        steps={currentSegment?.steps || []}
        insets={insets}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Layout.borderRadius,
    borderTopRightRadius: Layout.borderRadius,
    ...Layout.shadow,
    zIndex: 200,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderTopLeftRadius: Layout.borderRadius,
    borderTopRightRadius: Layout.borderRadius,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: Spacing.sm,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: Typography.fontFamily,
    fontSize: 18,
    fontWeight: '700',
    color: Colors.surface,
  },
  headerSubtitle: {
    fontFamily: Typography.fontFamily,
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  endTripButton: {
    padding: Spacing.sm,
    borderRadius: Layout.borderRadius,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  content: {
    flex: 1,
    padding: Spacing.md,
  },
  stepList: {
    marginBottom: Spacing.md,
  },
  segmentRow: {
    flexDirection: 'row',
    minHeight: 48,
  },
  statusColumn: {
    width: 32,
    alignItems: 'center',
  },
  statusIconContainer: {
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  connectorLine: {
    width: 2,
    flex: 1,
    marginVertical: 4,
  },
  segmentContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    marginLeft: Spacing.sm,
    borderRadius: 8,
  },
  segmentContentCurrent: {
    backgroundColor: Colors.background,
  },
  segmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  segmentLabel: {
    fontFamily: Typography.fontFamily,
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    flex: 1,
  },
  segmentLabelCompleted: {
    color: Colors.success,
    textDecorationLine: 'line-through',
  },
  segmentLabelPending: {
    color: Colors.textSecondary,
    fontWeight: '400',
  },
  segmentDuration: {
    fontFamily: Typography.fontFamily,
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  segmentDurationCompleted: {
    color: Colors.success,
  },
  currentStepCard: {
    backgroundColor: Colors.background,
    borderRadius: Layout.borderRadius,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  currentStepTitle: {
    fontFamily: Typography.fontFamily,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  currentStepContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  currentStepInstruction: {
    fontFamily: Typography.fontFamily,
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    flex: 1,
  },
  countdownContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: Spacing.sm,
  },
  countdownText: {
    fontFamily: Typography.fontFamily,
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary,
  },
  walkingSteps: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  walkingStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.xs,
    gap: Spacing.xs,
  },
  walkingStepText: {
    fontFamily: Typography.fontFamily,
    fontSize: 14,
    color: Colors.textSecondary,
    flex: 1,
  },
  moreStepsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  moreSteps: {
    fontFamily: Typography.fontFamily,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  actionButtons: {
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  nextStepButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: Layout.borderRadius,
    gap: Spacing.sm,
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.success,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: Layout.borderRadius,
    gap: Spacing.sm,
  },
  nextStepButtonText: {
    fontFamily: Typography.fontFamily,
    fontSize: 16,
    fontWeight: '700',
    color: Colors.surface,
  },
  endTripFullButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
  },
  endTripButtonTextSmall: {
    fontFamily: Typography.fontFamily,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.error,
  },
});
