# Codebase Cleanup Plan

This document outlines the cleanup tasks for the gOSU Bus Routing application, organized by priority and category.

---

## Phase 1: Critical Bug Fixes

### 1.1 Fix Redundant API Calls in osuBusAPI.js
**File:** `BackEnd/osuBusAPI.js`
**Lines:** 4-14
**Issue:** The color data fetch (`https://content.osu.edu/v2/bus/routes`) is inside the `.map()` loop, making 6 identical API calls when 1 would suffice.

**Fix:**
```javascript
export async function fetchAllRoutes() {
  const routeIds = ['BE', 'CC', 'CLS', 'ER', 'NWC', 'MC'];

  // Fetch color data ONCE outside the loop
  let routeColors = {};
  try {
    const routesResponse = await fetch('https://content.osu.edu/v2/bus/routes');
    if (routesResponse.ok) {
      const routesJson = await routesResponse.json();
      routesJson.data.routes.forEach(route => {
        routeColors[route.code] = route.color;
      });
    }
  } catch (err) {
    console.warn('Failed to fetch route colors:', err);
  }

  const promises = routeIds.map(async (id) => {
    // Use routeColors[id] instead of fetching again
    ...
  });
}
```

---

### 1.2 Fix Operator Precedence Bug in BusRouteMapLayer.js
**File:** `UXUI/BusRouteMapLayer.js`
**Line:** 109
**Issue:** `${(vehicle?.heading) + 90 ?? 90}deg` - nullish coalescing happens after addition, causing NaN when heading is undefined.

**Fix:**
```javascript
// Before
transform: [{ rotate: `${(vehicle?.heading) + 90 ?? 90}deg` }]

// After
transform: [{ rotate: `${(vehicle?.heading ?? 0) + 90}deg` }]
```

---

### 1.3 Fix ETA Formatting Bug in busRouting.js
**File:** `BackEnd/busRouting.js`
**Lines:** 434-446
**Issue:** Doesn't handle midnight (hours === 0), doesn't zero-pad minutes.

**Fix:**
```javascript
function calculateETA(totalTime) {
  const now = new Date();
  now.setMinutes(now.getMinutes() + totalTime);
  let hours = now.getHours();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const minutes = now.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}
```

---

## Phase 2: Code Deduplication

### 2.1 Create Shared Utilities Module
**Action:** Create `BackEnd/utils.js` with shared functions.

```javascript
// BackEnd/utils.js

// Constants
export const WALKING_SPEED_MPS = 1.1;
export const AVERAGE_BUS_SPEED_MPS = 6.7;
export const MAX_WALK_DISTANCE_METERS = 750;
export const DEFAULT_BUS_TRAVEL_TIME_MINUTES = 10;
export const TIME_SIMILARITY_THRESHOLD_MINUTES = 1;

/**
 * Calculate distance between two points using Haversine formula
 * @returns distance in meters
 */
export function haversineDistance(lat1, lon1, lat2, lon2) {
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

/**
 * Calculate walking time between two coordinate objects
 * @returns time in minutes
 */
export function calculateWalkTime(point1, point2) {
  if (!point1?.latitude || !point1?.longitude || !point2?.latitude || !point2?.longitude) {
    console.error('Invalid points for calculateWalkTime:', point1, point2);
    return 0;
  }
  const distance = haversineDistance(
    point1.latitude, point1.longitude,
    point2.latitude, point2.longitude
  );
  return distance / WALKING_SPEED_MPS / 60;
}

/**
 * Format ETA from minutes offset
 * @returns string in "H:MM" format
 */
export function formatETA(totalMinutes) {
  const now = new Date();
  now.setMinutes(now.getMinutes() + totalMinutes);
  let hours = now.getHours();
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const minutes = now.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Format time duration in human-readable way
 */
export function formatTime(minutes) {
  if (minutes < 1) return 'less than 1 min';
  const mins = Math.round(minutes);
  return `${mins} min${mins !== 1 ? 's' : ''}`;
}
```

### 2.2 Update Files to Use Shared Utils
**Files to update:**
- `BackEnd/busRouting.js` - Remove local implementations, import from utils
- `BackEnd/aggregateRouteInfo.js` - Remove local `formatETA`, import from utils
- `UXUI/SearchDrawer.js` - Remove local `distanceMeters`, import `haversineDistance` from utils

---

## Phase 3: Theme Consistency

### 3.1 Add Missing Theme Properties
**File:** `style/theme.js`

```javascript
export const Colors = {
  // ... existing colors ...

  // Add missing
  busRouteDefault: '#990000',  // Default fallback for unknown routes
  warning: '#FF9800',          // For clear start button

  // ... rest of colors ...
};
```

### 3.2 Replace Hardcoded Colors
**File:** `AppFolder/App.native.js`

| Line | Current | Replace With |
|------|---------|--------------|
| 183 | `'#BA0c2F'` | `Colors.primary` |
| 218 | `"#4CAF50"` | `Colors.success` |
| 231 | `"#ba0c2f"` | `Colors.primary` |
| 312 | `'#BA0C2F'` | `Colors.primary` |
| 327 | `'#FF9800'` | `Colors.warning` |

**File:** `UXUI/ErrorBoundary.js`

| Line | Current | Replace With |
|------|---------|--------------|
| 31 | `'#BB0000'` | Import and use `Colors.primary` |

### 3.3 Fix BusRouteLegend.js Theme References
**File:** `UXUI/BusRouteLegend.js`

```javascript
// Line 19: Change
Colors.busRouteDefault  // doesn't exist
// To
'#990000'  // or add busRouteDefault to theme

// Line 40: Change
...Colors.shadow  // doesn't exist
// To
...Layout.shadow  // correct import
```

---

## Phase 4: Code Quality Cleanup

### 4.1 Remove Commented Debug Code
**File:** `BackEnd/busRouting.js`
**Lines to remove:** 28, 42, 48, 296, 302, 308

Remove all `//console.log(...)` statements.

### 4.2 Fix Dead Code
**File:** `AppFolder/App.native.js`
**Line:** 208

```javascript
// Before
mapType={Platform.OS === 'ios' ? 'standard' : 'standard'}

// After
mapType="standard"
```

### 4.3 Remove Unused Styles
**File:** `UXUI/SearchDrawer.js`
**Lines:** 817-836

Remove unused style definitions:
- `fallbackContainer`
- `fallbackText`
- `fallbackSubtext`

### 4.4 Fix Typo
**File:** `BackEnd/walkingDirectionsAPI.js`
**Line:** 21

```javascript
// Before
const OSREndpoint = "https://api.openrouteservice.org/v2/directions/foot-walking/json";

// After
const ORSEndpoint = "https://api.openrouteservice.org/v2/directions/foot-walking/json";
```

---

## Phase 5: Logic Improvements

### 5.1 Fix useEffect Dependencies
**File:** `UXUI/SearchDrawer.js`
**Lines:** 206-210

```javascript
// Before
useEffect(() => {
  if ((routeResult || calculatingRoute) && !isOpen) {
    toggleDrawer();
  }
}, [routeResult, calculatingRoute]);

// After - use callback ref pattern or add dependencies
const toggleDrawerRef = useRef(toggleDrawer);
toggleDrawerRef.current = toggleDrawer;

useEffect(() => {
  if ((routeResult || calculatingRoute) && !isOpen) {
    toggleDrawerRef.current();
  }
}, [routeResult, calculatingRoute, isOpen]);
```

### 5.2 Add API Key Validation
**File:** `BackEnd/walkingDirectionsAPI.js`
**Line:** 4

```javascript
const ORS_API_KEY = Constants.expoConfig?.extra?.openRouteServiceApiKey;

if (!ORS_API_KEY) {
  console.warn('OpenRouteService API key not configured. Walking directions will fail.');
}
```

### 5.3 Standardize Error Return Structure
**File:** `BackEnd/busRouting.js`

Create consistent error return structure:
```javascript
// All error returns should include the same optional fields
return {
  recommendation: 'error',
  reason: 'Error message here',
  directWalkTime: directWalkTime,
  nearbyStartStops: startStops || [],
  nearbyEndStops: endStops || [],
};
```

---

## Phase 6: Code Organization

### 6.1 Clean Up Vehicle Object Mapping
**File:** `BackEnd/osuBusAPI.js`
**Lines:** 52-68

Reformat for consistent indentation:
```javascript
vehicles = vehicleArray.map((vehicle) => ({
  id: vehicle.id,
  latitude: vehicle.latitude,
  longitude: vehicle.longitude,
  heading: vehicle.heading,
  speed: vehicle.speed,
  destination: vehicle.destination,
  routeCode: vehicle.routeCode,
  predictions: vehicle.predictions || [],
  nextStop: vehicle.predictions?.[0]?.stopName || vehicle.destination || 'Unknown',
  lastUpdated: vehicle.updated,
}));
```

---

## Implementation Order

| Phase | Priority | Estimated Complexity |
|-------|----------|---------------------|
| Phase 1 | Critical | Low |
| Phase 2 | High | Medium |
| Phase 3 | Medium | Low |
| Phase 4 | Low | Low |
| Phase 5 | Medium | Medium |
| Phase 6 | Low | Low |

**Recommended approach:** Complete phases in order. Phase 1 fixes actual bugs. Phase 2 is the most impactful for long-term maintainability.

---

## Testing Checklist

After each phase, verify:

- [ ] App loads without errors
- [ ] Bus routes display on map
- [ ] Route calculation works (start -> destination)
- [ ] Walking fallback works when no buses available
- [ ] ETA displays correctly (check midnight edge case)
- [ ] Bus vehicle markers rotate correctly
- [ ] Search drawer opens/closes properly
- [ ] Origin and destination search work

---

## Files Modified Summary

| File | Phases |
|------|--------|
| `BackEnd/utils.js` | 2 (new file) |
| `BackEnd/busRouting.js` | 1, 2, 4, 5 |
| `BackEnd/osuBusAPI.js` | 1, 6 |
| `BackEnd/aggregateRouteInfo.js` | 2 |
| `BackEnd/walkingDirectionsAPI.js` | 4, 5 |
| `UXUI/SearchDrawer.js` | 2, 4, 5 |
| `UXUI/BusRouteMapLayer.js` | 1 |
| `UXUI/BusRouteLegend.js` | 3 |
| `UXUI/ErrorBoundary.js` | 3 |
| `AppFolder/App.native.js` | 3, 4 |
| `style/theme.js` | 3 |
