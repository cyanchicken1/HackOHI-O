// This is your new central theme file.
// An AI can be told to "change the primary color" and it only needs to edit this file.
import { Platform } from 'react-native';

export const Colors = {
  // Brand Colors - Updated to Ohio State Theme
  primary: '#BB0000',      // OSU Scarlet
  secondary: '#666666',    // OSU Gray
  
  // (Fallback) Bus Route Colors mapped by route ID
  busRouteColors: {
    'BE': '#BB0000',   // Scarlet
    'CC': '#0072CE',   // Blue
    'CLS': '#FFB81C',  // Gold
    'ER': '#008000',   // Green
    'MC': '#800080',   // Purple
    'MWC': '#FF6600',  // Orange
    'WMC': '#00CED1',  // Turquoise
  },

  // Neutral Colors
  background: '#F2F2F7',   // A very light gray for the app's main background
  surface: '#FFFFFF',      // White
  textPrimary: '#000000',  // Black
  textSecondary: '#666666',// OSU Gray
  border: '#E0E0E0',       // Light border color for inputs and dividers
  
  // Status Colors
  error: '#BB0000',        // Using Scarlet for errors
  success: '#34C759',      // Standard green for success
};

export const Spacing = {
  xs: 4,  // Extra small
  sm: 8,  // Small
  md: 16, // Medium (standard padding)
  lg: 24, // Large
  xl: 40, // Extra large
};

export const Typography = {
  fontFamily: 'System', 
  h1: { fontSize: 28, fontWeight: '700' },
  h2: { fontSize: 22, fontWeight: '600' },
  body: { fontSize: 16, fontWeight: '400' },
  caption: { fontSize: 12, fontWeight: '500' },
  textPrimary: { color: Colors.textPrimary },
  textSecondary: { color: Colors.textSecondary },
};

export const Layout = {
  borderRadius: 12,
  shadow: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
    android: {
      elevation: 4,
    },
    web: {
      boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
    },
  }),
};
