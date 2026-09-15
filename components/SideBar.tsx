/**
 * SideBar.tsx  — v2 (Modal-based, always on top)
 *
 * Root cause of "sidebar not visible":
 *   The previous version rendered the drawer as a sibling View inside
 *   SidebarProvider. Expo Router's Stack/Tabs creates its own stacking
 *   context, so the drawer was hidden behind the tab navigator.
 *
 * Fix: wrap the overlay + drawer in a <Modal transparent> so it floats
 *   above every screen, tab bar, and status bar — guaranteed.
 *
 * Exports:
 *   SidebarProvider   — already in your _layout.tsx ✅
 *   useSidebar        — { open, close, isOpen }
 *   HamburgerButton   — drop into any header
 */

import React, {
  createContext,
  useContext,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
  ScrollView,
  PanResponder,
  Modal,
  TouchableWithoutFeedback,
} from "react-native";
import { Ionicons, FontAwesome6 } from "@expo/vector-icons";
import { useRouter, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, ThemeColors } from "@/theme";
import { useLanguage, LANGUAGES } from "@/localization";
import en from "@/localization/translations/en";
import { LanguagePickerModal } from "@/components/LanguagePickerModal";

const { width: SW, height: SH } = Dimensions.get("window");
const DRAWER_WIDTH = Math.min(SW * 0.8, 320);

// ─────────────────────────────────────────────
// CONTEXT
// ─────────────────────────────────────────────
interface SidebarCtx {
  open: () => void;
  close: () => void;
  isOpen: boolean;
}

const SidebarContext = createContext<SidebarCtx>({
  open: () => {},
  close: () => {},
  isOpen: false,
});

export const useSidebar = () => useContext(SidebarContext);

// ─────────────────────────────────────────────
// NAV ITEMS — mirrors your exact tab files
// ─────────────────────────────────────────────
interface NavItem {
  navKey: keyof typeof en.nav;
  href: string;
  emoji: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
  isFA6?: boolean;
  fa6Icon?: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    navKey: "home",
    href: "/(tabs)/",
    emoji: "🏠",
    icon: "home-outline",
    iconActive: "home",
  },
  {
    navKey: "temples",
    href: "/temples",
    emoji: "🛕",
    icon: "location-outline",
    iconActive: "location",
    isFA6: true,
    fa6Icon: "place-of-worship",
  },
  {
    navKey: "kundli",
    href: "/(tabs)/kundli",
    emoji: "🔯",
    icon: "planet-outline",
    iconActive: "planet",
  },
  {
    navKey: "shop",
    href: "/shop",
    emoji: "🛍️",
    icon: "storefront-outline",
    iconActive: "storefront",
  },
  {
    navKey: "ai",
    href: "/(tabs)/ai",
    emoji: "🕉️",
    icon: "chatbubble-ellipses-outline",
    iconActive: "chatbubble-ellipses",
  },
  {
    navKey: "scriptures",
    href: "/(tabs)/scriptures",
    emoji: "📖",
    icon: "book-outline",
    iconActive: "book",
  },
  {
    navKey: "calendar",
    href: "/(tabs)/calendar",
    emoji: "📅",
    icon: "calendar-outline",
    iconActive: "calendar",
  },
  {
    navKey: "bhajan",
    href: "/(tabs)/bhajan",
    emoji: "🎵",
    icon: "musical-notes-outline",
    iconActive: "musical-notes",
  },
  {
    navKey: "settings",
    href: "/settings",
    emoji: "⚙️",
    icon: "settings-outline",
    iconActive: "settings",
  },
];

const QUICK_ACTIONS: NavItem[] = [
  {
    navKey: "jap",
    href: "/(tabs)/jap",
    emoji: "📿",
    icon: "infinite-outline",
    iconActive: "infinite",
  },
  {
    navKey: "chalisa",
    href: "/(tabs)/scriptures",
    emoji: "📖",
    icon: "book-outline",
    iconActive: "book",
  },
];

// ─────────────────────────────────────────────
// DRAWER CONTENT
// ─────────────────────────────────────────────
const DrawerContent: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { colors, spacing, typography } = useTheme();
  const { t, language } = useLanguage();
  const [langPickerOpen, setLangPickerOpen] = useState(false);
  const dr = useMemo(() => makeDrawerStyles(colors, spacing, typography), [
    colors,
    spacing,
    typography,
  ]);

  const navigate = useCallback(
    (href: string) => {
      onClose();
      setTimeout(() => router.push(href as any), 230);
    },
    [router, onClose],
  );

  const isActive = (href: string) => {
    const seg = href.split("/").pop() ?? "";
    if (seg === "" || seg === "(tabs)") return pathname === "/";
    return pathname === `/${seg}` || pathname.endsWith(`/${seg}`);
  };

  return (
    <View style={[dr.wrap, { paddingTop: insets.top + 12 }]}>
      {/* ── Header ── */}
      <View style={dr.header}>
        <View style={dr.omCircle}>
          <Text style={dr.omText}>ॐ</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={dr.appName}>Sanatan Dharma</Text>
          <Text style={dr.appSub}>सनातन धर्म · {t("header.tagline")}</Text>
        </View>
        <TouchableOpacity
          style={dr.closeBtn}
          onPress={onClose}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="close" size={20} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* ── Language quick-switch ── */}
      <TouchableOpacity
        style={dr.langRow}
        onPress={() => setLangPickerOpen(true)}
        activeOpacity={0.75}
      >
        <Ionicons name="language-outline" size={16} color={colors.gold} />
        <Text style={dr.langRowTxt}>
          {LANGUAGES.find((l) => l.code === language)?.nativeName}
        </Text>
        <Ionicons name="chevron-forward" size={14} color={colors.gold} />
      </TouchableOpacity>

      <View style={dr.divider} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      >
        {/* ── Navigation ── */}
        <Text style={dr.sectionLabel}>{t("nav.menu").toUpperCase()}</Text>

        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href);
          return (
            <TouchableOpacity
              key={item.href}
              style={[dr.navRow, active && dr.navRowActive]}
              onPress={() => navigate(item.href)}
              activeOpacity={0.72}
            >
              <View style={[dr.iconBox, active && dr.iconBoxActive]}>
                {item.isFA6 ? (
                  <FontAwesome6
                    name={item.fa6Icon as any}
                    size={16}
                    color={active ? colors.bgSecondary : colors.textMuted}
                  />
                ) : (
                  <Ionicons
                    name={active ? item.iconActive : item.icon}
                    size={18}
                    color={active ? colors.bgSecondary : colors.textMuted}
                  />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[dr.labelEn, active && dr.labelEnActive]}>
                  {t(`nav.${item.navKey}`)}
                </Text>
                {language !== "en" && (
                  <Text style={[dr.labelHi, active && dr.labelHiActive]}>
                    {en.nav[item.navKey]}
                  </Text>
                )}
              </View>
              {active && <View style={dr.pip} />}
            </TouchableOpacity>
          );
        })}

        <View style={dr.divider} />

        {/* ── Quick Actions ── */}
        <Text style={dr.sectionLabel}>{t("nav.quickAccess").toUpperCase()}</Text>
        <View style={dr.quickGrid}>
          {QUICK_ACTIONS.map((item) => (
            <TouchableOpacity
              key={item.href + item.navKey}
              style={dr.quickCard}
              onPress={() => navigate(item.href)}
              activeOpacity={0.75}
            >
              <Text style={dr.quickEmoji}>{item.emoji}</Text>
              <Text style={dr.quickEn}>{t(`nav.${item.navKey}`)}</Text>
              {language !== "en" && (
                <Text style={dr.quickHi}>{en.nav[item.navKey]}</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>

        <View style={dr.divider} />

        <View style={dr.footerBox}>
          <Text style={dr.footerMantra}>॥ सर्वे भवन्तु सुखिनः ॥</Text>
          <Text style={dr.footerSub}>May all beings be happy</Text>
        </View>
      </ScrollView>

      <LanguagePickerModal
        visible={langPickerOpen}
        onClose={() => setLangPickerOpen(false)}
      />
    </View>
  );
};

// ─────────────────────────────────────────────
// PROVIDER
// ─────────────────────────────────────────────
export const SidebarProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [modalMounted, setModalMounted] = useState(false);

  const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  const open = useCallback(() => {
    // Mount modal first, then animate in
    setModalMounted(true);
    setIsOpen(true);
    translateX.setValue(-DRAWER_WIDTH);
    overlayOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
        damping: 22,
        stiffness: 220,
        mass: 0.85,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [translateX, overlayOpacity]);

  const close = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: -DRAWER_WIDTH,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsOpen(false);
      setModalMounted(false);
    });
  }, [translateX, overlayOpacity]);

  // Swipe left to close
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dx < -8 && Math.abs(g.dy) < 50,
      onPanResponderMove: (_, g) => {
        const val = Math.min(0, g.dx);
        translateX.setValue(val);
        overlayOpacity.setValue(Math.max(0, 1 + val / DRAWER_WIDTH));
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx < -55 || g.vx < -0.5) {
          close();
        } else {
          Animated.parallel([
            Animated.spring(translateX, {
              toValue: 0,
              useNativeDriver: true,
              damping: 20,
              stiffness: 200,
            }),
            Animated.timing(overlayOpacity, {
              toValue: 1,
              duration: 120,
              useNativeDriver: true,
            }),
          ]).start();
        }
      },
    }),
  ).current;

  return (
    <SidebarContext.Provider value={{ open, close, isOpen }}>
      {children}

      {/* ── Modal floats above EVERYTHING — tab bar, stack, etc ── */}
      <Modal
        visible={modalMounted}
        transparent
        animationType="none" // we drive our own animation
        statusBarTranslucent // covers status bar on Android
        onRequestClose={close} // Android back button
      >
        {/* Full-screen container */}
        <View style={st.modalRoot}>
          {/* Dim overlay */}
          <Animated.View
            style={[st.overlay, { opacity: overlayOpacity }]}
            pointerEvents="auto"
          >
            <TouchableWithoutFeedback onPress={close}>
              <View style={StyleSheet.absoluteFill} />
            </TouchableWithoutFeedback>
          </Animated.View>

          {/* Drawer panel — slides in from left */}
          <Animated.View
            style={[st.drawerWrap, { transform: [{ translateX }] }]}
            {...panResponder.panHandlers}
          >
            <DrawerContent onClose={close} />
          </Animated.View>
        </View>
      </Modal>
    </SidebarContext.Provider>
  );
};

// ─────────────────────────────────────────────
// HAMBURGER BUTTON
// ─────────────────────────────────────────────
export const HamburgerButton: React.FC<{ color?: string }> = ({ color }) => {
  const { open } = useSidebar();
  const { colors } = useTheme();
  const barColor = color ?? colors.gold;
  return (
    <TouchableOpacity
      style={st.hamburger}
      onPress={open}
      activeOpacity={0.65}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
    >
      <View style={[st.hamBar, { width: 22, backgroundColor: barColor }]} />
      <View style={[st.hamBar, { width: 14, backgroundColor: barColor }]} />
      <View style={[st.hamBar, { width: 18, backgroundColor: barColor }]} />
    </TouchableOpacity>
  );
};

// ─────────────────────────────────────────────
// STYLES — DRAWER (theme-dependent, built per render)
// ─────────────────────────────────────────────
function makeDrawerStyles(
  colors: ThemeColors,
  spacing: Record<string, number>,
  typography: any,
) {
  return StyleSheet.create({
    wrap: {
      flex: 1,
      backgroundColor: colors.bgSecondary,
      borderRightWidth: 1,
      borderRightColor: colors.gold + "20",
    },

    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.md,
      gap: 12,
    },
    omCircle: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: colors.gold + "1A",
      borderWidth: 1.5,
      borderColor: colors.gold + "55",
      alignItems: "center",
      justifyContent: "center",
    },
    omText: { fontSize: 22, color: colors.gold },
    appName: {
      fontSize: typography.fontSize.md,
      fontWeight: typography.fontWeight.bold,
      color: colors.textPrimary,
      letterSpacing: 0.3,
    },
    appSub: { fontSize: 10, color: colors.gold + "99", marginTop: 1 },
    closeBtn: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: colors.textMuted + "18",
      alignItems: "center",
      justifyContent: "center",
    },

    langRow: {
      flexDirection: "row",
      alignItems: "center",
      marginHorizontal: spacing.md,
      marginBottom: spacing.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.gold + "30",
      backgroundColor: colors.gold + "0F",
      gap: 8,
    },
    langRowTxt: {
      flex: 1,
      fontSize: 12,
      fontWeight: "600",
      color: colors.textPrimary,
    },

    divider: {
      height: 1,
      backgroundColor: colors.divider,
      marginHorizontal: spacing.md,
      marginVertical: spacing.sm,
    },
    sectionLabel: {
      fontSize: 9,
      fontWeight: "800",
      color: colors.gold + "80",
      letterSpacing: 1.4,
      marginHorizontal: spacing.md,
      marginBottom: 6,
      marginTop: 2,
    },

    navRow: {
      flexDirection: "row",
      alignItems: "center",
      marginHorizontal: spacing.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: 9,
      borderRadius: 10,
      gap: 10,
      marginBottom: 2,
    },
    navRowActive: { backgroundColor: colors.gold },

    iconBox: {
      width: 34,
      height: 34,
      borderRadius: 9,
      backgroundColor: colors.cardBg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      alignItems: "center",
      justifyContent: "center",
    },
    iconBoxActive: {
      backgroundColor: "rgba(255,255,255,0.22)",
      borderColor: "rgba(255,255,255,0.28)",
    },

    labelEn: {
      fontSize: typography.fontSize.sm,
      fontWeight: "600",
      color: colors.textPrimary,
    },
    labelEnActive: { color: colors.bgSecondary, fontWeight: "700" },
    labelHi: { fontSize: 10, color: colors.textMuted, marginTop: 1 },
    labelHiActive: { color: colors.bgSecondary + "BB" },

    pip: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.bgSecondary,
      marginRight: 2,
    },

    quickGrid: {
      flexDirection: "row",
      paddingHorizontal: spacing.sm,
      gap: 8,
      marginBottom: 4,
    },
    quickCard: {
      flex: 1,
      backgroundColor: colors.cardBg,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.gold + "28",
      paddingVertical: spacing.md,
      alignItems: "center",
      gap: 4,
    },
    quickEmoji: { fontSize: 24 },
    quickEn: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.textPrimary,
      textAlign: "center",
    },
    quickHi: { fontSize: 9, color: colors.gold + "BB", textAlign: "center" },

    footerBox: { alignItems: "center", paddingVertical: spacing.lg, gap: 3 },
    footerMantra: { fontSize: 13, color: colors.gold + "CC" },
    footerSub: { fontSize: 10, color: colors.textMuted },
  });
}

// ─────────────────────────────────────────────
// STYLES — MODAL SHELL
// ─────────────────────────────────────────────
const st = StyleSheet.create({
  // Full-screen transparent container inside Modal
  modalRoot: {
    flex: 1,
    // No background here — overlay handles it
  },

  // Dark overlay behind drawer
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.62)",
  },

  // Drawer panel — fixed left edge, full height
  drawerWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    width: DRAWER_WIDTH,
    height: SH,
    // Shadow
    shadowColor: "#000",
    shadowOffset: { width: 8, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 30,
  },

  // Hamburger
  hamburger: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 5,
    justifyContent: "center",
  },
  hamBar: { height: 2.5, borderRadius: 1.5 },
});
