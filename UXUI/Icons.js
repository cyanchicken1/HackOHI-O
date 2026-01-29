import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../style/theme';

/**
 * Centralized icon component using Ionicons
 * Usage: <Icon name="bus" size={24} color={Colors.primary} />
 */

// Semantic icon mapping
const ICON_MAP = {
  // Navigation & Location
  'location-pin': 'location',
  'location-outline': 'location-outline',
  'navigate': 'navigate',
  'compass': 'compass',

  // Search & UI
  'search': 'search',
  'close': 'close',
  'close-circle': 'close-circle',
  'chevron-down': 'chevron-down',
  'chevron-up': 'chevron-up',
  'chevron-forward': 'chevron-forward',
  'expand': 'expand',

  // Transit
  'bus': 'bus',
  'bus-outline': 'bus-outline',
  'walk': 'walk',
  'stop': 'flag',
  'stop-circle': 'stop-circle',

  // Time & Status
  'time': 'time',
  'time-outline': 'time-outline',
  'hourglass': 'hourglass',
  'checkmark': 'checkmark',
  'checkmark-circle': 'checkmark-circle',
  'checkmark-circle-outline': 'checkmark-circle-outline',
  'alert': 'alert-circle',
  'alert-outline': 'alert-circle-outline',
  'warning': 'warning',
  'information': 'information-circle',

  // Actions
  'play': 'play',
  'pause': 'pause',
  'refresh': 'refresh',
  'arrow-forward': 'arrow-forward',
  'arrow-down': 'chevron-down',
  'arrow-up': 'chevron-up',

  // Misc
  'ellipse': 'ellipse',
  'ellipse-outline': 'ellipse-outline',
  'radio-button-on': 'radio-button-on',
  'radio-button-off': 'radio-button-off',
  'bulb': 'bulb',
  'ruler': 'resize',
};

// Default sizes
export const IconSizes = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
};

export default function Icon({
  name,
  size = IconSizes.md,
  color = Colors.textPrimary,
  style,
  ...props
}) {
  const iconName = ICON_MAP[name] || name;

  return (
    <Ionicons
      name={iconName}
      size={size}
      color={color}
      style={style}
      {...props}
    />
  );
}

// Named export for convenience
export { Icon };
