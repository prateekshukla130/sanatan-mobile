import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { MapType, PROVIDER_GOOGLE, Region } from "react-native-maps";
import ClusteredMapView from "react-native-map-clustering";
import { BottomSheetModal, BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { LinearGradient } from "expo-linear-gradient";
import { spacing, typography, useTheme, ThemeColors } from "@/theme";
import { useLocation } from "@/hooks/useLocation";
import { Temple, useNearbyTemples } from "@/hooks/useNearbyTemples";
import { TempleMarker } from "@/components/temples/TempleMarker";
import {
  TempleDetailsBottomSheet,
  openDialer,
} from "@/components/temples/TempleDetailsBottomSheet";
import { TempleSearchBar } from "@/components/temples/TempleSearchBar";

const INITIAL_DELTA = {
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

// ─────────────────────────────────────────────
// SHARED THEME-AWARE STYLES
// ─────────────────────────────────────────────
function useTempleMapStyles() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return { colors, styles };
}

export function TempleMapScreen() {
  const { colors, styles } = useTempleMapStyles();
  const scheme = useColorScheme();
  const mapRef = useRef<any>(null);
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const [selectedTemple, setSelectedTemple] = useState<Temple | null>(null);
  const [mapType, setMapType] = useState<MapType>("standard");

  const {
    location,
    permission,
    loading: locationLoading,
    error: locationError,
    requestPermissionAndLocate,
    refreshLocation,
    openSettings,
  } = useLocation();

  const {
    filteredTemples,
    suggestions,
    loading,
    refreshing,
    suggestionsLoading,
    error,
    query,
    filters,
    setDistanceFilter,
    setMinRatingFilter,
    setOpenNowOnly,
    refreshTemples,
    searchTemples,
    applySuggestion,
    clearSuggestions,
    ensureTemplePhone,
  } = useNearbyTemples(location);

  const region: Region | undefined = useMemo(() => {
    if (!location) return undefined;
    return {
      latitude: location.latitude,
      longitude: location.longitude,
      ...INITIAL_DELTA,
    };
  }, [location]);

  const handleClusterMapRef = useCallback((map: any) => {
    mapRef.current = map;
  }, []);

  const handleRegionChangeComplete = useCallback(() => {}, []);
  const handleClusterPress = useCallback(() => {}, []);
  const handleMarkersChange = useCallback(() => {}, []);

  const recenterMap = useCallback(async () => {
    await refreshLocation();
    if (location && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: location.latitude,
          longitude: location.longitude,
          ...INITIAL_DELTA,
        },
        500,
      );
    }
  }, [location, refreshLocation]);

  const onMarkerPress = useCallback(
    async (temple: Temple) => {
      const phone = await ensureTemplePhone(temple.id);
      setSelectedTemple({ ...temple, phoneNumber: phone ?? temple.phoneNumber });
      bottomSheetRef.current?.present();
    },
    [ensureTemplePhone],
  );

  const handleDirections = useCallback(async (temple: Temple) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${temple.latitude},${temple.longitude}&travelmode=driving`;
    await Linking.openURL(url);
  }, []);

  const handleCall = useCallback(
    async (temple: Temple) => {
      if (!temple.phoneNumber) {
        const phone = await ensureTemplePhone(temple.id);
        await openDialer(phone);
        return;
      }
      await openDialer(temple.phoneNumber);
    },
    [ensureTemplePhone],
  );

  if (permission === "denied") {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Location access required</Text>
        <Text style={styles.errorText}>
          Enable location permission to discover nearby temples on the map.
        </Text>
        <View style={styles.permissionActions}>
          <Pressable style={styles.primaryAction} onPress={requestPermissionAndLocate}>
            <Text style={styles.primaryActionText}>Retry Permission</Text>
          </Pressable>
          <Pressable style={styles.secondaryAction} onPress={openSettings}>
            <Text style={styles.secondaryActionText}>Open Settings</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if ((locationLoading && !location) || !region) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.gold} />
        <Text style={styles.loadingText}>Fetching your location...</Text>
      </View>
    );
  }

  return (
    <BottomSheetModalProvider>
      <View
        style={[
          styles.container,
          scheme === "dark" ? styles.darkContainer : styles.lightContainer,
        ]}
      >
        <LinearGradient
          colors={[colors.bgPrimary, colors.bgSecondary, colors.bgPrimary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.topGlow} />

        <TempleSearchBar
          value={query}
          suggestions={suggestions}
          loading={suggestionsLoading}
          onChangeText={searchTemples}
          onSuggestionPress={applySuggestion}
          onClearSuggestions={clearSuggestions}
        />

        <View style={styles.filtersRow}>
          <FilterChip
            label="1 km"
            active={filters.distanceKm === 1}
            onPress={() => setDistanceFilter(1)}
          />
          <FilterChip
            label="5 km"
            active={filters.distanceKm === 5}
            onPress={() => setDistanceFilter(5)}
          />
          <FilterChip
            label="10 km"
            active={filters.distanceKm === 10}
            onPress={() => setDistanceFilter(10)}
          />
          <FilterChip
            label="4+ Stars"
            active={filters.minRating === 4}
            onPress={() => setMinRatingFilter(filters.minRating === 4 ? 0 : 4)}
          />
          <FilterChip
            label="Open Now"
            active={filters.openNowOnly}
            onPress={() => setOpenNowOnly(!filters.openNowOnly)}
          />
        </View>

        <View style={styles.mapWrap}>
          <ClusteredMapView
            ref={mapRef}
            mapRef={handleClusterMapRef}
            onRegionChangeComplete={handleRegionChangeComplete}
            onClusterPress={handleClusterPress}
            onMarkersChange={handleMarkersChange}
            provider={PROVIDER_GOOGLE}
            style={StyleSheet.absoluteFill}
            initialRegion={region}
            mapType={mapType}
            clusterColor={colors.primary}
            clusterTextColor={colors.textPrimary}
            animationEnabled
            radius={45}
            showsUserLocation
            showsMyLocationButton={false}
            loadingEnabled
          >
            {filteredTemples.map((temple, index) => (
              <TempleMarker
                key={temple.id}
                temple={temple}
                index={index}
                onPress={onMarkerPress}
              />
            ))}
          </ClusteredMapView>

          <LinearGradient
            pointerEvents="none"
            colors={["#00000059", "transparent", "#00000059"]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.mapOverlay}
          />

          <View style={styles.fabContainer}>
            <FabButton icon="locate" onPress={recenterMap} label="Recenter" />
            <FabButton
              icon={mapType === "standard" ? "map" : "earth"}
              onPress={() =>
                setMapType((prev) => (prev === "standard" ? "satellite" : "standard"))
              }
              label="Map Type"
            />
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="small" color={colors.gold} />
            <Text style={styles.loadingOverlayText}>Loading nearby temples...</Text>
          </View>
        ) : null}

        {!!error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{error}</Text>
            <Pressable onPress={() => refreshTemples()}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        )}

        {!!locationError && !error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{locationError}</Text>
          </View>
        )}

        <FlatList
          data={filteredTemples}
          keyExtractor={(item) => item.id}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refreshTemples}
              tintColor={colors.gold}
              colors={[colors.gold]}
            />
          }
          renderItem={({ item }) => <TempleListItem item={item} onPress={onMarkerPress} />}
          ListEmptyComponent={
            <Text style={styles.emptyListText}>No temples found for current filters.</Text>
          }
        />

        <TempleDetailsBottomSheet
          ref={bottomSheetRef}
          temple={selectedTemple}
          onGetDirections={handleDirections}
          onCallTemple={handleCall}
        />
      </View>
    </BottomSheetModalProvider>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { styles } = useTempleMapStyles();
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () => {
    Animated.spring(scale, {
      toValue: 0.95,
      useNativeDriver: true,
      friction: 6,
      tension: 140,
    }).start();
  };

  const pressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      friction: 6,
      tension: 120,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        style={[styles.filterChip, active && styles.filterChipActive]}
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
      >
        <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

function FabButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const { colors, styles } = useTempleMapStyles();
  const scale = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0.65)).current;

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0.65,
          duration: 1600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [glow]);

  const pressIn = () => {
    Animated.spring(scale, {
      toValue: 0.9,
      useNativeDriver: true,
      friction: 6,
      tension: 140,
    }).start();
  };

  const pressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      friction: 6,
      tension: 120,
    }).start();
  };

  return (
    <Animated.View
      style={[
        styles.fabWrap,
        {
          opacity: glow,
          transform: [{ scale }],
        },
      ]}
    >
      <Pressable
        accessibilityLabel={label}
        style={styles.fab}
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
      >
        <Ionicons name={icon} size={18} color={colors.textPrimary} />
      </Pressable>
    </Animated.View>
  );
}

function TempleListItem({
  item,
  onPress,
}: {
  item: Temple;
  onPress: (temple: Temple) => void;
}) {
  const { styles } = useTempleMapStyles();
  const rise = useRef(new Animated.Value(8)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(rise, {
        toValue: 0,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(fade, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [fade, rise]);

  const pressIn = () => {
    Animated.spring(scale, {
      toValue: 0.98,
      useNativeDriver: true,
      friction: 7,
      tension: 130,
    }).start();
  };

  const pressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      friction: 7,
      tension: 110,
    }).start();
  };

  return (
    <Animated.View style={{ opacity: fade, transform: [{ translateY: rise }, { scale }] }}>
      <Pressable
        style={styles.listItem}
        onPress={() => onPress(item)}
        onPressIn={pressIn}
        onPressOut={pressOut}
      >
        <View style={styles.listItemTop}>
          <Text style={styles.listItemName}>{item.name}</Text>
          <Text style={styles.listItemDistance}>{item.distanceKm.toFixed(1)} km</Text>
        </View>
        <Text style={styles.listItemMeta}>
          {item.rating ? `${item.rating} star` : "No rating"} - {item.openNow === null ? "Status unknown" : item.openNow ? "Open" : "Closed"}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
  container: {
    flex: 1,
  },
  darkContainer: {
    backgroundColor: colors.bgPrimary,
  },
  lightContainer: {
    backgroundColor: "#F2ECE3",
  },
  centered: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  loadingText: {
    marginTop: spacing.sm,
    color: colors.textPrimary,
  },
  errorTitle: {
    color: colors.textPrimary,
    fontWeight: typography.fontWeight.bold,
    fontSize: typography.fontSize.xl,
  },
  errorText: {
    color: colors.textMuted,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  permissionActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  primaryAction: {
    backgroundColor: colors.gold,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 10,
  },
  secondaryAction: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.bgSecondary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 10,
  },
  primaryActionText: {
    color: colors.textInverse,
    fontWeight: typography.fontWeight.bold,
  },
  secondaryActionText: {
    color: colors.textPrimary,
    fontWeight: typography.fontWeight.semibold,
  },
  topGlow: {
    position: "absolute",
    top: -120,
    left: -40,
    right: -40,
    height: 220,
    borderRadius: 999,
    backgroundColor: colors.gold + "1E",
  },
  filtersRow: {
    marginTop: 74,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    zIndex: 10,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    backgroundColor: colors.bgSecondary + "E8",
  },
  filterChipActive: {
    borderColor: colors.gold,
    backgroundColor: colors.gold + "2A",
  },
  filterChipText: {
    color: colors.textMuted,
    fontSize: typography.fontSize.xs,
  },
  filterChipTextActive: {
    color: colors.gold,
    fontWeight: typography.fontWeight.bold,
  },
  mapWrap: {
    flex: 1,
    margin: spacing.md,
    marginTop: spacing.sm,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.cardBorder,
    shadowColor: colors.gold,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  mapOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  fabContainer: {
    position: "absolute",
    right: spacing.sm,
    bottom: spacing.sm,
    gap: spacing.xs,
  },
  fabWrap: {
    borderRadius: 21,
    shadowColor: colors.gold,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  fab: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.bgSecondary + "F0",
    borderColor: colors.cardBorder,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingOverlay: {
    position: "absolute",
    top: 150,
    alignSelf: "center",
    backgroundColor: colors.bgSecondary + "EA",
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    zIndex: 30,
  },
  loadingOverlayText: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.xs,
  },
  errorBanner: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.xs,
    padding: spacing.sm,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.error + "88",
    backgroundColor: colors.error + "22",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
  },
  errorBannerText: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: typography.fontSize.xs,
  },
  retryText: {
    color: colors.gold,
    fontWeight: typography.fontWeight.bold,
  },
  list: {
    maxHeight: 180,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    backgroundColor: colors.bgSecondary + "F2",
  },
  listContent: {
    paddingBottom: spacing.md,
  },
  listItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    backgroundColor: colors.bgSecondary + "80",
  },
  listItemTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
  },
  listItemName: {
    flex: 1,
    color: colors.textPrimary,
    fontWeight: typography.fontWeight.semibold,
    fontSize: typography.fontSize.sm,
  },
  listItemDistance: {
    color: colors.gold,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  listItemMeta: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: typography.fontSize.xs,
  },
  emptyListText: {
    color: colors.textMuted,
    textAlign: "center",
    padding: spacing.md,
  },
  });
}
