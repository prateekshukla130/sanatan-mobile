/**
 * app/(tabs)/_layout.tsx
 *
 * Shared header with HamburgerButton on the LEFT, app title centred,
 * and a language-picker button on the RIGHT. The header is rendered
 * once for all tabs — no per-screen setup needed.
 *
 * Header height accounts for the status bar so nothing overlaps.
 */

import { Tabs } from "expo-router";
import React, { useMemo, useState } from "react";
import { Platform, Text, View, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, ThemeColors } from "@/theme";
import { useLanguage } from "@/localization";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HamburgerButton } from "@/components/SideBar";
import { LanguagePickerModal } from "@/components/LanguagePickerModal";

// ─────────────────────────────────────────────
// SHARED HEADER
// ─────────────────────────────────────────────
export function AppHeader() {
  const insets = useSafeAreaInsets();
  const { colors, spacing, typography } = useTheme();
  const { t } = useLanguage();
  const [langPickerOpen, setLangPickerOpen] = useState(false);
  const hdr = useMemo(() => makeHeaderStyles(colors, spacing, typography), [
    colors,
    spacing,
    typography,
  ]);

  return (
    <View style={[hdr.wrap, { paddingTop: insets.top }]}>
      <View style={hdr.inner}>
        {/* LEFT — hamburger */}
        <View style={hdr.left}>
          <HamburgerButton />
        </View>

        {/* CENTER — title */}
        <View style={hdr.center}>
          <Text style={hdr.title} numberOfLines={1}>
            Sanatan Dharma
          </Text>
          <Text style={hdr.subtitle}>{t("header.tagline")}</Text>
        </View>

        {/* RIGHT — language picker */}
        <View style={hdr.right}>
          <TouchableOpacity
            style={hdr.langBtn}
            onPress={() => setLangPickerOpen(true)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="language-outline" size={20} color={colors.gold} />
          </TouchableOpacity>
        </View>
      </View>

      <LanguagePickerModal
        visible={langPickerOpen}
        onClose={() => setLangPickerOpen(false)}
      />
    </View>
  );
}

function makeHeaderStyles(
  colors: ThemeColors,
  spacing: Record<string, number>,
  typography: any,
) {
  return StyleSheet.create({
    wrap: {
      backgroundColor: colors.bgSecondary,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
    },
    inner: {
      height: 52,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.xs,
    },
    left: { width: 56, alignItems: "flex-start" },
    center: { flex: 1, alignItems: "center" },
    right: { width: 56, alignItems: "flex-end" },
    langBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      marginRight: spacing.xs,
    },
    title: {
      fontSize: typography.fontSize.lg,
      fontWeight: typography.fontWeight.bold,
      color: colors.gold,
      letterSpacing: 0.3,
    },
    subtitle: {
      fontSize: 10,
      color: colors.gold + "88",
      letterSpacing: 0.5,
      marginTop: 1,
    },
  });
}

// ─────────────────────────────────────────────
// TAB LAYOUT
// ─────────────────────────────────────────────
export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { colors, typography } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.bgSecondary,
          borderTopColor: colors.cardBorder,
          borderTopWidth: 1,
          height: Platform.OS === "ios" ? 72 : 58 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: typography.fontSize.xs,
          fontWeight: typography.fontWeight.medium,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="jap"
        options={{
          title: "Jap",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="infinite" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="bhajan"
        options={{
          title: "Bhajan",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="musical-notes" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="scriptures"
        options={{
          title: "Scriptures",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="book" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: "Calendar",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="ai"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="kundli"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="shop"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="temples"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
