import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { Marker } from "react-native-maps";
import { typography, useTheme, ThemeColors } from "@/theme";
import { Temple } from "@/hooks/useNearbyTemples";

// ─────────────────────────────────────────────
// SHARED THEME-AWARE STYLES
// ─────────────────────────────────────────────
function useMarkerStyles() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return { colors, styles };
}

interface TempleMarkerProps {
  temple: Temple;
  index: number;
  onPress: (temple: Temple) => void;
}

export function TempleMarker({ temple, index, onPress }: TempleMarkerProps) {
  const { styles } = useMarkerStyles();
  const scale = useRef(new Animated.Value(0.5)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const delay = Math.min(index * 40, 400);
    Animated.parallel([
      Animated.timing(scale, {
        toValue: 1,
        duration: 350,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [index, opacity, scale]);

  return (
    <Marker
      coordinate={{ latitude: temple.latitude, longitude: temple.longitude }}
      onPress={() => onPress(temple)}
      tracksViewChanges={false}
    >
      <Animated.View
        style={[
          styles.markerWrap,
          {
            transform: [{ scale }],
            opacity,
          },
        ]}
      >
        <View style={styles.markerPin} />
        <Text style={styles.markerText}>Temple</Text>
      </Animated.View>
    </Marker>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
  markerWrap: {
    alignItems: "center",
  },
  markerPin: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 3,
    borderColor: colors.gold,
    backgroundColor: colors.primary,
  },
  markerText: {
    marginTop: 2,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    backgroundColor: colors.bgSecondary + "DD",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: "hidden",
  },
  });
}
