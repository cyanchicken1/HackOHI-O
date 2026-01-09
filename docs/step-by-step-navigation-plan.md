# Step-by-Step Navigation Implementation Plan

## Overview

Build a custom transit navigation UI that combines:
- **OpenRouteService API** for walking directions (free, no billing required)
- **OSU CABS API** for live bus tracking (already implemented)
- **expo-location** for user position tracking

This approach provides a unified experience that no off-the-shelf SDK can offer for campus transit.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        User Trip                            │
├─────────────┬─────────────┬─────────────┬──────────────────┤
│   WALK      │    WAIT     │    RIDE     │      WALK        │
│  to stop    │   for bus   │  on bus     │  to destination  │
├─────────────┼─────────────┼─────────────┼──────────────────┤
│ OpenRoute   │  CABS API   │  CABS API   │   OpenRoute      │
│ Service     │  (live ETA) │  (vehicle   │   Service        │
│ Directions  │             │   tracking) │   Directions     │
└─────────────┴─────────────┴─────────────┴──────────────────┘
```

---

## Components to Build

### 1. OpenRouteService Integration

**File:** `BackEnd/walkingDirections.js`

```javascript
const ORS_API_KEY = 'your_free_api_key';
const ORS_BASE_URL = 'https://api.openrouteservice.org/v2/directions/foot-walking';

/**
 * Get walking directions between two points
 * @param {Object} start - { latitude, longitude }
 * @param {Object} end - { latitude, longitude }
 * @returns {Object} - { polyline, steps, duration, distance }
 */
export async function getWalkingDirections(start, end) {
  const response = await fetch(
    `${ORS_BASE_URL}?api_key=${ORS_API_KEY}&start=${start.longitude},${start.latitude}&end=${end.longitude},${end.latitude}`,
    {
      headers: { 'Accept': 'application/json, application/geo+json' }
    }
  );

  const data = await response.json();
  const route = data.features[0];

  return {
    polyline: route.geometry.coordinates.map(([lon, lat]) => ({
      latitude: lat,
      longitude: lon
    })),
    steps: route.properties.segments[0].steps.map(step => ({
      instruction: step.instruction,
      distance: step.distance,
      duration: step.duration,
      type: step.type
    })),
    duration: route.properties.segments[0].duration,
    distance: route.properties.segments[0].distance
  };
}
```

**API Limits:** 2,000 requests/day (free tier)

---

### 2. Trip Data Structure

**File:** `BackEnd/tripBuilder.js`

```javascript
/**
 * Build a complete trip with all segments
 * @returns {Object} Trip with segments array
 */
export function buildTrip(userLocation, destination, busRoute) {
  return {
    id: generateTripId(),
    status: 'not_started', // not_started | in_progress | completed
    currentSegmentIndex: 0,
    segments: [
      {
        type: 'walk',
        status: 'pending',
        from: userLocation,
        to: busRoute.startStop,
        directions: null, // Populated by OpenRouteService
        duration: null,
        distance: null
      },
      {
        type: 'wait',
        status: 'pending',
        stop: busRoute.startStop,
        route: busRoute.routeId,
        routeName: busRoute.routeName,
        routeColor: busRoute.color,
        estimatedWait: busRoute.waitTime,
        liveETA: null // Updated from CABS API
      },
      {
        type: 'ride',
        status: 'pending',
        route: busRoute.routeId,
        routeName: busRoute.routeName,
        routeColor: busRoute.color,
        fromStop: busRoute.startStop,
        toStop: busRoute.endStop,
        stops: busRoute.intermediateStops,
        duration: busRoute.rideTime
      },
      {
        type: 'walk',
        status: 'pending',
        from: busRoute.endStop,
        to: destination,
        directions: null,
        duration: null,
        distance: null
      }
    ],
    totalDuration: null,
    startTime: null,
    estimatedArrival: null
  };
}
```

---

### 3. Trip Progress UI Component

**File:** `UXUI/TripProgressView.js`

A bottom sheet or card that shows:

```
┌────────────────────────────────────────┐
│  Trip to Ohio Union          12 min    │
├────────────────────────────────────────┤
│  ✓ Walk to Neil Ave stop     (2 min)   │  <- completed
│  ● Wait for BE bus           ~2 min    │  <- current (pulsing)
│  ○ Ride 4 stops              (6 min)   │  <- pending
│  ○ Walk to destination       (2 min)   │  <- pending
├────────────────────────────────────────┤
│  [Step Details]                        │
│  "Board the BE bus heading East"       │
│  Bus arriving in 2:34                  │
│                                        │
│  [Live bus indicator on map]           │
└────────────────────────────────────────┘
```

**Features:**
- Expandable step details
- Live countdown for bus arrival
- Auto-advances when user reaches waypoints
- Shows current instruction prominently

---

### 4. Location Tracking & Step Detection

**File:** `BackEnd/tripTracker.js`

```javascript
import * as Location from 'expo-location';

const ARRIVAL_THRESHOLD_METERS = 30;

export class TripTracker {
  constructor(trip, onStepChange, onTripComplete) {
    this.trip = trip;
    this.onStepChange = onStepChange;
    this.onTripComplete = onTripComplete;
    this.locationSubscription = null;
  }

  async start() {
    this.locationSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        distanceInterval: 10, // Update every 10 meters
      },
      (location) => this.handleLocationUpdate(location)
    );
  }

  handleLocationUpdate(location) {
    const currentSegment = this.trip.segments[this.trip.currentSegmentIndex];

    if (currentSegment.type === 'walk') {
      const distanceToTarget = haversineDistance(
        location.coords,
        currentSegment.to
      );

      if (distanceToTarget < ARRIVAL_THRESHOLD_METERS) {
        this.advanceToNextSegment();
      }
    }
    // Ride segment: check if bus has arrived at destination stop
    // Wait segment: check if bus has arrived at stop (via CABS API)
  }

  advanceToNextSegment() {
    this.trip.segments[this.trip.currentSegmentIndex].status = 'completed';
    this.trip.currentSegmentIndex++;

    if (this.trip.currentSegmentIndex >= this.trip.segments.length) {
      this.onTripComplete();
    } else {
      this.trip.segments[this.trip.currentSegmentIndex].status = 'active';
      this.onStepChange(this.trip);
    }
  }

  stop() {
    if (this.locationSubscription) {
      this.locationSubscription.remove();
    }
  }
}
```

---

### 5. Enhanced Map Layer

**Update:** `UXUI/BusRouteMapLayer.js`

Add support for:
- Walking direction polylines (dashed line style)
- Current step highlight
- User location with heading
- Pulsing indicator at next waypoint

```javascript
// Walking path style
<Polyline
  coordinates={walkingPath}
  strokeColor="#666666"
  strokeWidth={4}
  lineDashPattern={[10, 5]}  // Dashed for walking
/>

// Bus route style (already exists)
<Polyline
  coordinates={busPath}
  strokeColor={routeColor}
  strokeWidth={4}
/>

// Next waypoint indicator
<Marker coordinate={nextWaypoint}>
  <PulsingDot color={currentSegment.type === 'walk' ? '#666' : routeColor} />
</Marker>
```

---

## Implementation Steps

### Phase 1: OpenRouteService Integration
1. Sign up for free API key at [openrouteservice.org](https://openrouteservice.org/dev/#/signup)
2. Create `walkingDirections.js` with API client
3. Add API key to `.env` file
4. Test with sample coordinates on campus

### Phase 2: Trip Data Structure
1. Create `tripBuilder.js` with segment builder
2. Integrate with existing `findBestRoute()` in `busRouting.js`
3. Add walking directions fetch to trip creation
4. Cache walking directions to reduce API calls

### Phase 3: Trip Progress UI
1. Create `TripProgressView.js` component
2. Add step list with status indicators
3. Implement expand/collapse for step details
4. Add live ETA countdown for wait segments
5. Style to match existing theme

### Phase 4: Location Tracking
1. Create `TripTracker.js` class
2. Implement arrival detection for walk segments
3. Integrate CABS API polling for ride segment tracking
4. Add bus arrival detection for wait segments
5. Handle edge cases (user goes off route, misses bus)

### Phase 5: Map Integration
1. Update `BusRouteMapLayer.js` with walking polylines
2. Add current step highlighting
3. Add pulsing waypoint markers
4. Implement map auto-centering on user during navigation

### Phase 6: Polish & Edge Cases
1. Handle API errors gracefully
2. Add "Recalculate" button if user deviates
3. Add "End Trip" functionality
4. Persist active trip across app restarts
5. Add haptic feedback on step completion

---

## Data Flow

```
User taps "Start Trip"
        │
        ▼
┌───────────────────┐
│ buildTrip()       │ ← Creates trip structure with segments
└───────┬───────────┘
        │
        ▼
┌───────────────────┐
│ getWalkingDirs()  │ ← Fetches OpenRouteService for walk segments
└───────┬───────────┘
        │
        ▼
┌───────────────────┐
│ TripTracker.start │ ← Begins location watching
└───────┬───────────┘
        │
        ▼
┌───────────────────────────────────────────┐
│              Active Trip Loop              │
│  ┌─────────────────────────────────────┐  │
│  │ Location Update                     │  │
│  │   → Check distance to waypoint      │  │
│  │   → Advance segment if arrived      │  │
│  └─────────────────────────────────────┘  │
│  ┌─────────────────────────────────────┐  │
│  │ CABS API Poll (every 15s)           │  │
│  │   → Update bus ETA for wait segment │  │
│  │   → Track bus position during ride  │  │
│  └─────────────────────────────────────┘  │
│  ┌─────────────────────────────────────┐  │
│  │ UI Update                           │  │
│  │   → Refresh TripProgressView        │  │
│  │   → Update map polylines/markers    │  │
│  └─────────────────────────────────────┘  │
└───────────────────────────────────────────┘
        │
        ▼
┌───────────────────┐
│ Trip Complete     │ ← All segments done
└───────────────────┘
```

---

## API Reference

### OpenRouteService Directions

**Endpoint:** `GET https://api.openrouteservice.org/v2/directions/foot-walking`

**Parameters:**
| Param | Description |
|-------|-------------|
| `api_key` | Your free API key |
| `start` | `longitude,latitude` |
| `end` | `longitude,latitude` |

**Response:** GeoJSON with route geometry and step-by-step instructions

**Free Tier Limits:**
- 2,000 requests/day
- 40 requests/minute

**Docs:** https://openrouteservice.org/dev/#/api-docs/v2/directions

---

## File Structure After Implementation

```
BackEnd/
├── osuBusAPI.js          (existing)
├── busRouting.js         (existing - update to use tripBuilder)
├── walkingDirections.js  (NEW - OpenRouteService client)
├── tripBuilder.js        (NEW - trip data structure)
└── tripTracker.js        (NEW - location tracking)

UXUI/
├── SearchDrawer.js       (existing - add "Start Trip" button)
├── BusRouteMapLayer.js   (existing - add walking polylines)
├── TripProgressView.js   (NEW - step-by-step UI)
└── PulsingDot.js         (NEW - animated waypoint marker)
```

---

## Environment Variables

Add to `.env`:
```
GOOGLE_MAPS_API_KEY=...     (existing)
OPENROUTESERVICE_API_KEY=your_free_key_here
```

Update `app.config.js` to include:
```javascript
extra: {
  openRouteServiceApiKey: process.env.OPENROUTESERVICE_API_KEY
}
```
