import React, { forwardRef, useMemo } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import { spacing, typography, useTheme, ThemeColors } from "@/theme";
import { Temple } from "@/hooks/useNearbyTemples";

// ─────────────────────────────────────────────
// SHARED THEME-AWARE STYLES
// ─────────────────────────────────────────────
function useDetailsSheetStyles() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return { colors, styles };
}

interface TempleDetailsBottomSheetProps {
  temple: Temple | null;
  onGetDirections: (temple: Temple) => void;
  onCallTemple: (temple: Temple) => void;
}

export const TempleDetailsBottomSheet = forwardRef<
  BottomSheetModal,
  TempleDetailsBottomSheetProps
>(function TempleDetailsBottomSheet(
  { temple, onGetDirections, onCallTemple },
  ref,
) {
  const { styles } = useDetailsSheetStyles();
  const snapPoints = useMemo(() => ["28%", "42%"], []);

  if (!temple) {
    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={snapPoints}
        backgroundStyle={styles.sheetBg}
        handleIndicatorStyle={styles.indicator}
      >
        <BottomSheetView style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Select a temple marker</Text>
        </BottomSheetView>
      </BottomSheetModal>
    );
  }

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={snapPoints}
      backgroundStyle={styles.sheetBg}
      handleIndicatorStyle={styles.indicator}
    >
      <BottomSheetView style={styles.content}>
        <Text style={styles.name}>{temple.name}</Text>
        <Text style={styles.meta}>Rating: {temple.rating ?? "N/A"}</Text>
        <Text style={styles.meta}>Address: {temple.address}</Text>
        <Text style={styles.meta}>
          Status:{" "}
          {temple.openNow === null
            ? "Unknown"
            : temple.openNow
              ? "Open now"
              : "Closed"}
        </Text>
        <Text style={styles.meta}>Distance: {temple.distanceKm.toFixed(2)} km</Text>

        <View style={styles.actions}>
          <Pressable
            style={[styles.button, styles.primaryBtn]}
            onPress={() => onGetDirections(temple)}
          >
            <Text style={styles.primaryBtnText}>Get Directions</Text>
          </Pressable>
          <Pressable
            style={[styles.button, styles.secondaryBtn]}
            onPress={() => onCallTemple(temple)}
            disabled={!temple.phoneNumber}
          >
            <Text style={styles.secondaryBtnText}>
              {temple.phoneNumber ? "Call Temple" : "Phone unavailable"}
            </Text>
          </Pressable>
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
});

export async function openDialer(phoneNumber?: string) {
  if (!phoneNumber) return;
  const sanitized = phoneNumber.replace(/[^\d+]/g, "");
  await Linking.openURL(`tel:${sanitized}`);
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
  sheetBg: {
    backgroundColor: colors.bgSecondary,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  indicator: {
    backgroundColor: colors.gold,
    width: 40,
  },
  emptyContainer: {
    padding: spacing.lg,
    alignItems: "center",
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: typography.fontSize.md,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  name: {
    color: colors.textPrimary,
    fontWeight: typography.fontWeight.bold,
    fontSize: typography.fontSize.xl,
  },
  meta: {
    color: colors.textMuted,
    fontSize: typography.fontSize.sm,
    lineHeight: 20,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  button: {
    flex: 1,
    borderRadius: 10,
    height: 42,
    justifyContent: "center",
    alignItems: "center",
  },
  primaryBtn: {
    backgroundColor: colors.gold,
  },
  secondaryBtn: {
    backgroundColor: colors.bgTertiary,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  primaryBtnText: {
    color: colors.textInverse,
    fontWeight: typography.fontWeight.bold,
  },
  secondaryBtnText: {
    color: colors.textPrimary,
    fontWeight: typography.fontWeight.semibold,
    fontSize: typography.fontSize.sm,
  },
  });
}
