/**
 * SettingsScreen.tsx — UPDATED
 *
 * Changes vs original:
 *  1. Developer card is now compact (single row, no large bio block)
 *  2. Full Notifications section with all categories:
 *     - Daily Reminders (Morning Puja, Evening Aarti, Daily Jap)
 *     - Weekly Devotion
 *     - Festival Alerts
 *     - Smart Spiritual Alerts (Ekadashi, Pradosh, Purnima, Amavasya)
 *     - Personalized Reminders
 *     - Sound & Vibration toggles
 *  3. Each toggle schedules/cancels via notificationService
 *  4. Time pickers where applicable
 *  5. AsyncStorage persistence via useNotifications hook
 */

import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
  Share,
  Switch,
  Modal,
  Platform,
  ActivityIndicator,
} from "react-native";
import { GradientBackground } from "../../components/GradientBackground";
import { Card } from "../../components/Card";
import { useTheme, ThemeColors, ThemeName } from "../../theme";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { useNotifications } from "../../services/useNotification";
import type { NotificationPrefs } from "../../services/notificationService";
import { useLanguage, LANGUAGES } from "../../localization";
import { LanguagePickerModal } from "../../components/LanguagePickerModal";

// ─────────────────────────────────────────────
// SHARED THEME-AWARE STYLES
// (built once per theme change, shared by every atom in this file)
// ─────────────────────────────────────────────
function useSettingsStyles() {
  const { colors, spacing, typography } = useTheme();
  const st = useMemo(() => makeSt(colors, spacing, typography), [
    colors,
    spacing,
    typography,
  ]);
  const tp = useMemo(() => makeTp(colors, spacing, typography), [
    colors,
    spacing,
    typography,
  ]);
  return { colors, spacing, typography, st, tp };
}

// ─────────────────────────────────────────────
// DEVELOPER INFO (compact)
// ─────────────────────────────────────────────
const DEV = {
  name: "Prateek Shukla",
  nameHi: "प्रतीक शुक्ल",
  role: "Full Stack Developer",
  email: "prateekshukla130@gmail.com",
  website: "https://portfolio-15a4a.web.app/",
  linkedin: "https://www.linkedin.com/in/prateek-shukla-b61050215/",
};

const DEV_2 = {
  name: "Vasav Prashar",
  nameHi: "वासव प्रशार",
  role: "Full Stack Developer",
  email: "vasv.420@gmail.com",
  linkedin: "https://www.linkedin.com/in/prateek-shukla-b61050215/",
};

async function openLink(url: string) {
  try {
    const supported = await Linking.canOpenURL(url);
    if (supported) await Linking.openURL(url);
    else Alert.alert("त्रुटि · Error", `Cannot open: ${url}`);
  } catch {
    Alert.alert("त्रुटि · Error", "Could not open link.");
  }
}
function openEmail() {
  const s = encodeURIComponent("Panchang App Feedback");
  const b = encodeURIComponent("Namaste,\n\n");
  openLink(`mailto:${DEV.email}?subject=${s}&body=${b}`);
}

// ─────────────────────────────────────────────
// ATOMS
// ─────────────────────────────────────────────
const Divider = () => {
  const { st } = useSettingsStyles();
  return <View style={st.divider} />;
};

const SectionHeader = ({
  icon,
  en,
  hi,
}: {
  icon: string;
  en: string;
  hi: string;
}) => {
  const { colors, st } = useSettingsStyles();
  return (
    <View style={st.sectionHeader}>
      <View style={st.sectionHeaderIcon}>
        <Ionicons name={icon as any} size={15} color={colors.gold} />
      </View>
      <Text style={st.sectionHeaderEn}>{en}</Text>
      <Text style={st.sectionHeaderHi}>{hi}</Text>
    </View>
  );
};

// ── Toggle Row ───────────────────────────────
const ToggleRow = ({
  icon,
  iconColor,
  labelEn,
  labelHi,
  subEn,
  value,
  onValueChange,
  disabled,
}: {
  icon: string;
  iconColor?: string;
  labelEn: string;
  labelHi: string;
  subEn?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
}) => {
  const { colors, st } = useSettingsStyles();
  return (
    <View style={[st.toggleRow, disabled && { opacity: 0.45 }]}>
      <View
        style={[
          st.toggleIcon,
          { backgroundColor: (iconColor ?? colors.gold) + "18" },
        ]}
      >
        <Ionicons
          name={icon as any}
          size={18}
          color={iconColor ?? colors.gold}
        />
      </View>
      <View style={st.toggleLabels}>
        <Text style={st.toggleLabelEn}>{labelEn}</Text>
        {subEn ? <Text style={st.toggleSub}>{subEn}</Text> : null}
        <Text style={st.toggleLabelHi}>{labelHi}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={disabled ? undefined : onValueChange}
        trackColor={{ false: colors.cardBorder, true: colors.gold + "80" }}
        thumbColor={value ? colors.gold : colors.textMuted}
        ios_backgroundColor={colors.cardBorder}
      />
    </View>
  );
};

// ── Time Picker Row ──────────────────────────
const TimeRow = ({
  icon,
  labelEn,
  labelHi,
  hour,
  minute,
  onPress,
  visible,
}: {
  icon: string;
  labelEn: string;
  labelHi: string;
  hour: number;
  minute: number;
  onPress: () => void;
  visible: boolean;
}) => {
  const { colors, st } = useSettingsStyles();
  if (!visible) return null;
  const h = String(hour).padStart(2, "0");
  const m = String(minute).padStart(2, "0");
  return (
    <TouchableOpacity style={st.timeRow} onPress={onPress} activeOpacity={0.75}>
      <Ionicons name={icon as any} size={16} color={colors.textMuted} />
      <Text style={st.timeRowLabel}>
        {labelEn} · {labelHi}
      </Text>
      <View style={st.timePill}>
        <Text style={st.timePillTxt}>
          {h}:{m}
        </Text>
        <Ionicons name="chevron-forward" size={13} color={colors.gold} />
      </View>
    </TouchableOpacity>
  );
};

// ── Link Row ─────────────────────────────────
const LinkRow = ({
  icon,
  labelEn,
  labelHi,
  sub,
  onPress,
  iconColor,
}: {
  icon: string;
  labelEn: string;
  labelHi: string;
  sub?: string;
  onPress: () => void;
  iconColor?: string;
}) => {
  const { colors, st } = useSettingsStyles();
  return (
    <TouchableOpacity style={st.linkRow} onPress={onPress} activeOpacity={0.72}>
      <View
        style={[
          st.linkIconBox,
          { backgroundColor: (iconColor ?? colors.gold) + "18" },
        ]}
      >
        <Ionicons
          name={icon as any}
          size={20}
          color={iconColor ?? colors.gold}
        />
      </View>
      <View style={st.linkText}>
        <View style={st.linkLabelRow}>
          <Text style={st.linkLabelEn}>{labelEn}</Text>
          <Text style={st.linkLabelHi}>{labelHi}</Text>
        </View>
        {sub ? (
          <Text style={st.linkSub} numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
      </View>
      <Ionicons
        name="chevron-forward"
        size={16}
        color={colors.textMuted + "80"}
      />
    </TouchableOpacity>
  );
};

// ─────────────────────────────────────────────
// INLINE TIME PICKER MODAL
// (Custom wheel-style for cross-platform use,
//  no extra native deps needed)
// ─────────────────────────────────────────────
interface TimePick {
  hour: number;
  minute: number;
}

const TimePickerModal = ({
  visible,
  initial,
  title,
  onConfirm,
  onClose,
}: {
  visible: boolean;
  initial: TimePick;
  title: string;
  onConfirm: (t: TimePick) => void;
  onClose: () => void;
}) => {
  const { colors, tp } = useSettingsStyles();
  const [h, setH] = useState(initial.hour);
  const [m, setM] = useState(initial.minute);

  const fmt = (n: number) => String(n).padStart(2, "0");

  const changeH = (delta: number) => setH((v) => (v + delta + 24) % 24);
  const changeM = (delta: number) => setM((v) => (v + delta + 60) % 60);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={tp.overlay}>
        <View style={tp.sheet}>
          <Text style={tp.title}>{title}</Text>
          <View style={tp.pickers}>
            {/* Hour */}
            <View style={tp.wheel}>
              <TouchableOpacity onPress={() => changeH(1)} style={tp.arrow}>
                <Ionicons name="chevron-up" size={22} color={colors.gold} />
              </TouchableOpacity>
              <Text style={tp.digit}>{fmt(h)}</Text>
              <TouchableOpacity onPress={() => changeH(-1)} style={tp.arrow}>
                <Ionicons name="chevron-down" size={22} color={colors.gold} />
              </TouchableOpacity>
              <Text style={tp.unit}>HH</Text>
            </View>
            <Text style={tp.colon}>:</Text>
            {/* Minute */}
            <View style={tp.wheel}>
              <TouchableOpacity onPress={() => changeM(5)} style={tp.arrow}>
                <Ionicons name="chevron-up" size={22} color={colors.gold} />
              </TouchableOpacity>
              <Text style={tp.digit}>{fmt(m)}</Text>
              <TouchableOpacity onPress={() => changeM(-5)} style={tp.arrow}>
                <Ionicons name="chevron-down" size={22} color={colors.gold} />
              </TouchableOpacity>
              <Text style={tp.unit}>MM</Text>
            </View>
          </View>
          <View style={tp.actions}>
            <TouchableOpacity style={tp.cancelBtn} onPress={onClose}>
              <Text style={tp.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={tp.confirmBtn}
              onPress={() => {
                onConfirm({ hour: h, minute: m });
                onClose();
              }}
            >
              <Text style={tp.confirmTxt}>Set Time · समय सेट करें</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ─────────────────────────────────────────────
// WEEKDAY PICKER
// ─────────────────────────────────────────────
const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS_SHORT_HI = ["रवि", "सोम", "मंगल", "बुध", "गुरु", "शुक्र", "शनि"];

const WeekdayPicker = ({
  selected,
  onChange,
}: {
  selected: number;
  onChange: (d: number) => void;
}) => {
  const { st } = useSettingsStyles();
  return (
    <View style={st.weekdayRow}>
      {DAYS_SHORT.map((d, i) => (
        <TouchableOpacity
          key={d}
          style={[st.dayBtn, selected === i && st.dayBtnActive]}
          onPress={() => onChange(i)}
          activeOpacity={0.7}
        >
          <Text style={[st.dayBtnTxt, selected === i && st.dayBtnTxtActive]}>
            {d}
          </Text>
          <Text style={[st.dayBtnHi, selected === i && st.dayBtnTxtActive]}>
            {DAYS_SHORT_HI[i]}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

// ─────────────────────────────────────────────
// PERMISSION BANNER
// ─────────────────────────────────────────────
const PermissionBanner = ({ onRequest }: { onRequest: () => void }) => {
  const { spacing, st } = useSettingsStyles();
  return (
    <TouchableOpacity
      style={st.permBanner}
      onPress={onRequest}
      activeOpacity={0.85}
    >
      <Ionicons name="notifications-off-outline" size={20} color="#F59E0B" />
      <View style={{ flex: 1, marginLeft: spacing.sm }}>
        <Text style={st.permBannerTitle}>
          Notifications Disabled · सूचनाएं बंद हैं
        </Text>
        <Text style={st.permBannerSub}>
          Tap to grant permission · अनुमति देने के लिए टैप करें
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#F59E0B" />
    </TouchableOpacity>
  );
};

// ── Theme Option ─────────────────────────────
const ThemeOption = ({
  active,
  label,
  sub,
  swatch,
  onPress,
}: {
  active: boolean;
  label: string;
  sub: string;
  swatch: string;
  onPress: () => void;
}) => {
  const { colors, st } = useSettingsStyles();
  return (
    <TouchableOpacity
      style={[st.themeOption, active && st.themeOptionActive]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={[st.themeSwatch, { backgroundColor: swatch }]} />
      <Text style={[st.themeOptionLabel, active && { color: colors.gold }]}>
        {label}
      </Text>
      <Text style={st.themeOptionSub}>{sub}</Text>
      {active && (
        <Ionicons
          name="checkmark-circle"
          size={16}
          color={colors.gold}
          style={{ marginTop: 4 }}
        />
      )}
    </TouchableOpacity>
  );
};

// ─────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────
export default function SettingsScreen() {
  const { prefs, loading, permissionGranted, updatePref, requestPermission } =
    useNotifications();
  const { colors, themeName, setThemeName } = useTheme();
  const { language, t } = useLanguage();
  const { st } = useSettingsStyles();
  const [langPickerOpen, setLangPickerOpen] = useState(false);

  // ── Time picker state ──────────────────────
  const [timePicker, setTimePicker] = useState<{
    visible: boolean;
    key: keyof NotificationPrefs | null;
    title: string;
    current: { hour: number; minute: number };
  }>({ visible: false, key: null, title: "", current: { hour: 6, minute: 0 } });

  const openTimePicker = (
    key: keyof NotificationPrefs,
    title: string,
    current: { hour: number; minute: number },
  ) => setTimePicker({ visible: true, key, title, current });

  const handleTimeConfirm = (t: { hour: number; minute: number }) => {
    if (timePicker.key) updatePref(timePicker.key, t as any);
  };

  return (
    <GradientBackground>
      <ScrollView
        style={st.container}
        contentContainerStyle={{ paddingBottom: 56 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ══════════════════════════════════════
            APPEARANCE & LANGUAGE
        ══════════════════════════════════════ */}
        <View style={st.cardWrap}>
          <View style={st.cardHeader}>
            <Text style={st.cardTitle}>
              🎨 {t("appearance.sectionTitle")}
            </Text>
          </View>

          <View style={st.themeRow}>
            <ThemeOption
              active={themeName === "dark"}
              label={t("appearance.dark")}
              sub={t("appearance.darkSub")}
              swatch="#4A0E0E"
              onPress={() => setThemeName("dark")}
            />
            <ThemeOption
              active={themeName === "light"}
              label={t("appearance.light")}
              sub={t("appearance.lightSub")}
              swatch="#FFF8F0"
              onPress={() => setThemeName("light")}
            />
          </View>

          <Divider />

          <TouchableOpacity
            style={st.linkRow}
            onPress={() => setLangPickerOpen(true)}
            activeOpacity={0.72}
          >
            <View
              style={[st.linkIconBox, { backgroundColor: colors.gold + "18" }]}
            >
              <Ionicons name="language-outline" size={20} color={colors.gold} />
            </View>
            <View style={st.linkText}>
              <Text style={st.linkLabelEn}>{t("appearance.languageLabel")}</Text>
              <Text style={st.linkSub}>
                {LANGUAGES.find((l) => l.code === language)?.nativeName}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={colors.textMuted + "80"}
            />
          </TouchableOpacity>
        </View>

        {/* ══════════════════════════════════════
            NOTIFICATIONS
        ══════════════════════════════════════ */}
        <View style={st.cardWrap}>
          <View style={st.cardHeader}>
            <Text style={st.cardTitle}>🔔 सूचनाएं · Notifications</Text>
          </View>

          {loading && (
            <View style={st.loadingRow}>
              <ActivityIndicator size="small" color={colors.gold} />
              <Text style={st.loadingTxt}>Loading preferences…</Text>
            </View>
          )}

          {!loading && !permissionGranted && (
            <PermissionBanner onRequest={requestPermission} />
          )}

          {!loading && (
            <>
              {/* ── DAILY REMINDERS ── */}
              <SectionHeader
                icon="sunny-outline"
                en="Daily Reminders"
                hi="दैनिक स्मरण"
              />

              <ToggleRow
                icon="flower-outline"
                iconColor="#F59E0B"
                labelEn="Morning Puja Reminder"
                labelHi="प्रातः पूजा स्मरण"
                subEn="Daily morning prayer alert"
                value={prefs.morningPuja}
                onValueChange={(v) => updatePref("morningPuja", v)}
              />
              <TimeRow
                icon="time-outline"
                labelEn="Time"
                labelHi="समय"
                hour={prefs.morningPujaTime.hour}
                minute={prefs.morningPujaTime.minute}
                visible={prefs.morningPuja}
                onPress={() =>
                  openTimePicker(
                    "morningPujaTime",
                    "🌅 Morning Puja Time",
                    prefs.morningPujaTime,
                  )
                }
              />

              <ToggleRow
                icon="flame-outline"
                iconColor="#EF4444"
                labelEn="Evening Aarti Reminder"
                labelHi="संध्या आरती स्मरण"
                subEn="Dusk prayer & aarti time"
                value={prefs.eveningAarti}
                onValueChange={(v) => updatePref("eveningAarti", v)}
              />
              <TimeRow
                icon="time-outline"
                labelEn="Time"
                labelHi="समय"
                hour={prefs.eveningAartiTime.hour}
                minute={prefs.eveningAartiTime.minute}
                visible={prefs.eveningAarti}
                onPress={() =>
                  openTimePicker(
                    "eveningAartiTime",
                    "🔔 Evening Aarti Time",
                    prefs.eveningAartiTime,
                  )
                }
              />

              <ToggleRow
                icon="sparkles-outline"
                iconColor="#8B5CF6"
                labelEn="Daily Jap Reminder"
                labelHi="दैनिक जप स्मरण"
                subEn="Mantra jap & counting reminder"
                value={prefs.dailyJap}
                onValueChange={(v) => updatePref("dailyJap", v)}
              />
              <TimeRow
                icon="time-outline"
                labelEn="Time"
                labelHi="समय"
                hour={prefs.dailyJapTime.hour}
                minute={prefs.dailyJapTime.minute}
                visible={prefs.dailyJap}
                onPress={() =>
                  openTimePicker(
                    "dailyJapTime",
                    "📿 Daily Jap Time",
                    prefs.dailyJapTime,
                  )
                }
              />

              <Divider />

              {/* ── WEEKLY DEVOTION ── */}
              <SectionHeader
                icon="calendar-outline"
                en="Weekly Devotion"
                hi="साप्ताहिक भक्ति"
              />

              <ToggleRow
                icon="star-outline"
                iconColor="#F4D160"
                labelEn="Weekly Devotion Reminder"
                labelHi="साप्ताहिक भक्ति"
                subEn="One special day of deeper devotion"
                value={prefs.weeklyDevotion}
                onValueChange={(v) => updatePref("weeklyDevotion", v)}
              />

              {prefs.weeklyDevotion && (
                <>
                  <Text style={st.pickerLabel}>Day · दिन चुनें</Text>
                  <WeekdayPicker
                    selected={prefs.weeklyDevotionDay}
                    onChange={(d) => updatePref("weeklyDevotionDay", d)}
                  />
                  <TimeRow
                    icon="time-outline"
                    labelEn="Time"
                    labelHi="समय"
                    hour={prefs.weeklyDevotionTime.hour}
                    minute={prefs.weeklyDevotionTime.minute}
                    visible={true}
                    onPress={() =>
                      openTimePicker(
                        "weeklyDevotionTime",
                        "🙏 Weekly Devotion Time",
                        prefs.weeklyDevotionTime,
                      )
                    }
                  />
                </>
              )}

              <Divider />

              {/* ── FESTIVAL ALERTS ── */}
              <SectionHeader
                icon="gift-outline"
                en="Festival Alerts"
                hi="पर्व सूचनाएं"
              />

              <ToggleRow
                icon="sparkles-outline"
                iconColor="#F97316"
                labelEn="Festival Reminders"
                labelHi="पर्व अनुस्मारक"
                subEn="Get notified before Hindu festivals"
                value={prefs.festivalAlerts}
                onValueChange={(v) => updatePref("festivalAlerts", v)}
              />

              {prefs.festivalAlerts && (
                <View style={st.daysBeforeRow}>
                  <Text style={st.pickerLabel}>Notify · कितने दिन पहले</Text>
                  <View style={st.daysBeforeBtns}>
                    {[1, 2].map((d) => (
                      <TouchableOpacity
                        key={d}
                        style={[
                          st.daysBtn,
                          prefs.festivalDaysBefore === d && st.daysBtnActive,
                        ]}
                        onPress={() => updatePref("festivalDaysBefore", d)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            st.daysBtnTxt,
                            prefs.festivalDaysBefore === d &&
                              st.daysBtnTxtActive,
                          ]}
                        >
                          {d} day{d > 1 ? "s" : ""} before
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              <Divider />

              {/* ── SMART SPIRITUAL ALERTS ── */}
              <SectionHeader
                icon="moon-outline"
                en="Smart Spiritual Alerts"
                hi="स्मार्ट आध्यात्मिक सूचनाएं"
              />

              <ToggleRow
                icon="leaf-outline"
                iconColor="#22C55E"
                labelEn="Ekadashi Alerts"
                labelHi="एकादशी सूचना"
                subEn="11th lunar day fasting reminders"
                value={prefs.ekadashiAlert}
                onValueChange={(v) => updatePref("ekadashiAlert", v)}
              />
              <ToggleRow
                icon="prism-outline"
                iconColor="#818CF8"
                labelEn="Pradosh Vrat Alerts"
                labelHi="प्रदोष व्रत सूचना"
                subEn="Shiva worship on Trayodashi"
                value={prefs.pradoshAlert}
                onValueChange={(v) => updatePref("pradoshAlert", v)}
              />
              <ToggleRow
                icon="radio-button-on-outline"
                iconColor="#F4D160"
                labelEn="Purnima (Full Moon)"
                labelHi="पूर्णिमा सूचना"
                subEn="Sacred full moon day reminders"
                value={prefs.purnimAlert}
                onValueChange={(v) => updatePref("purnimAlert", v)}
              />
              <ToggleRow
                icon="radio-button-off-outline"
                iconColor="#94A3B8"
                labelEn="Amavasya (No Moon)"
                labelHi="अमावस्या सूचना"
                subEn="Pitru Tarpan & ancestor puja reminders"
                value={prefs.amavasaAlert}
                onValueChange={(v) => updatePref("amavasaAlert", v)}
              />

              <Divider />

              {/* ── PERSONALIZED REMINDERS ── */}
              <SectionHeader
                icon="person-circle-outline"
                en="Personalized Reminders"
                hi="व्यक्तिगत स्मरण"
              />

              <View style={st.personalizedBox}>
                <Ionicons
                  name="construct-outline"
                  size={18}
                  color={colors.textMuted}
                />
                <Text style={st.personalizedTxt}>
                  Custom reminders can be added from the{" "}
                  <Text style={{ color: colors.gold }}>Jap</Text> and{" "}
                  <Text style={{ color: colors.gold }}>Puja</Text> screens via
                  the bookmark icon.
                </Text>
              </View>

              <Divider />

              {/* ── SOUND & VIBRATION ── */}
              <SectionHeader
                icon="volume-high-outline"
                en="Sound & Vibration"
                hi="ध्वनि और कंपन"
              />

              <ToggleRow
                icon="musical-note-outline"
                iconColor="#06B6D4"
                labelEn="Notification Sound"
                labelHi="सूचना ध्वनि"
                subEn="Play sound with notifications"
                value={prefs.soundEnabled}
                onValueChange={(v) => updatePref("soundEnabled", v)}
              />
              <ToggleRow
                icon="phone-portrait-outline"
                iconColor="#10B981"
                labelEn="Vibration"
                labelHi="कंपन"
                subEn="Vibrate on notifications"
                value={prefs.vibrationEnabled}
                onValueChange={(v) => updatePref("vibrationEnabled", v)}
              />
            </>
          )}
        </View>

        {/* ══════════════════════════════════════
            ABOUT APP (unchanged)
        ══════════════════════════════════════ */}
        <View style={st.cardWrap}>
          <View style={st.cardHeader}>
            <Text style={st.cardTitle}>🪔 About · परिचय</Text>
          </View>
          <InfoRow
            icon="information-circle"
            labelEn="App Version"
            labelHi="संस्करण"
            valueEn={Constants.expoConfig?.version ?? "1.0.0"}
          />
          <Divider />
          <InfoRow
            icon="book"
            labelEn="Purpose"
            labelHi="उद्देश्य"
            valueEn="A spiritual companion for daily Hindu practices"
            valueHi="हिंदू दैनिक पूजा, पञ्चाङ्ग, भजन और शास्त्रों के लिए आध्यात्मिक सहायक"
          />
          <Divider />
          <InfoRow
            icon="location"
            labelEn="Origin"
            labelHi="देश"
            valueEn="India 🇮🇳"
            valueHi="भारत 🇮🇳"
          />
        </View>

        {/* ══════════════════════════════════════
            DEVELOPER — COMPACT VERSION
        ══════════════════════════════════════ */}
        <View style={st.cardWrap}>
          <View style={st.cardHeader}>
            <Text style={st.cardTitle}>👨‍💻 Developer · डेवलपर</Text>
          </View>

          {/* Compact one-row profile */}
          <View style={st.devCompact}>
            <View style={st.devAvatarSm}>
              <Text style={{ fontSize: 18 }}>🧑‍💻</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                <Text style={st.devNameSm}>{DEV.name}</Text>
                <Text style={st.devNameHiSm}>· {DEV.nameHi}</Text>
              </View>
              <Text style={st.devRoleSm}>{DEV.role} · India 🇮🇳</Text>
            </View>
          </View>

          <Divider />

          <LinkRow
            icon="mail"
            labelEn="Email"
            labelHi="ईमेल"
            sub={DEV.email}
            onPress={openEmail}
            iconColor="#EA4335"
          />
          <LinkRow
            icon="globe-outline"
            labelEn="Portfolio"
            labelHi="वेबसाइट"
            sub={DEV.website}
            onPress={() => openLink(DEV.website)}
            iconColor={colors.gold}
          />
          <LinkRow
            icon="logo-linkedin"
            labelEn="LinkedIn"
            labelHi="लिंक्डइन"
            onPress={() => openLink(DEV.linkedin)}
            iconColor="#0A66C2"
          />
        </View>

        {/* ══════════════════════════════════════
            FEEDBACK
        ══════════════════════════════════════ */}
        <View style={st.cardWrap}>
          <View style={st.cardHeader}>
            <Text style={st.cardTitle}>💬 Feedback · प्रतिक्रिया</Text>
          </View>
          <LinkRow
            icon="mail-outline"
            labelEn="Send Feedback"
            labelHi="प्रतिक्रिया भेजें"
            sub="Report a bug or suggest a feature"
            onPress={openEmail}
            iconColor={colors.gold}
          />
          <LinkRow
            icon="star-outline"
            labelEn="Rate the App"
            labelHi="ऐप रेटिंग दें"
            sub="Your rating helps others"
            onPress={() => openLink("https://play.google.com/store")}
            iconColor="#F59E0B"
          />
          <LinkRow
            icon="share-social-outline"
            labelEn="Share App"
            labelHi="ऐप शेयर करें"
            sub="Share with family & friends"
            onPress={() =>
              Share.share({
                title: "Panchang — Daily Hindu Calendar",
                message: `🪔 Jai Shri Ram!\n\nBeautiful Panchang app for daily Hindu calendar, bhajans, mantras & Gita.\n\nDownload: ${DEV.website}`,
                url: DEV.website,
              })
            }
            iconColor="#22C55E"
          />
        </View>

        {/* ══════════════════════════════════════
            FOOTER
        ══════════════════════════════════════ */}
        <View style={st.footer}>
          <Text style={st.footerOm}>ॐ</Text>
          <Text style={st.footerMain}>Har Har Mahadev</Text>
          <Text style={st.footerSub}>हर हर महादेव</Text>
          <Text style={st.footerMantra}>॥ सर्वे भवन्तु सुखिनः ॥</Text>
        </View>
      </ScrollView>

      {/* ── TIME PICKER MODAL ── */}
      <TimePickerModal
        visible={timePicker.visible}
        initial={timePicker.current}
        title={timePicker.title}
        onConfirm={handleTimeConfirm}
        onClose={() => setTimePicker((p) => ({ ...p, visible: false }))}
      />
      <LanguagePickerModal
        visible={langPickerOpen}
        onClose={() => setLangPickerOpen(false)}
      />
    </GradientBackground>
  );
}

// ─────────────────────────────────────────────
// INFO ROW (re-used from original)
// ─────────────────────────────────────────────
const InfoRow = ({
  icon,
  labelEn,
  labelHi,
  valueEn,
  valueHi,
}: {
  icon: string;
  labelEn: string;
  labelHi: string;
  valueEn: string;
  valueHi?: string;
}) => {
  const { colors, st } = useSettingsStyles();
  return (
    <View style={st.infoRow}>
      <Ionicons name={icon as any} size={22} color={colors.gold} />
      <View style={st.infoText}>
        <View style={st.infoLabelRow}>
          <Text style={st.infoLabelEn}>{labelEn}</Text>
          <Text style={st.infoLabelHi}>{labelHi}</Text>
        </View>
        <Text style={st.infoValueEn}>{valueEn}</Text>
        {valueHi ? <Text style={st.infoValueHi}>{valueHi}</Text> : null}
      </View>
    </View>
  );
};

// ─────────────────────────────────────────────
// STYLES (theme-dependent — built via useSettingsStyles())
// ─────────────────────────────────────────────
function makeSt(colors: ThemeColors, spacing: Record<string, number>, typography: any) {
  return StyleSheet.create({
  container: { flex: 1 },

  // Card wrapper (replaces Card component for full control)
  cardWrap: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    overflow: "hidden",
  },
  cardHeader: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
    backgroundColor: colors.gold + "08",
  },
  cardTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.gold,
    letterSpacing: 0.3,
  },

  divider: {
    height: 1,
    backgroundColor: colors.divider,
    marginHorizontal: spacing.md,
  },

  // Theme option cards
  themeRow: {
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md,
  },
  themeOption: {
    flex: 1,
    alignItems: "center",
    padding: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.bgSecondary,
    gap: 4,
  },
  themeOptionActive: {
    borderColor: colors.gold,
    backgroundColor: colors.gold + "12",
  },
  themeSwatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  themeOptionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  themeOptionSub: {
    fontSize: 10,
    color: colors.textMuted,
    textAlign: "center",
  },

  // Section sub-header inside notification card
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    gap: 6,
  },
  sectionHeaderIcon: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: colors.gold + "18",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionHeaderEn: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.gold,
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  sectionHeaderHi: { fontSize: 11, color: colors.gold + "90" },

  // Loading
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
  },
  loadingTxt: { fontSize: typography.fontSize.sm, color: colors.textMuted },

  // Permission banner
  permBanner: {
    flexDirection: "row",
    alignItems: "center",
    margin: spacing.md,
    backgroundColor: "#F59E0B18",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#F59E0B40",
    padding: spacing.md,
  },
  permBannerTitle: {
    fontSize: typography.fontSize.sm,
    color: "#F59E0B",
    fontWeight: "600",
  },
  permBannerSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },

  // Toggle row
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    gap: spacing.sm,
  },
  toggleIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleLabels: { flex: 1 },
  toggleLabelEn: {
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
    fontWeight: "600",
  },
  toggleSub: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  toggleLabelHi: { fontSize: 10, color: colors.gold + "99", marginTop: 1 },

  // Time row
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: spacing.md,
    marginBottom: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    backgroundColor: colors.gold + "0A",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.gold + "25",
    gap: 6,
  },
  timeRowLabel: { flex: 1, fontSize: 12, color: colors.textMuted },
  timePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.gold + "18",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  timePillTxt: {
    fontSize: 13,
    color: colors.gold,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },

  // Weekday picker
  pickerLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginHorizontal: spacing.md,
    marginTop: 4,
    marginBottom: 4,
  },
  weekdayRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.md,
    gap: 4,
    marginBottom: 6,
  },
  dayBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 5,
    backgroundColor: colors.bgSecondary,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  dayBtnActive: {
    backgroundColor: colors.gold + "20",
    borderColor: colors.gold,
  },
  dayBtnTxt: { fontSize: 9, color: colors.textMuted, fontWeight: "600" },
  dayBtnHi: { fontSize: 8, color: colors.textMuted },
  dayBtnTxtActive: { color: colors.gold },

  // Days before row
  daysBeforeRow: { paddingHorizontal: spacing.md, marginBottom: 6 },
  daysBeforeBtns: { flexDirection: "row", gap: spacing.sm, marginTop: 4 },
  daysBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.bgSecondary,
  },
  daysBtnActive: {
    backgroundColor: colors.gold + "20",
    borderColor: colors.gold,
  },
  daysBtnTxt: { fontSize: 12, color: colors.textMuted, fontWeight: "600" },
  daysBtnTxtActive: { color: colors.gold },

  // Personalized placeholder
  personalizedBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    backgroundColor: colors.bgSecondary,
    borderRadius: 10,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  personalizedTxt: {
    flex: 1,
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
  },

  // ── Info row (about) ──
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: spacing.md,
  },
  infoText: { flex: 1, marginLeft: spacing.md },
  infoLabelRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    marginBottom: 3,
  },
  infoLabelEn: {
    fontSize: typography.fontSize.sm,
    fontWeight: "700",
    color: colors.gold,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  infoLabelHi: { fontSize: 11, color: colors.gold + "AA" },
  infoValueEn: {
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
    lineHeight: typography.fontSize.md * 1.5,
  },
  infoValueHi: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
    lineHeight: 18,
  },

  // ── Link row ──
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider + "60",
  },
  linkIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  linkText: { flex: 1 },
  linkLabelRow: { flexDirection: "row", alignItems: "baseline", gap: 7 },
  linkLabelEn: {
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
    fontWeight: "600",
  },
  linkLabelHi: { fontSize: 11, color: colors.gold + "BB" },
  linkSub: {
    fontSize: typography.fontSize.sm,
    color: colors.textMuted,
    marginTop: 2,
  },

  // ── Developer compact ──
  devCompact: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    gap: spacing.md,
  },
  devAvatarSm: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.gold + "20",
    borderWidth: 1.5,
    borderColor: colors.gold + "50",
    alignItems: "center",
    justifyContent: "center",
  },
  devNameSm: {
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
    fontWeight: "700",
  },
  devNameHiSm: { fontSize: 12, color: colors.gold },
  devRoleSm: { fontSize: 11, color: colors.textMuted, marginTop: 2 },

  // ── Footer ──
  footer: {
    alignItems: "center",
    paddingVertical: spacing.xl,
    gap: 4,
    marginTop: spacing.md,
  },
  footerOm: { fontSize: typography.fontSize.display, color: colors.gold },
  footerMain: {
    fontSize: typography.fontSize.lg,
    color: colors.textPrimary,
    fontWeight: typography.fontWeight.bold,
    marginTop: spacing.xs,
  },
  footerSub: { fontSize: typography.fontSize.md, color: colors.gold + "CC" },
  footerMantra: {
    fontSize: typography.fontSize.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  });
}

// ─────────────────────────────────────────────
// TIME PICKER MODAL STYLES (theme-dependent)
// ─────────────────────────────────────────────
function makeTp(colors: ThemeColors, spacing: Record<string, number>, typography: any) {
  return StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
  },
  sheet: {
    backgroundColor: colors.bgSecondary,
    borderRadius: 20,
    width: 280,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.gold + "30",
    alignItems: "center",
  },
  title: {
    fontSize: typography.fontSize.lg,
    color: colors.gold,
    fontWeight: "bold",
    marginBottom: spacing.lg,
    textAlign: "center",
  },
  pickers: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: spacing.lg,
  },
  wheel: { alignItems: "center", gap: 4 },
  arrow: { padding: 6 },
  digit: {
    fontSize: 44,
    color: colors.textPrimary,
    fontWeight: "bold",
    minWidth: 72,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  unit: { fontSize: 10, color: colors.textMuted, fontWeight: "600" },
  colon: {
    fontSize: 40,
    color: colors.gold,
    fontWeight: "bold",
    marginBottom: 16,
  },
  actions: { flexDirection: "row", gap: spacing.md, width: "100%" },
  cancelBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: "center",
  },
  cancelTxt: {
    fontSize: typography.fontSize.sm,
    color: colors.textMuted,
    fontWeight: "600",
  },
  confirmBtn: {
    flex: 2,
    paddingVertical: spacing.sm,
    borderRadius: 10,
    backgroundColor: colors.gold,
    alignItems: "center",
  },
  confirmTxt: {
    fontSize: typography.fontSize.sm,
    color: colors.bgSecondary,
    fontWeight: "bold",
  },
  });
}
