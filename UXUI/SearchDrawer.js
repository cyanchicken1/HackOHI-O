import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableOpacity,
  ScrollView,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import { Colors, Spacing, Typography, Layout } from '../style/theme';
import { formatTime } from '../BackEnd/busRouting';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const DRAWER_PEEK_HEIGHT = SCREEN_HEIGHT * 0.07;
const DRAWER_FULL_HEIGHT = Math.min(SCREEN_HEIGHT, SCREEN_HEIGHT * 0.8);
const CLOSED_OFFSET = DRAWER_FULL_HEIGHT - DRAWER_PEEK_HEIGHT;

/* ---------------- helpers ---------------- */

function distanceMeters(a, b) {
  if (!a || !b) return Infinity;
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const formatDistance = (meters) => {
  if (!isFinite(meters)) return '';
  
  const METERS_IN_MILE = 1609.34; // 1 mile = 1609.34 meters
  const METERS_IN_FOOT = 0.3048; // 1 foot = 0.3048 meters
  const MILES_IN_METER = 0.000621371; // 1 meter = 0.000621371 miles
  const FEET_THRESHOLD_MILES = 0.25; // Use feet for distances < 0.25 miles
  const FEET_THRESHOLD_METERS = FEET_THRESHOLD_MILES * METERS_IN_MILE; // ~402 meters
  
  if (meters < FEET_THRESHOLD_METERS) {
    // Show feet for distances < 0.25 miles, rounded to nearest 10
    const feet = meters / METERS_IN_FOOT;
    const roundedFeet = Math.round(feet / 10) * 10;
    return `${roundedFeet} ft`;
  } else {
    // Show miles for distances >= 0.25 miles, 1 decimal place, remove trailing zero
    const miles = meters * MILES_IN_METER;
    const roundedMiles = Math.round(miles * 10) / 10;
    // Format with 1 decimal place, then remove trailing zero
    const formatted = roundedMiles.toFixed(1);
    return `${formatted.replace(/\.0$/, '')} mi`;
  }
};

function nameSimilarityScore(nameLC, qLC) {
  if (!qLC) return 9999;
  
  // Exact match - best score
  if (nameLC === qLC) return -1000;
  
  // Starts with query - very good score
  if (nameLC.startsWith(qLC)) return -500;
  
  // Contains exact substring - good score based on position
  const idx = nameLC.indexOf(qLC);
  if (idx >= 0) return idx;
  
  // Check if query matches word beginnings (e.g., "lib" matches "Library")
  const words = nameLC.split(/\s+/);
  for (let i = 0; i < words.length; i++) {
    if (words[i].startsWith(qLC)) {
      return 10 + i; // Prefer earlier words
    }
  }
  
  // Sliding window fuzzy match - find best match anywhere in the name
  let bestEditDist = Infinity;
  let bestPosition = -1;
  
  // Slide a window of query length across the name
  for (let i = 0; i <= nameLC.length - qLC.length; i++) {
    const substring = nameLC.substring(i, i + qLC.length);
    const editDist = levenshteinDistance(substring, qLC);
    if (editDist < bestEditDist) {
      bestEditDist = editDist;
      bestPosition = i;
    }
  }
  
  // Allow fuzzy matches with reasonable edit distance
  const threshold = Math.max(2, Math.ceil(qLC.length * 0.35));
  if (bestEditDist <= threshold) {
    return 50 + (bestEditDist * 10) + (bestPosition * 0.5); // Slight preference for earlier matches
  }
  
  // Check for prefix fuzzy match (query fuzzy-matches start of name)
  if (nameLC.length >= qLC.length) {
    const prefixDist = levenshteinDistance(nameLC.substring(0, qLC.length), qLC);
    if (prefixDist <= threshold) {
      return 40 + (prefixDist * 10);
    }
  }
  
  // Check if query matches word starts with typos
  for (let i = 0; i < words.length; i++) {
    if (words[i].length >= qLC.length) {
      const wordPrefixDist = levenshteinDistance(words[i].substring(0, qLC.length), qLC);
      if (wordPrefixDist <= threshold) {
        return 60 + (wordPrefixDist * 10) + i;
      }
    }
  }
  
  // Check for acronym/abbreviation match (e.g., "sh" matches "Student Hall")
  if (qLC.length >= 2 && words.length >= 2) {
    const acronym = words.map(w => w[0]).join('');
    if (acronym.startsWith(qLC)) {
      return 100;
    }
  }
  
  // Multi-word query handling
  if (qLC.includes(' ')) {
    const queryWords = qLC.split(' ');
    const matchedWords = queryWords.filter(word => nameLC.includes(word));
    if (matchedWords.length > 0) {
      return 200 - (matchedWords.length * 30);
    }
  }
  
  // Poor match - high score
  return 9999;
}

// Levenshtein distance algorithm (optimized)
function levenshteinDistance(str1, str2) {
  const len1 = str1.length;
  const len2 = str2.length;
  
  // Quick exits
  if (len1 === 0) return len2;
  if (len2 === 0) return len1;
  if (str1 === str2) return 0;
  
  // Use single array instead of matrix for better memory efficiency
  let prevRow = Array(len2 + 1).fill(0).map((_, i) => i);
  
  for (let i = 1; i <= len1; i++) {
    let currRow = [i];
    
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      currRow[j] = Math.min(
        prevRow[j] + 1,        // deletion
        currRow[j - 1] + 1,    // insertion
        prevRow[j - 1] + cost  // substitution
      );
    }
    
    prevRow = currRow;
  }
  
  return prevRow[len2];
}

/* ---------------- TimeRow component ---------------- */

function TimeRow({ icon, label, time, delayed }) {
  return (
    <View style={styles.timeRow}>
      <Text style={styles.timeIcon}>{icon}</Text>
      <Text style={styles.timeLabel}>{label}</Text>
      <Text style={[styles.timeValue, delayed && styles.delayedText]}>
        {time}
        {delayed && ' ⚠️'}
      </Text>
    </View>
  );
}

/* ---------------- component ---------------- */

export default function SearchDrawer({
  userLocation,
  buildings = [],
  onSelect = () => {},
  onFlyTo,
  onSetStart = () => {},
  routes = null,
  resetOrigin = false,
  routeResult = null,
  startLocation = null,
  destination = null,
  calculatingRoute = false,
}) {
  const translateY = useRef(new Animated.Value(CLOSED_OFFSET)).current;
  const [isOpen, setIsOpen] = useState(false);
  
  // Auto-open drawer when route results are available
  useEffect(() => {
    if ((routeResult || calculatingRoute) && !isOpen) {
      toggleDrawer();
    }
  }, [routeResult, calculatingRoute]);
  
  const toggleDrawer = () => {
    Animated.spring(translateY, {
      toValue: !isOpen ? 0 : CLOSED_OFFSET,
      tension: 60,
      friction: 15,
      useNativeDriver: true,
    }).start();
    // Close keyboard when drawer is closed
    if (isOpen) {
      originInputRef.current?.blur();
      destInputRef.current?.blur();
      Keyboard.dismiss();
    }
    setIsOpen(!isOpen);
  };

  const prepped = useMemo(
    () => buildings.map((b) => ({ ...b, _nameLC: (b.name || '').toLowerCase() })),
    [buildings]
  );

  const DEFAULT_ORIGIN_LABEL = 'Current location';
  const [originQuery, setOriginQuery] = useState(DEFAULT_ORIGIN_LABEL);
  const originInputRef = useRef(null);
  const [originPicked, setOriginPicked] = useState(null);
  const [showOriginResults, setShowOriginResults] = useState(false);

  const [destQuery, setDestQuery] = useState('');
  const [showDestResults, setShowDestResults] = useState(false);
  const destInputRef = useRef(null);

  useEffect(() => {
    if (resetOrigin) {
      setOriginQuery(DEFAULT_ORIGIN_LABEL);
      setOriginPicked(null);
      onSetStart(null);
    }
  }, [resetOrigin]);

  // Update destination query when destination changes
  useEffect(() => {
    if (destination) {
      setDestQuery(destination.name);
    }
  }, [destination]);

  const originOptions = useMemo(() => {
    const q = originQuery.trim();
    if (!q || /^current location$/i.test(q)) return [];
    const qLC = q.toLowerCase();
    const scored = prepped.map((b) => ({
      ...b,
      _score: nameSimilarityScore(b._nameLC, qLC),
      _dist: distanceMeters(userLocation, { latitude: b.latitude, longitude: b.longitude }),
    }));
    scored.sort((a, b) => (a._score !== b._score ? a._score - b._score : a._dist - b._dist));
    return scored.slice(0, 3);
  }, [originQuery, prepped, userLocation]);

  const effectiveOrigin =
    (originPicked && { latitude: originPicked.latitude, longitude: originPicked.longitude }) ||
    userLocation ||
    null;

  const destResults = useMemo(() => {
  const qLC = destQuery.trim().toLowerCase();
  if (!qLC) return [];
  
  // Score ALL buildings, don't filter first
  const scored = prepped.map((b) => ({
    ...b,
    _score: nameSimilarityScore(b._nameLC, qLC),
    _dist: distanceMeters(effectiveOrigin, { latitude: b.latitude, longitude: b.longitude }),
  }));
  
  // Sort by score first, then distance
  scored.sort((a, b) => (a._score !== b._score ? a._score - b._score : a._dist - b._dist));
  
  // Only show results with reasonable scores (exclude very poor matches)
  const filtered = scored.filter(item => item._score < 300);
  
  return filtered.slice(0, 3);
}, [destQuery, prepped, effectiveOrigin]);

  const handleOriginSelect = (item) => {
    setOriginPicked(item);
    setOriginQuery(item.name);
    onSetStart(item);
    onFlyTo?.({ latitude: item.latitude, longitude: item.longitude }, 0.006);
    setShowOriginResults(false);
    originInputRef.current?.blur();
    destInputRef.current?.blur();
    Keyboard.dismiss();
  };

  const handleDestSelect = (item) => {
    onSelect(item);
    onFlyTo?.({ latitude: item.latitude, longitude: item.longitude }, 0.004);
    setDestQuery(item.name);
    setShowDestResults(false);
    originInputRef.current?.blur();
    destInputRef.current?.blur();
    Keyboard.dismiss();
    if (!isOpen) {
      toggleDrawer();
    }
  };

  // Determine header title based on current state
  const getHeaderTitle = () => {
    if (routeResult || calculatingRoute) {
      return isOpen ? 'Route Results' : 'View Route Results';
    }
    return isOpen ? 'Hide search' : 'Find a Building';
  };

  return (
    <Animated.View
      style={[styles.drawer, { height: DRAWER_FULL_HEIGHT, transform: [{ translateY }] }]}
    >
      <TouchableOpacity activeOpacity={0.85} onPress={toggleDrawer} style={styles.header}>
        <Text style={styles.headerTitle}>{getHeaderTitle()}</Text>
      </TouchableOpacity>

      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
        {/* ORIGIN SECTION */}
        <View style={styles.section}>
          <View style={styles.originRow}>
            <Text style={styles.originIcon}>📍</Text>
            <TextInput
              ref={originInputRef}
              style={styles.originInput}
              placeholder={DEFAULT_ORIGIN_LABEL}
              placeholderTextColor="rgba(255,255,255,0.85)"
              value={originQuery}
              onFocus={() => {
                if (!isOpen) toggleDrawer();
                setShowOriginResults(true);
                setShowDestResults(false);
                setTimeout(() => {
                  try {
                    const len = originQuery.length;
                    originInputRef.current?.setNativeProps?.({ selection: { start: 0, end: len } });
                  } catch {}
                }, 0);
              }}
              onChangeText={setOriginQuery}
              onSubmitEditing={() => {
                if (originOptions.length > 0) {
                  handleOriginSelect(originOptions[0]);
                }
              }}
              returnKeyType="search"
            />
          </View>

          {/* Origin Results Dropdown */}
          {showOriginResults && originOptions.length > 0 && (
            <View style={styles.dropdown}>
              {originOptions.map((item) => (
                <TouchableOpacity
                  key={String(item.id)}
                  style={styles.dropdownItem}
                  onPress={() => handleOriginSelect(item)}
                >
                  <Text style={styles.dropdownName}>{item.name}</Text>
                  <Text style={styles.dropdownSub}>
                    {isFinite(item._dist) ? formatDistance(item._dist) : ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* DESTINATION SECTION */}
        <View style={styles.section}>
          <View style={styles.inputRow}>
            <Text style={styles.inputIcon}>🔎</Text>
            <TextInput
              ref={destInputRef}
              style={styles.input}
              placeholder="Search destination (building)…"
              placeholderTextColor={Colors.textSecondary}
              value={destQuery}
              onFocus={() => {
                if (!isOpen) toggleDrawer();
                setShowDestResults(true);
                setShowOriginResults(false);
              }}
              onChangeText={setDestQuery}
              onSubmitEditing={() => {
                if (destResults.length > 0) {
                  handleDestSelect(destResults[0]);
                }
              }}
              returnKeyType="search"
            />
          </View>

          {/* Destination Results Dropdown */}
          {showDestResults && destResults.length > 0 && (
            <View style={styles.dropdown}>
              {destResults.map((item) => (
                <TouchableOpacity
                  key={String(item.id)}
                  style={styles.dropdownItem}
                  onPress={() => handleDestSelect(item)}
                >
                  <Text style={styles.dropdownName}>{item.name}</Text>
                  <Text style={styles.dropdownSub}>
                    {isFinite(item._dist) ? formatDistance(item._dist) : ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* ROUTE RESULTS SECTION */}
        {(routeResult || calculatingRoute) && (
          <View style={styles.resultsSection}>
            {calculatingRoute ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.loadingText}>Calculating best route...</Text>
              </View>
            ) : routeResult?.error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorTitle}>Route Error</Text>
                <Text style={styles.errorText}>{routeResult.error}</Text>
                {routeResult.errorDetails && (
                  <Text style={styles.errorText}>Details: {routeResult.errorDetails}</Text>
                )}
              </View>
            ) : routeResult ? (
              <View style={styles.routeContainer}>
                <Text style={styles.routeTitle}>🚌 Best Route</Text>
                
                {routeResult.route && (
  <View style={styles.routeHeader}>
    <Text style={styles.busNumber}>
      Bus #{routeResult.trip?.busId || 'Unknown'}
    </Text>
    <Text 
      style={[
        styles.routeBadge, 
        { backgroundColor: routeResult.route.routeColor || Colors.primary }
      ]}
    >
      Route {routeResult.route.routeShortName || routeResult.route.id || 'Unknown'}
    </Text>
  </View>
)}

                {routeResult.trip ? (
                  <>
                    <View style={styles.routeStops}>
                      <Text style={styles.stopText}>🚏 Board at: {routeResult.trip?.fromStop || 'Unknown stop'}</Text>
                      <Text style={styles.arrowText}>↓</Text>
                      <Text style={styles.stopText}>🛑 Get off at: {routeResult.trip?.toStop || 'Unknown stop'}</Text>
                    </View>

                    <View style={styles.timeBreakdown}>
                      <TimeRow 
                        icon="🚶" 
                        label="Walk to bus stop" 
                        time={formatTime(routeResult.trip?.walkToStopTime || 0)} 
                      />
                      <TimeRow 
                        icon="⏱️" 
                        label="Wait for bus" 
                        time={formatTime(routeResult.trip?.waitTime || 0)} 
                        delayed={routeResult.trip?.waitTime > 15}
                      />
                      <TimeRow 
                        icon="🚌" 
                        label="Bus ride" 
                        time={formatTime(routeResult.trip?.busTime || 0)} 
                      />
                      <TimeRow 
                        icon="🚶" 
                        label="Walk to destination" 
                        time={formatTime(routeResult.trip?.walkFromStopTime || 0)} 
                      />
                    </View>

                    <View style={styles.totalTime}>
                      <Text style={styles.totalLabel}>Total Trip Time</Text>
                      <Text style={styles.totalValue}>{formatTime(routeResult.trip?.totalTime)}</Text>

                      <Text style={styles.totalLabel}>ETA</Text>
                      <Text style={styles.totalValue}>{routeResult.trip?.ETA}</Text>
                    </View>
                  </>
                ) : (
                  <View style={styles.fallbackContainer}>
                    <Text style={styles.fallbackText}>No bus routes found!</Text>
                    <Text style={styles.fallbackSubtext}>
                      Error calculating route: {routeResult.reason}
                    </Text>
                  </View>
                )}
                {routeResult.directWalkTime && (
                      <Text style={styles.walkComparison}>
                        💡 Walking directly: {formatTime(routeResult.directWalkTime)}
                      </Text>
                    )}
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  drawer: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Layout.borderRadius,
    borderTopRightRadius: Layout.borderRadius,
    ...Layout.shadow,
    zIndex: 200,
    elevation: 20,
    overflow: 'hidden',
  },
  header: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  headerTitle: {
    fontFamily: Typography.fontFamily,
    ...Typography.h2,
    color: Colors.surface,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  section: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
  },
  originRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: Layout.borderRadius,
    paddingHorizontal: Spacing.md,
    minHeight: 48,
  },
  originIcon: { fontSize: 18, marginRight: Spacing.sm, color: Colors.surface },
  originInput: {
    fontFamily: Typography.fontFamily,
    ...Typography.body,
    color: Colors.surface,
    flex: 1,
    height: 48,
    outlineStyle: 'none',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Layout.borderRadius,
    paddingHorizontal: Spacing.md,
    minHeight: 48,
  },
  inputIcon: { fontSize: 18, marginRight: Spacing.sm, color: Colors.primary },
  input: {
    fontFamily: Typography.fontFamily,
    ...Typography.body,
    ...Typography.textPrimary,
    flex: 1,
    height: 48,
    outlineStyle: 'none',
  },
  dropdown: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Layout.borderRadius,
    marginTop: Spacing.xs,
    maxHeight: 200,
    ...Layout.shadow,
  },
  dropdownItem: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  dropdownName: {
    fontFamily: Typography.fontFamily,
    ...Typography.body,
    color: Colors.textPrimary,
    fontSize: 16,
  },
  dropdownSub: {
    fontFamily: Typography.fontFamily,
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  resultsSection: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xl,
    paddingBottom: 100,
  },
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
  errorContainer: {
    backgroundColor: '#FFE5E5',
    padding: Spacing.md,
    borderRadius: Layout.borderRadius,
    borderWidth: 1,
    borderColor: '#FFCCCC',
  },
  errorTitle: {
    fontFamily: Typography.fontFamily,
    fontSize: 18,
    fontWeight: '600',
    color: Colors.error,
    marginBottom: Spacing.xs,
  },
  errorText: {
    fontFamily: Typography.fontFamily,
    ...Typography.body,
    color: Colors.error,
  },
  routeContainer: {
    backgroundColor: Colors.surface,
    borderRadius: Layout.borderRadius,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    ...Layout.shadow,
  },
  routeTitle: {
    fontFamily: Typography.fontFamily,
    fontSize: 20,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: Spacing.md,
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
  stopText: {
    fontFamily: Typography.fontFamily,
    fontSize: 15,
    color: Colors.textPrimary,
    marginVertical: Spacing.xs,
  },
  arrowText: {
    fontSize: 20,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginVertical: Spacing.xs,
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
  timeIcon: {
    fontSize: 18,
    marginRight: Spacing.sm,
    width: 24,
  },
  timeLabel: {
    flex: 1,
    fontFamily: Typography.fontFamily,
    fontSize: 14,
    color: Colors.textSecondary,
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
  totalTime: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    padding: Spacing.md,
    borderRadius: Layout.borderRadius,
    marginTop: Spacing.md,
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
  walkComparison: {
    fontFamily: Typography.fontFamily,
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.md,
    fontStyle: 'italic',
  },
  fallbackContainer: {
    backgroundColor: Colors.background,
    padding: Spacing.md,
    borderRadius: Layout.borderRadius,
    marginTop: Spacing.md,
  },
  fallbackText: {
    fontFamily: Typography.fontFamily,
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  fallbackSubtext: {
    fontFamily: Typography.fontFamily,
    fontSize: 12,
    color: Colors.textSecondary,
    maxHeight: 100,
  },
});