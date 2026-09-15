/**
 * JapScreen.tsx
 *
 * Features:
 *  - Mala bead ring (108 beads, sumeru markers)
 *  - Add / Edit / Delete custom mantras
 *  - Optional haptic vibration (toggle)
 *  - Optional TTS voice recitation via expo-speech (toggle)
 *  - TTS speaks mantra on every tap OR on mala complete (user choice)
 *  - Settings bottom sheet
 *  - Mala complete celebration + milestone badges
 *  - Bilingual Hindi + English throughout
 *
 * Dependencies (add if not present):
 *   expo install expo-speech expo-haptics
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  FlatList,
  TextInput,
  Dimensions,
  Switch,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";
import { GradientBackground } from "../../components/GradientBackground";
import { spacing, typography, theme, useTheme, ThemeColors } from "../../theme";
import { storageService } from "../../services/storageService";
import { journeyService } from "../../services/journeyService";
import { Mantra, mantraService } from "../../services/mantraService";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
} from "react-native-reanimated";

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────
const { width: SW } = Dimensions.get("window");
const RING_SIZE = Math.min(SW - 48, 320);
const RING_R = RING_SIZE / 2;
const BEAD_R = RING_R - 18;
const BEAD_COUNT = 108;

const STORAGE_KEYS = {
  CUSTOM_MANTRAS: "jap_custom_mantras",
  HAPTICS_ENABLED: "jap_haptics_enabled",
  TTS_ENABLED: "jap_tts_enabled",
  TTS_ON_EVERY_TAP: "jap_tts_every_tap", // false = only on mala complete
  TTS_LANGUAGE: "jap_tts_language",
};

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
interface CustomMantra extends Mantra {
  isCustom: true;
}

interface JapSettings {
  hapticsEnabled: boolean;
  ttsEnabled: boolean;
  ttsOnEveryTap: boolean; // true = speak on every tap, false = only mala complete
  ttsLanguage: string; // e.g. 'hi-IN' or 'en-IN'
}

// ─────────────────────────────────────────────
// SHARED THEME-AWARE STYLES
// (built once per theme change, shared by every atom in this file)
// ─────────────────────────────────────────────
function useJapStyles() {
  const { colors, spacing, typography } = useTheme();
  const st = useMemo(
    () => makeSt(colors, spacing, typography),
    [colors, spacing, typography],
  );
  const md = useMemo(
    () => makeMd(colors, spacing, typography),
    [colors, spacing, typography],
  );
  return { colors, spacing, typography, st, md };
}

// ─────────────────────────────────────────────
// MALA BEAD RING
// ─────────────────────────────────────────────
const MalaRing = React.memo(({ progress }: { progress: number }) => {
  const { colors } = useJapStyles();
  return (
  <View style={{ width: RING_SIZE, height: RING_SIZE, position: "relative" }}>
    {Array.from({ length: BEAD_COUNT }).map((_, i) => {
      const angle = (i / BEAD_COUNT) * 2 * Math.PI - Math.PI / 2;
      const x = RING_R + BEAD_R * Math.cos(angle) - 5;
      const y = RING_R + BEAD_R * Math.sin(angle) - 5;
      const isActive = i < progress;
      const isSumeru = i === 0 || i === 27 || i === 54 || i === 81;
      const size = isSumeru ? 11 : 8;
      return (
        <View
          key={i}
          style={{
            position: "absolute",
            left: x - (size - 8) / 2,
            top: y - (size - 8) / 2,
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: isActive
              ? isSumeru
                ? "#FFE066"
                : colors.gold
              : isSumeru
                ? colors.gold + "45"
                : colors.cardBorder + "BB",
            shadowColor: isActive ? colors.gold : "transparent",
            shadowOpacity: isActive ? 0.9 : 0,
            shadowRadius: 3,
            elevation: isActive ? 2 : 0,
          }}
        />
      );
    })}
  </View>
  );
});

// ─────────────────────────────────────────────
// STAT BOX ATOM
// ─────────────────────────────────────────────
const StatBox = ({
  icon,
  value,
  labelHi,
  labelEn,
}: {
  icon: string;
  value: string | number;
  labelHi: string;
  labelEn: string;
}) => {
  const { st } = useJapStyles();
  return (
  <View style={st.statBox}>
    <Text style={st.statIcon}>{icon}</Text>
    <Text style={st.statValue}>{value}</Text>
    <Text style={st.statLabelHi}>{labelHi}</Text>
    <Text style={st.statLabelEn}>{labelEn}</Text>
  </View>
  );
};

// ─────────────────────────────────────────────
// SETTINGS ROW ATOM
// ─────────────────────────────────────────────
const SettingRow = ({
  icon,
  titleHi,
  titleEn,
  subtitle,
  value,
  onChange,
}: {
  icon: string;
  titleHi: string;
  titleEn: string;
  subtitle?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) => {
  const { colors, st } = useJapStyles();
  return (
  <View style={st.settingRow}>
    <Text style={st.settingIcon}>{icon}</Text>
    <View style={st.settingInfo}>
      <Text style={st.settingTitleHi}>{titleHi}</Text>
      <Text style={st.settingTitleEn}>{titleEn}</Text>
      {subtitle ? <Text style={st.settingSub}>{subtitle}</Text> : null}
    </View>
    <Switch
      value={value}
      onValueChange={onChange}
      trackColor={{ false: colors.cardBorder, true: colors.gold + "60" }}
      thumbColor={value ? colors.gold : colors.textMuted}
    />
  </View>
  );
};

// ─────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────
export default function JapScreen() {
  const { colors, st, md } = useJapStyles();
  // ── State ──────────────────────────────────
  const [count, setCount] = useState(0);
  const [selectedMantra, setSelectedMantra] = useState<Mantra>([]);
  const [customMantras, setCustomMantras] = useState<CustomMantra[]>([]);
  const [settings, setSettings] = useState<JapSettings>({
    hapticsEnabled: true,
    ttsEnabled: false,
    ttsOnEveryTap: false,
    ttsLanguage: "hi-IN",
  });
  const [celebrateVisible, setCelebrateVisible] = useState(false);

  // ── Modals ──────────────────────────────────
  const [showSelector, setShowSelector] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAddMantra, setShowAddMantra] = useState(false);
  const [showConfirmReset, setShowConfirmReset] = useState(false);
  const [editingMantra, setEditingMantra] = useState<CustomMantra | null>(null);
  const [dailyMantra, setDailyMantra] = useState<Mantra | null>([]);
  // ── Custom mantra form ──────────────────────
  const [formText, setFormText] = useState("");
  const [formMeaning, setFormMeaning] = useState("");
  const [formDeity, setFormDeity] = useState("");

  // ── Animation values ───────────────────────
  const scale = useSharedValue(1);
  const glow = useSharedValue(0);
  const shakeX = useSharedValue(0);
  const celebScale = useSharedValue(0);

  const completedMalas = Math.floor(count / 108);
  const currentProgress = count % 108;
  const remaining = 108 - currentProgress;
  const progressPct = Math.round((currentProgress / 108) * 100);

  const loadData = useCallback(async () => {
    try {
      const response = mantraService.getAllJapMantras();
      setDailyMantra(response);
      setSelectedMantra(response[0]);
    } catch (e) {
      console.error("Panchang load error:", e);
    }
  }, []);

  // ── Load persisted data ─────────────────────
  useEffect(() => {
    (async () => {
      await loadData();
      try {
        const savedCount = (await storageService.getJapCount()) ?? 0;
        const savedMantra = await storageService.getSelectedMantra();

        // Load custom mantras
        const rawCustom = await storageService.getData?.(
          STORAGE_KEYS.CUSTOM_MANTRAS,
        );
        if (rawCustom) setCustomMantras(JSON.parse(rawCustom));

        // Load settings
        const rawHaptics = await storageService.getData?.(
          STORAGE_KEYS.HAPTICS_ENABLED,
        );
        const rawTts = await storageService.getData?.(STORAGE_KEYS.TTS_ENABLED);
        const rawEveryTap = await storageService.getData?.(
          STORAGE_KEYS.TTS_ON_EVERY_TAP,
        );
        const rawLang = await storageService.getData?.(
          STORAGE_KEYS.TTS_LANGUAGE,
        );

        setSettings({
          hapticsEnabled: rawHaptics !== null ? rawHaptics === "true" : true,
          ttsEnabled: rawTts !== null ? rawTts === "true" : false,
          ttsOnEveryTap: rawEveryTap !== null ? rawEveryTap === "true" : false,
          ttsLanguage: rawLang ?? "hi-IN",
        });

        setCount(savedCount);

        // Restore selected mantra
        const allMantras = [
          ...dailyMantra,
          ...(rawCustom ? JSON.parse(rawCustom) : []),
        ];
        const found = allMantras.find((m) => m.text === savedMantra);
        if (found) setSelectedMantra(found);
      } catch (e) {
        console.warn("JapScreen load error:", e);
      }
    })();
  }, []);

  // ── Persist settings ────────────────────────
  const saveSetting = useCallback(async (key: string, value: string) => {
    try {
      await storageService.setData?.(key, value);
    } catch (_) {}
  }, []);

  const updateSettings = useCallback(
    (patch: Partial<JapSettings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch };
        if ("hapticsEnabled" in patch)
          saveSetting(
            STORAGE_KEYS.HAPTICS_ENABLED,
            String(next.hapticsEnabled),
          );
        if ("ttsEnabled" in patch)
          saveSetting(STORAGE_KEYS.TTS_ENABLED, String(next.ttsEnabled));
        if ("ttsOnEveryTap" in patch)
          saveSetting(
            STORAGE_KEYS.TTS_ON_EVERY_TAP,
            String(next.ttsOnEveryTap),
          );
        if ("ttsLanguage" in patch)
          saveSetting(STORAGE_KEYS.TTS_LANGUAGE, next.ttsLanguage);
        return next;
      });
    },
    [saveSetting],
  );

  // ── TTS helper ──────────────────────────────
  const speak = useCallback(
    (text: string) => {
      if (!settings.ttsEnabled) return;
      Speech.stop();
      Speech.speak(text, {
        language: "hi-IN",
        pitch: 1,
        rate: 0.85,
      });
    },
    [settings.ttsEnabled],
  );

  // ── TAP ─────────────────────────────────────
  const handleJap = useCallback(async () => {
    // Haptics
    if (settings.hapticsEnabled) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    // TTS on every tap
    if (settings.ttsEnabled && settings.ttsOnEveryTap) {
      speak(selectedMantra.text);
    }

    // Animate
    scale.value = withSequence(
      withSpring(1.14, { damping: 6, stiffness: 300 }),
      withSpring(1, { damping: 8, stiffness: 220 }),
    );
    glow.value = withSequence(
      withTiming(1, { duration: 80 }),
      withTiming(0, { duration: 350 }),
    );

    const newCount = count + 1;
    const newProgress = newCount % 108;

    // Mala complete
    if (newProgress === 0 && newCount > 0) {
      if (settings.hapticsEnabled) {
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );
      }
      // TTS on mala complete
      if (settings.ttsEnabled && !settings.ttsOnEveryTap) {
        speak(`माला पूर्ण हुई। ${selectedMantra.text}`);
      }
      celebScale.value = withSequence(
        withSpring(1.2, { damping: 5 }),
        withTiming(1, { duration: 300 }),
        withTiming(0, { duration: 700 }),
      );
      setCelebrateVisible(true);
      setTimeout(() => setCelebrateVisible(false), 2200);
    }

    setCount(newCount);
    await storageService.saveJapCount(newCount);
    await journeyService.logJapIncrement(1);
  }, [count, settings, selectedMantra, speak]);

  // ── RESET ───────────────────────────────────
  const handleReset = useCallback(async () => {
    if (settings.hapticsEnabled) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    Speech.stop();
    shakeX.value = withSequence(
      withTiming(-8, { duration: 55 }),
      withTiming(8, { duration: 55 }),
      withTiming(-5, { duration: 55 }),
      withTiming(5, { duration: 55 }),
      withTiming(0, { duration: 55 }),
    );
    setCount(0);
    await storageService.saveJapCount(0);
    setShowConfirmReset(false);
  }, [settings.hapticsEnabled]);

  // ── SELECT MANTRA ────────────────────────────
  const handleSelectMantra = useCallback(async (mantra: Mantra) => {
    setSelectedMantra(mantra);
    await storageService.saveSelectedMantra(mantra.text);
    setShowSelector(false);
    setCount(0);
    await storageService.saveJapCount(0);
  }, []);

  // ── ADD / EDIT CUSTOM MANTRA ─────────────────
  const openAddMantra = useCallback((editing?: CustomMantra) => {
    if (editing) {
      setEditingMantra(editing);
      setFormText(editing.text);
      setFormMeaning(editing.meaning ?? "");
      setFormDeity(editing.deity ?? "");
    } else {
      setEditingMantra(null);
      setFormText("");
      setFormMeaning("");
      setFormDeity("");
    }
    setShowAddMantra(true);
  }, []);

  const handleSaveCustomMantra = useCallback(async () => {
    const trimmed = formText.trim();
    if (!trimmed) {
      Alert.alert(
        "मंत्र आवश्यक है",
        "कृपया मंत्र दर्ज करें · Please enter mantra text.",
      );
      return;
    }

    const newMantra: CustomMantra = {
      id: editingMantra?.id ?? `custom_${Date.now()}`,
      text: trimmed,
      meaning: formMeaning.trim() || undefined,
      deity: formDeity.trim() || undefined,
      isCustom: true,
    } as CustomMantra;

    setCustomMantras((prev) => {
      const updated = editingMantra
        ? prev.map((m) => (m.id === editingMantra.id ? newMantra : m))
        : [...prev, newMantra];
      storageService.setData?.(
        STORAGE_KEYS.CUSTOM_MANTRAS,
        JSON.stringify(updated),
      );
      return updated;
    });

    // Auto-select if new
    if (!editingMantra) {
      setSelectedMantra(newMantra);
      await storageService.saveSelectedMantra(newMantra.text);
    } else if (selectedMantra.id === editingMantra.id) {
      setSelectedMantra(newMantra);
    }

    setShowAddMantra(false);
  }, [formText, formMeaning, formDeity, editingMantra, selectedMantra]);

  const handleDeleteCustomMantra = useCallback(
    (id: string) => {
      Alert.alert("मंत्र हटाएं?", "Delete this custom mantra?", [
        { text: "रद्द करें · Cancel", style: "cancel" },
        {
          text: "हटाएं · Delete",
          style: "destructive",
          onPress: () => {
            setCustomMantras((prev) => {
              const updated = prev.filter((m) => m.id !== id);
              storageService.setData?.(
                STORAGE_KEYS.CUSTOM_MANTRAS,
                JSON.stringify(updated),
              );
              // If deleted mantra was selected, fallback to first
              if (selectedMantra.id === id) {
                setSelectedMantra(dailyMantra[0]);
                storageService.saveSelectedMantra(dailyMantra[0].text);
              }
              return updated;
            });
          },
        },
      ]);
    },
    [selectedMantra],
  );

  // ── Animated styles ──────────────────────────
  const counterStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateX: shakeX.value }],
    shadowOpacity: 0.35 + glow.value * 0.45,
    shadowRadius: 12 + glow.value * 18,
  }));
  const celebStyle = useAnimatedStyle(() => ({
    transform: [{ scale: Math.min(celebScale.value, 1) }],
    opacity: Math.min(celebScale.value, 1),
  }));

  const allMantras = [...dailyMantra, ...customMantras];

  return (
    <GradientBackground>
      <ScrollView
        style={st.container}
        contentContainerStyle={st.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── TOP BAR ── */}
        <View style={st.topBar}>
          <TouchableOpacity
            style={st.topBarBtn}
            onPress={() => setShowSelector(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="list" size={18} color={colors.gold} />
            <Text style={st.topBarBtnTxt}>मंत्र</Text>
          </TouchableOpacity>
          <Text style={st.screenTitle}>जप माला · Jap Mala</Text>
          <TouchableOpacity
            style={st.topBarBtn}
            onPress={() => setShowSettings(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="settings-outline" size={18} color={colors.gold} />
            <Text style={st.topBarBtnTxt}>सेटिंग्स</Text>
          </TouchableOpacity>
        </View>

        {/* ── MANTRA DISPLAY ── */}
        <View style={st.mantraCard}>
          <Text style={st.mantraText}>{selectedMantra.text}</Text>
          {selectedMantra.meaning && (
            <Text style={st.mantraMeaning}>{selectedMantra.meaning}</Text>
          )}
          <View style={st.mantraFooter}>
            {selectedMantra.deity && (
              <View style={st.deityBadge}>
                <Text style={st.deityTxt}>🙏 {selectedMantra.deity}</Text>
              </View>
            )}
            {(selectedMantra as any).isCustom && (
              <View
                style={[
                  st.deityBadge,
                  {
                    borderColor: "#60A5FA" + "60",
                    backgroundColor: "#60A5FA" + "15",
                  },
                ]}
              >
                <Text style={[st.deityTxt, { color: "#60A5FA" }]}>
                  ✏️ Custom
                </Text>
              </View>
            )}
            {/* TTS & Haptic status pills */}
            <View style={st.statusPills}>
              <View
                style={[
                  st.statusPill,
                  { opacity: settings.ttsEnabled ? 1 : 0.4 },
                ]}
              >
                <Text style={st.statusPillTxt}>🔊</Text>
              </View>
              <View
                style={[
                  st.statusPill,
                  { opacity: settings.hapticsEnabled ? 1 : 0.4 },
                ]}
              >
                <Text style={st.statusPillTxt}>📳</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── MALA RING + COUNTER ── */}
        <View style={st.ringWrap}>
          <MalaRing progress={currentProgress} />

          <Animated.View style={[st.counterCircle, counterStyle]}>
            <TouchableOpacity
              style={st.counterTouch}
              onPress={handleJap}
              activeOpacity={0.85}
            >
              <Text style={st.countNum}>{count}</Text>
              <Text style={st.tapHi}>स्पर्श करें</Text>
              <Text style={st.tapEn}>TAP</Text>
            </TouchableOpacity>
          </Animated.View>

          {celebrateVisible && (
            <Animated.View style={[st.celebOverlay, celebStyle]}>
              <Text style={st.celebEmoji}>🎉</Text>
              <Text style={st.celebHi}>माला पूर्ण!</Text>
              <Text style={st.celebEn}>Mala Complete</Text>
            </Animated.View>
          )}
        </View>

        {/* ── PROGRESS ── */}
        <Text style={st.malaLabel}>
          {completedMalas === 0
            ? "पहली माला की ओर…"
            : `${completedMalas} माला पूर्ण 🙏`}
        </Text>
        <View style={st.progressWrap}>
          <View style={st.progressTrack}>
            <View style={[st.progressFill, { width: `${progressPct}%` }]} />
          </View>
          <Text style={st.progressTxt}>{currentProgress} / 108</Text>
        </View>

        {/* ── STATS ── */}
        <View style={st.statsRow}>
          <StatBox icon="🔢" value={count} labelHi="कुल जप" labelEn="Total" />
          <StatBox
            icon="📿"
            value={completedMalas}
            labelHi="पूर्ण माला"
            labelEn="Malas"
          />
          <StatBox icon="⏳" value={remaining} labelHi="शेष" labelEn="Left" />
        </View>

        {/* ── MILESTONES ── */}
        <View style={st.milestoneRow}>
          {[1, 3, 5, 11, 21, 108].map((t) => {
            const done = completedMalas >= t;
            return (
              <View key={t} style={[st.milestone, done && st.milestoneDone]}>
                <Text style={[st.milestoneNum, done && st.milestoneNumDone]}>
                  {t}
                </Text>
                <Text style={[st.milestoneLbl, done && st.milestoneLblDone]}>
                  माला
                </Text>
                {done && <Text style={st.milestoneTick}>✓</Text>}
              </View>
            );
          })}
        </View>

        {/* ── RESET ── */}
        <TouchableOpacity
          style={st.resetBtn}
          onPress={() => setShowConfirmReset(true)}
          activeOpacity={0.7}
        >
          <Ionicons
            name="refresh-circle-outline"
            size={18}
            color={colors.textMuted}
          />
          <Text style={st.resetTxt}>काउंटर रीसेट करें · Reset</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ════════════════════════════════════════
          MANTRA SELECTOR MODAL
      ════════════════════════════════════════ */}
      <Modal
        visible={showSelector}
        animationType="slide"
        transparent
        onRequestClose={() => setShowSelector(false)}
      >
        <View style={md.overlay}>
          <View style={md.sheet}>
            <View style={md.handle} />
            <View style={md.header}>
              <View>
                <Text style={md.titleHi}>मंत्र चुनें</Text>
                <Text style={md.titleEn}>Select Mantra</Text>
              </View>
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <TouchableOpacity
                  style={md.addBtn}
                  onPress={() => {
                    setShowSelector(false);
                    openAddMantra();
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add" size={18} color={colors.gold} />
                  <Text style={md.addBtnTxt}>नया मंत्र</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={md.closeBtn}
                  onPress={() => setShowSelector(false)}
                >
                  <Ionicons name="close" size={20} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>
            </View>

            <FlatList
              data={allMantras}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingBottom: spacing.xl }}
              ListHeaderComponent={
                customMantras.length > 0 ? null : (
                  <View style={md.sectionHeader}>
                    <Text style={md.sectionHeaderTxt}>
                      📿 प्रसिद्ध मंत्र · Classic Mantras
                    </Text>
                  </View>
                )
              }
              renderItem={({ item, index }) => {
                const isCustom = (item as any).isCustom;
                const isSelected = selectedMantra.id === item.id;
                const showCustomHeader =
                  isCustom && index === dailyMantra.length;
                return (
                  <>
                    {showCustomHeader && (
                      <View style={md.sectionHeader}>
                        <Text style={md.sectionHeaderTxt}>
                          ✏️ आपके मंत्र · Your Custom Mantras
                        </Text>
                      </View>
                    )}
                    <TouchableOpacity
                      style={[md.mantraItem, isSelected && md.mantraItemActive]}
                      onPress={() => handleSelectMantra(item)}
                      activeOpacity={0.75}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={md.mantraItemText}>{item.text}</Text>
                        {item.meaning && (
                          <Text style={md.mantraItemMeaning}>
                            {item.meaning}
                          </Text>
                        )}
                        {item.deity && (
                          <Text style={md.mantraItemDeity}>
                            🙏 {item.deity}
                          </Text>
                        )}
                      </View>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        {isCustom && (
                          <>
                            <TouchableOpacity
                              onPress={() => {
                                setShowSelector(false);
                                openAddMantra(item as CustomMantra);
                              }}
                              style={md.iconBtn}
                            >
                              <Ionicons
                                name="pencil-outline"
                                size={16}
                                color={colors.gold}
                              />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => handleDeleteCustomMantra(item.id)}
                              style={md.iconBtn}
                            >
                              <Ionicons
                                name="trash-outline"
                                size={16}
                                color="#EF4444"
                              />
                            </TouchableOpacity>
                          </>
                        )}
                        {isSelected && (
                          <Ionicons
                            name="checkmark-circle"
                            size={22}
                            color={colors.gold}
                          />
                        )}
                      </View>
                    </TouchableOpacity>
                  </>
                );
              }}
            />
          </View>
        </View>
      </Modal>

      {/* ════════════════════════════════════════
          ADD / EDIT CUSTOM MANTRA MODAL
      ════════════════════════════════════════ */}
      <Modal
        visible={showAddMantra}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAddMantra(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={md.overlay}>
            <View style={md.sheet}>
              <View style={md.handle} />
              <View style={md.header}>
                <View>
                  <Text style={md.titleHi}>
                    {editingMantra ? "मंत्र संपादित करें" : "नया मंत्र जोड़ें"}
                  </Text>
                  <Text style={md.titleEn}>
                    {editingMantra ? "Edit Mantra" : "Add Custom Mantra"}
                  </Text>
                </View>
                <TouchableOpacity
                  style={md.closeBtn}
                  onPress={() => setShowAddMantra(false)}
                >
                  <Ionicons name="close" size={20} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <ScrollView
                contentContainerStyle={md.formContainer}
                keyboardShouldPersistTaps="handled"
              >
                {/* Mantra text */}
                <Text style={md.formLabel}>
                  मंत्र · Mantra <Text style={{ color: "#EF4444" }}>*</Text>
                </Text>
                <TextInput
                  style={[md.formInput, md.formInputLarge]}
                  value={formText}
                  onChangeText={setFormText}
                  placeholder="ॐ नमः शिवाय…"
                  placeholderTextColor={colors.textMuted + "80"}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  autoFocus
                />

                {/* Meaning */}
                <Text style={md.formLabel}>अर्थ · Meaning (optional)</Text>
                <TextInput
                  style={md.formInput}
                  value={formMeaning}
                  onChangeText={setFormMeaning}
                  placeholder="I bow to Shiva…"
                  placeholderTextColor={colors.textMuted + "80"}
                />

                {/* Deity */}
                <Text style={md.formLabel}>देवता · Deity (optional)</Text>
                <TextInput
                  style={md.formInput}
                  value={formDeity}
                  onChangeText={setFormDeity}
                  placeholder="Shiva, Vishnu, Devi…"
                  placeholderTextColor={colors.textMuted + "80"}
                />

                {/* Preview */}
                {formText.trim().length > 0 && (
                  <View style={md.previewBox}>
                    <Text style={md.previewLabel}>Preview · पूर्वावलोकन</Text>
                    <Text style={md.previewText}>{formText}</Text>
                    {formMeaning ? (
                      <Text style={md.previewMeaning}>{formMeaning}</Text>
                    ) : null}
                    {/* TTS preview */}
                    <TouchableOpacity
                      style={md.previewSpeak}
                      onPress={() =>
                        Speech.speak(formText, {
                          language: "hi-IN",
                          pitch: 1,
                          rate: 0.85,
                        })
                      }
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name="volume-high-outline"
                        size={16}
                        color={colors.gold}
                      />
                      <Text style={md.previewSpeakTxt}>सुनें · Listen</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <TouchableOpacity
                  style={md.saveBtn}
                  onPress={handleSaveCustomMantra}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={colors.bgSecondary}
                  />
                  <Text style={md.saveBtnTxt}>
                    {editingMantra ? "अपडेट करें · Update" : "सहेजें · Save"}
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ════════════════════════════════════════
          SETTINGS MODAL
      ════════════════════════════════════════ */}
      <Modal
        visible={showSettings}
        animationType="slide"
        transparent
        onRequestClose={() => setShowSettings(false)}
      >
        <View style={md.overlay}>
          <View style={md.sheet}>
            <View style={md.handle} />
            <View style={md.header}>
              <View>
                <Text style={md.titleHi}>सेटिंग्स</Text>
                <Text style={md.titleEn}>Settings</Text>
              </View>
              <TouchableOpacity
                style={md.closeBtn}
                onPress={() => setShowSettings(false)}
              >
                <Ionicons name="close" size={20} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={{
                paddingHorizontal: spacing.lg,
                paddingBottom: spacing.xl,
              }}
            >
              {/* Haptics */}
              <Text style={md.settingSection}>📳 स्पर्श · Touch</Text>
              <SettingRow
                icon="📳"
                titleHi="कंपन / हैप्टिक्स"
                titleEn="Vibration & Haptics"
                subtitle="Feel a pulse on each tap"
                value={settings.hapticsEnabled}
                onChange={(v) => updateSettings({ hapticsEnabled: v })}
              />

              {/* TTS */}
              <Text style={md.settingSection}>🔊 वाणी · Voice</Text>
              <SettingRow
                icon="🔊"
                titleHi="मंत्र वाचन (TTS)"
                titleEn="Text-to-Speech"
                subtitle="Speak the mantra aloud"
                value={settings.ttsEnabled}
                onChange={(v) => updateSettings({ ttsEnabled: v })}
              />

              {settings.ttsEnabled && (
                <>
                  <SettingRow
                    icon="🔁"
                    titleHi="हर जप पर बोलें"
                    titleEn="Speak on every tap"
                    subtitle="Off = only on mala complete"
                    value={settings.ttsOnEveryTap}
                    onChange={(v) => updateSettings({ ttsOnEveryTap: v })}
                  />

                  {/* Language selector */}
                  {/* <View style={st.langRow}>
                    <Text style={st.langLabel}>🌐 भाषा · Language</Text>
                    <View style={st.langOptions}>
                      {[
                        { code: "hi-IN", label: "हिंदी" },
                        { code: "en-IN", label: "English" },
                        { code: "sa", label: "Sanskrit" },
                      ].map((lang) => (
                        <TouchableOpacity
                          key={lang.code}
                          style={[
                            st.langBtn,
                            settings.ttsLanguage === lang.code &&
                              st.langBtnActive,
                          ]}
                          onPress={() =>
                            updateSettings({ ttsLanguage: lang.code })
                          }
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              st.langBtnTxt,
                              settings.ttsLanguage === lang.code &&
                                st.langBtnTxtActive,
                            ]}
                          >
                            {lang.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View> */}

                  {/* Test TTS */}
                  <TouchableOpacity
                    style={st.testTtsBtn}
                    onPress={() => speak(selectedMantra.text)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="play-circle-outline"
                      size={18}
                      color={colors.gold}
                    />
                    <Text style={st.testTtsTxt}>मंत्र सुनें · Test Voice</Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ════════════════════════════════════════
          RESET CONFIRM
      ════════════════════════════════════════ */}
      <Modal
        visible={showConfirmReset}
        animationType="fade"
        transparent
        onRequestClose={() => setShowConfirmReset(false)}
      >
        <View style={md.confirmOverlay}>
          <View style={md.confirmBox}>
            <Text style={md.confirmEmoji}>🔄</Text>
            <Text style={md.confirmHi}>काउंटर रीसेट करें?</Text>
            <Text style={md.confirmEn}>Reset Counter?</Text>
            <Text style={md.confirmSub}>
              {completedMalas > 0 ? `${completedMalas} माला और ` : ""}
              {currentProgress} जप की प्रगति मिट जाएगी।{"\n"}
              This will clear your current session.
            </Text>
            <View style={md.confirmBtns}>
              <TouchableOpacity
                style={md.cancelBtn}
                onPress={() => setShowConfirmReset(false)}
                activeOpacity={0.7}
              >
                <Text style={md.cancelTxt}>रद्द · Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={md.resetConfirmBtn}
                onPress={handleReset}
                activeOpacity={0.7}
              >
                <Text style={md.resetConfirmTxt}>रीसेट · Reset</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </GradientBackground>
  );
}

// ─────────────────────────────────────────────
// SCREEN STYLES
// ─────────────────────────────────────────────
function makeSt(
  colors: ThemeColors,
  spacing: Record<string, number>,
  typography: any,
) {
  return StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    alignItems: "center",
  },

  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    marginBottom: spacing.md,
  },
  topBarBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.gold + "15",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.gold + "35",
  },
  topBarBtnTxt: { fontSize: 11, color: colors.gold, fontWeight: "600" },
  screenTitle: {
    fontSize: typography.fontSize.md,
    color: colors.gold,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },

  mantraCard: {
    width: "100%",
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.gold + "30",
    padding: spacing.lg,
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  mantraText: {
    fontSize: typography.fontSize.xxl,
    color: colors.gold,
    textAlign: "center",
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 1.5,
    lineHeight: typography.fontSize.xxl * 1.5,
    marginBottom: spacing.sm,
  },
  mantraMeaning: {
    fontSize: typography.fontSize.sm,
    color: colors.textMuted,
    textAlign: "center",
    marginBottom: spacing.sm,
    lineHeight: 20,
  },
  mantraFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    flexWrap: "wrap",
    gap: 6,
  },
  deityBadge: {
    backgroundColor: colors.gold + "15",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.gold + "40",
  },
  deityTxt: { fontSize: 11, color: colors.gold },
  statusPills: { flexDirection: "row", gap: 4, marginLeft: "auto" },
  statusPill: {
    backgroundColor: colors.cardBorder,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  statusPillTxt: { fontSize: 12 },

  ringWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    marginBottom: spacing.md,
  },
  counterCircle: {
    position: "absolute",
    width: RING_SIZE * 0.56,
    height: RING_SIZE * 0.56,
    borderRadius: RING_SIZE * 0.28,
    backgroundColor: colors.cardBg,
    borderWidth: 2.5,
    borderColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  counterTouch: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  countNum: {
    fontSize: 52,
    fontWeight: typography.fontWeight.bold,
    color: colors.gold,
    lineHeight: 58,
  },
  tapHi: {
    fontSize: 12,
    color: colors.gold + "80",
    letterSpacing: 1,
    marginTop: 2,
  },
  tapEn: { fontSize: 10, color: colors.textMuted, letterSpacing: 2 },

  celebOverlay: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.cardBg,
    borderRadius: RING_SIZE * 0.28,
    width: RING_SIZE * 0.56,
    height: RING_SIZE * 0.56,
    borderWidth: 2,
    borderColor: "#FFE066",
  },
  celebEmoji: { fontSize: 36 },
  celebHi: { fontSize: 18, color: "#FFE066", fontWeight: "bold", marginTop: 4 },
  celebEn: { fontSize: 12, color: colors.textMuted },

  malaLabel: {
    fontSize: typography.fontSize.md,
    color: colors.gold,
    fontWeight: "600",
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  progressWrap: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    backgroundColor: colors.cardBorder,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.gold,
    borderRadius: 3,
  },
  progressTxt: {
    fontSize: 11,
    color: colors.textMuted,
    width: 52,
    textAlign: "right",
  },

  statsRow: {
    flexDirection: "row",
    width: "100%",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.gold + "25",
    padding: spacing.sm,
    alignItems: "center",
    gap: 2,
  },
  statIcon: { fontSize: 16 },
  statValue: {
    fontSize: 22,
    fontWeight: typography.fontWeight.bold,
    color: colors.gold,
  },
  statLabelHi: {
    fontSize: 10,
    color: colors.textPrimary,
    fontWeight: "600",
    textAlign: "center",
  },
  statLabelEn: { fontSize: 9, color: colors.textMuted, textAlign: "center" },

  milestoneRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: spacing.xs,
    width: "100%",
    marginBottom: spacing.lg,
  },
  milestone: {
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.cardBg + "80",
    minWidth: 52,
    position: "relative",
  },
  milestoneDone: {
    borderColor: colors.gold,
    backgroundColor: colors.gold + "20",
  },
  milestoneNum: { fontSize: 16, fontWeight: "bold", color: colors.textMuted },
  milestoneNumDone: { color: colors.gold },
  milestoneLbl: { fontSize: 9, color: colors.textMuted },
  milestoneLblDone: { color: colors.gold + "CC" },
  milestoneTick: {
    position: "absolute",
    top: -6,
    right: -6,
    fontSize: 12,
    color: colors.gold,
  },

  resetBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.cardBg + "60",
  },
  resetTxt: { fontSize: typography.fontSize.sm, color: colors.textMuted },

  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider + "60",
    gap: spacing.sm,
  },
  settingIcon: { fontSize: 20, width: 28, textAlign: "center" },
  settingInfo: { flex: 1 },
  settingTitleHi: {
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
    fontWeight: "600",
  },
  settingTitleEn: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  settingSub: { fontSize: 10, color: colors.textMuted + "AA", marginTop: 2 },

  langRow: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider + "60",
  },
  langLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  langOptions: { flexDirection: "row", gap: spacing.sm },
  langBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.cardBg,
  },
  langBtnActive: {
    borderColor: colors.gold,
    backgroundColor: colors.gold + "20",
  },
  langBtnTxt: { fontSize: 13, color: colors.textMuted },
  langBtnTxtActive: { color: colors.gold, fontWeight: "600" },

  testTtsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.gold + "15",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.gold + "40",
    alignSelf: "flex-start",
  },
  testTtsTxt: { fontSize: typography.fontSize.sm, color: colors.gold },
  });
}

// ─────────────────────────────────────────────
// MODAL STYLES
// ─────────────────────────────────────────────
function makeMd(
  colors: ThemeColors,
  spacing: Record<string, number>,
  typography: any,
) {
  return StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.bgSecondary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
    paddingBottom: spacing.xl,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.textMuted + "60",
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  titleHi: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.gold,
  },
  titleEn: {
    fontSize: typography.fontSize.sm,
    color: colors.textMuted,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.textMuted + "20",
    alignItems: "center",
    justifyContent: "center",
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.gold + "15",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.gold + "40",
  },
  addBtnTxt: { fontSize: 12, color: colors.gold, fontWeight: "600" },

  sectionHeader: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.bgSecondary,
  },
  sectionHeaderTxt: {
    fontSize: 11,
    color: colors.gold,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },

  mantraItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider + "70",
  },
  mantraItemActive: {
    backgroundColor: colors.gold + "10",
    borderLeftWidth: 3,
    borderLeftColor: colors.gold,
  },
  mantraItemText: {
    fontSize: typography.fontSize.lg,
    color: colors.textPrimary,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: 3,
  },
  mantraItemMeaning: {
    fontSize: typography.fontSize.sm,
    color: colors.textMuted,
    marginBottom: 4,
  },
  mantraItemDeity: {
    fontSize: 11,
    color: colors.gold,
    backgroundColor: colors.gold + "15",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    alignSelf: "flex-start",
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.cardBg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },

  formContainer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  formLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.textMuted,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  formInput: {
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
    minHeight: 44,
  },
  formInputLarge: { minHeight: 80, lineHeight: 24 },

  previewBox: {
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.gold + "10",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.gold + "30",
  },
  previewLabel: {
    fontSize: 10,
    color: colors.gold,
    marginBottom: spacing.xs,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  previewText: {
    fontSize: typography.fontSize.xl,
    color: colors.gold,
    fontWeight: "bold",
    marginBottom: 4,
  },
  previewMeaning: {
    fontSize: typography.fontSize.sm,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  previewSpeak: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: colors.gold + "20",
    borderRadius: 20,
  },
  previewSpeakTxt: { fontSize: 12, color: colors.gold },

  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    marginTop: spacing.xl,
    backgroundColor: colors.gold,
    borderRadius: 12,
    paddingVertical: spacing.md,
  },
  saveBtnTxt: {
    fontSize: typography.fontSize.md,
    color: colors.bgSecondary,
    fontWeight: typography.fontWeight.bold,
  },

  settingSection: {
    fontSize: 11,
    color: colors.gold,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },

  confirmOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  confirmBox: {
    width: "100%",
    backgroundColor: colors.bgSecondary,
    borderRadius: 20,
    padding: spacing.xl,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  confirmEmoji: { fontSize: 40, marginBottom: spacing.sm },
  confirmHi: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  confirmEn: {
    fontSize: typography.fontSize.md,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  confirmSub: {
    fontSize: typography.fontSize.sm,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  confirmBtns: { flexDirection: "row", gap: spacing.md, width: "100%" },
  cancelBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: "center",
  },
  cancelTxt: { fontSize: typography.fontSize.md, color: colors.textMuted },
  resetConfirmBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 12,
    backgroundColor: "#EF4444" + "20",
    borderWidth: 1,
    borderColor: "#EF4444",
    alignItems: "center",
  },
  resetConfirmTxt: {
    fontSize: typography.fontSize.md,
    color: "#EF4444",
    fontWeight: "600",
  },
  });
}
