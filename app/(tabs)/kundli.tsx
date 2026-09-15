/**
 * KundliScreen.tsx  — v3 COMPLETE REWRITE
 *
 * ✅ Proper North-Indian 4×4 grid Kundli chart (no SVG needed)
 * ✅ DateTimePicker for date + time
 * ✅ Extra details: Choghadiya, Muhurtas, Rahu Kalam, Sunrise/Sunset
 * ✅ PDF export via expo-print + expo-sharing (both Kundli and Matching)
 * ✅ Gold theme, bilingual labels
 *
 * Install deps:
 *   npx expo install @react-native-community/datetimepicker expo-print expo-sharing
 */

import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { GradientBackground } from "../../components/GradientBackground";
import { useTheme, ThemeColors, spacing, typography } from "../../theme";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { GooglePlacesAutocomplete } from "react-native-google-places-autocomplete";
import {
  getPanchangam,
  Observer,
  rashiNames,
  nakshatraNames,
  tithiNames,
  yogaNames,
} from "@ishubhamx/panchangam-js";

const { width: SW } = Dimensions.get("window");
const TZ_OFFSET = new Date().getTimezoneOffset() * -1;

// ─────────────────────────────────────────────
// SHARED THEME-AWARE STYLES
// (built once per theme change, shared by every atom in this file)
// ─────────────────────────────────────────────
function useKundliStyles() {
  const { colors, spacing, typography } = useTheme();
  const st = useMemo(
    () => makeStyles(colors, spacing, typography),
    [colors, spacing, typography],
  );
  const ch = useMemo(
    () => makeChStyles(colors, spacing, typography),
    [colors, spacing, typography],
  );
  return { colors, spacing, typography, st, ch };
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const RASHI_HI = [
  "मेष",
  "वृषभ",
  "मिथुन",
  "कर्क",
  "सिंह",
  "कन्या",
  "तुला",
  "वृश्चिक",
  "धनु",
  "मकर",
  "कुम्भ",
  "मीन",
];
const RASHI_EN = [
  "Aries",
  "Taurus",
  "Gemini",
  "Cancer",
  "Leo",
  "Virgo",
  "Libra",
  "Scorpio",
  "Sagittarius",
  "Capricorn",
  "Aquarius",
  "Pisces",
];
const RASHI_SYM = [
  "♈",
  "♉",
  "♊",
  "♋",
  "♌",
  "♍",
  "♎",
  "♏",
  "♐",
  "♑",
  "♒",
  "♓",
];
const PLANET_EN = [
  "Sun",
  "Moon",
  "Mars",
  "Mercury",
  "Jupiter",
  "Venus",
  "Saturn",
  "Rahu",
  "Ketu",
];
const PLANET_HI = [
  "सूर्य",
  "चन्द्र",
  "मंगल",
  "बुध",
  "बृहस्पति",
  "शुक्र",
  "शनि",
  "राहु",
  "केतु",
];
const PLANET_KEY = [
  "sun",
  "moon",
  "mars",
  "mercury",
  "jupiter",
  "venus",
  "saturn",
  "rahu",
  "ketu",
];
const PLANET_ABR = ["Su", "Mo", "Ma", "Me", "Ju", "Ve", "Sa", "Ra", "Ke"];
const PLANET_ICON_TXT = ["☀️", "🌙", "🔴", "🟢", "🟡", "⚪", "⚫", "🌑", "🔱"];
const NAKSHATRA_HI = [
  "अश्विनी",
  "भरणी",
  "कृत्तिका",
  "रोहिणी",
  "मृगशिरा",
  "आर्द्रा",
  "पुनर्वसु",
  "पुष्य",
  "अश्लेषा",
  "मघा",
  "पूर्व फाल्गुनी",
  "उत्तर फाल्गुनी",
  "हस्त",
  "चित्रा",
  "स्वाती",
  "विशाखा",
  "अनुराधा",
  "ज्येष्ठा",
  "मूल",
  "पूर्व आषाढ़ा",
  "उत्तर आषाढ़ा",
  "श्रवण",
  "धनिष्ठा",
  "शतभिषा",
  "पूर्व भाद्रपदा",
  "उत्तर भाद्रपदा",
  "रेवती",
];
const TITHI_HI = [
  "प्रतिपदा",
  "द्वितीया",
  "तृतीया",
  "चतुर्थी",
  "पञ्चमी",
  "षष्ठी",
  "सप्तमी",
  "अष्टमी",
  "नवमी",
  "दशमी",
  "एकादशी",
  "द्वादशी",
  "त्रयोदशी",
  "चतुर्दशी",
  "पूर्णिमा",
  "प्रतिपदा",
  "द्वितीया",
  "तृतीया",
  "चतुर्थी",
  "पञ्चमी",
  "षष्ठी",
  "सप्तमी",
  "अष्टमी",
  "नवमी",
  "दशमी",
  "एकादशी",
  "द्वादशी",
  "त्रयोदशी",
  "चतुर्दशी",
  "अमावस्या",
];
const VARNA = [
  "Kshatriya",
  "Vaishya",
  "Shudra",
  "Brahmin",
  "Kshatriya",
  "Vaishya",
  "Shudra",
  "Brahmin",
  "Kshatriya",
  "Vaishya",
  "Shudra",
  "Brahmin",
];
const NADI = Array.from({ length: 27 }, (_, i) =>
  i % 3 === 0 ? "Aadi" : i % 3 === 1 ? "Madhya" : "Antya",
);
const GANA = [
  "Deva",
  "Manushya",
  "Rakshasa",
  "Manushya",
  "Manushya",
  "Rakshasa",
  "Deva",
  "Deva",
  "Rakshasa",
  "Rakshasa",
  "Manushya",
  "Manushya",
  "Deva",
  "Rakshasa",
  "Deva",
  "Rakshasa",
  "Deva",
  "Rakshasa",
  "Rakshasa",
  "Manushya",
  "Manushya",
  "Deva",
  "Rakshasa",
  "Rakshasa",
  "Manushya",
  "Manushya",
  "Deva",
];
const DASHA_COLORS = [
  "#F4D160",
  "#60A5FA",
  "#F472B6",
  "#86EFAC",
  "#FB923C",
  "#818CF8",
  "#FBBF24",
  "#34D399",
  "#EF4444",
];
const KOOTA_DATA = [
  { en: "Varna", hi: "वर्ण", max: 1 },
  { en: "Vasya", hi: "वास्य", max: 2 },
  { en: "Tara", hi: "तारा", max: 3 },
  { en: "Yoni", hi: "योनि", max: 4 },
  { en: "Maitri", hi: "ग्रह मैत्री", max: 5 },
  { en: "Gana", hi: "गण", max: 6 },
  { en: "Bhakoot", hi: "भकूट", max: 7 },
  { en: "Nadi", hi: "नाड़ी", max: 8 },
];

// ─────────────────────────────────────────────────────────────────────────────
// NORTH-INDIAN KUNDLI CHART
// Classic 4×4 grid: houses 12,1,2,3 | 11,center,4 | 10,center,5 | 9,8,7,6
// ─────────────────────────────────────────────────────────────────────────────

const CHART_SIZE = SW - spacing.md * 2 - 4;
const CELL = Math.floor(CHART_SIZE / 4);

interface ChartProps {
  data: any; // full panchangam data
  lagna: number;
}

const NorthIndianKundli: React.FC<ChartProps> = ({ data, lagna }) => {
  const { ch } = useKundliStyles();
  // Build house → planet abbreviations map
  const housePlanets: Record<number, string[]> = {};
  for (let h = 1; h <= 12; h++) housePlanets[h] = [];

  PLANET_KEY.forEach((key, idx) => {
    const rashi = data?.planetaryPositions?.[key]?.rashi ?? -1;
    if (rashi < 0) return;
    const house = ((rashi - lagna + 12) % 12) + 1;
    housePlanets[house].push(PLANET_ABR[idx]);
  });

  const rashiOf = (h: number) => (lagna + h - 2 + 12) % 12;

  const Cell = ({ h, w, ht }: { h: number; w: number; ht: number }) => {
    const r = rashiOf(h);
    const ps = housePlanets[h] ?? [];
    const isLagna = h === 1;
    return (
      <View
        style={[ch.cell, { width: w, height: ht }, isLagna && ch.lagnaCell]}
      >
        <Text style={ch.hNum}>{h}</Text>
        <Text style={ch.sym}>{RASHI_SYM[r]}</Text>
        <Text style={ch.rhi} numberOfLines={1}>
          {RASHI_HI[r]}
        </Text>
        {ps.length > 0 && (
          <Text style={ch.pln} numberOfLines={2}>
            {ps.join(" ")}
          </Text>
        )}
      </View>
    );
  };

  return (
    <View style={{ alignSelf: "center", marginBottom: 28 }}>
      <View style={[ch.outer, { width: CHART_SIZE, height: CHART_SIZE }]}>
        {/* Row 0: 12, 1, 2, 3 */}
        <View style={ch.row}>
          <Cell h={12} w={CELL} ht={CELL} />
          <Cell h={1} w={CELL} ht={CELL} />
          <Cell h={2} w={CELL} ht={CELL} />
          <Cell h={3} w={CELL} ht={CELL} />
        </View>
        {/* Row 1: 11, CENTER(2w), 4 */}
        <View style={ch.row}>
          <Cell h={11} w={CELL} ht={CELL} />
          <View style={[ch.centerHalf, { width: CELL * 2, height: CELL }]}>
            <View style={ch.diagLine1} />
            <View style={ch.diagLine2} />
            <Text style={ch.centerOM}>ॐ</Text>
          </View>
          <Cell h={4} w={CELL} ht={CELL} />
        </View>
        {/* Row 2: 10, CENTER(2w), 5 */}
        <View style={ch.row}>
          <Cell h={10} w={CELL} ht={CELL} />
          <View
            style={[ch.centerHalfBottom, { width: CELL * 2, height: CELL }]}
          >
            <View style={ch.diagLine3} />
            <View style={ch.diagLine4} />
            <Text style={ch.centerKundli}>कुण्डली</Text>
          </View>
          <Cell h={5} w={CELL} ht={CELL} />
        </View>
        {/* Row 3: 9, 8, 7, 6 */}
        <View style={ch.row}>
          <Cell h={9} w={CELL} ht={CELL} />
          <Cell h={8} w={CELL} ht={CELL} />
          <Cell h={7} w={CELL} ht={CELL} />
          <Cell h={6} w={CELL} ht={CELL} />
        </View>
      </View>

      {/* Lagna bar */}
      <View style={ch.lagnaBar}>
        <Text style={ch.lagnaBarTxt}>
          लग्न · {RASHI_HI[lagna]} {RASHI_SYM[lagna]} · {RASHI_EN[lagna]}
        </Text>
      </View>
    </View>
  );
};

function makeChStyles(
  colors: ThemeColors,
  spacing: Record<string, number>,
  typography: any,
) {
  return StyleSheet.create({
  outer: {
    borderWidth: 2,
    borderColor: colors.gold + "70",
    overflow: "hidden",
    backgroundColor: colors.bgSecondary,
  },
  row: { flexDirection: "row" },
  cell: {
    borderWidth: 0.5,
    borderColor: colors.gold + "35",
    backgroundColor: colors.cardBg + "55",
    padding: 3,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  lagnaCell: {
    backgroundColor: colors.gold + "1C",
    borderColor: colors.gold,
    borderWidth: 1.5,
  },
  hNum: {
    position: "absolute",
    top: 2,
    left: 3,
    fontSize: 7,
    color: colors.textMuted,
  },
  sym: { fontSize: CELL > 70 ? 15 : 12, color: colors.gold },
  rhi: {
    fontSize: CELL > 70 ? 8 : 7,
    color: colors.gold + "CC",
    fontWeight: "600",
    textAlign: "center",
  },
  pln: {
    fontSize: CELL > 70 ? 9 : 8,
    color: colors.textPrimary,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 12,
    marginTop: 1,
  },

  // Center cells (2×1)
  centerHalf: {
    borderWidth: 0.5,
    borderColor: colors.gold + "30",
    backgroundColor: colors.bgSecondary + "CC",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
  },
  centerHalfBottom: {
    borderWidth: 0.5,
    borderColor: colors.gold + "30",
    backgroundColor: colors.bgSecondary + "CC",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
  },
  // Diagonal cross lines for center diamond
  diagLine1: {
    position: "absolute",
    top: 0,
    left: 0,
    width: CELL * 2,
    height: 1,
    backgroundColor: colors.gold + "40",
    transform: [{ rotate: "45deg" }, { translateY: CELL * 0.5 }],
  },
  diagLine2: {
    position: "absolute",
    top: 0,
    right: 0,
    width: CELL * 2,
    height: 1,
    backgroundColor: colors.gold + "40",
    transform: [{ rotate: "-45deg" }, { translateY: CELL * 0.5 }],
  },
  diagLine3: {
    position: "absolute",
    bottom: 0,
    left: 0,
    width: CELL * 2,
    height: 1,
    backgroundColor: colors.gold + "40",
    transform: [{ rotate: "-45deg" }, { translateY: -CELL * 0.5 }],
  },
  diagLine4: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: CELL * 2,
    height: 1,
    backgroundColor: colors.gold + "40",
    transform: [{ rotate: "45deg" }, { translateY: -CELL * 0.5 }],
  },
  centerOM: {
    fontSize: 22,
    color: colors.gold + "AA",
    fontWeight: "bold",
    position: "absolute",
  },
  centerKundli: {
    fontSize: 10,
    color: colors.gold + "99",
    fontWeight: "600",
    letterSpacing: 0.5,
    position: "absolute",
  },
  lagnaBar: {
    marginTop: 6,
    backgroundColor: colors.gold + "12",
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.gold + "25",
  },
  lagnaBarTxt: { fontSize: 11, color: colors.gold, fontWeight: "600" },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

interface BirthData {
  name: string;
  date: Date;
  lat: string;
  lng: string;
  place: string;
}

const EMPTY_FORM: BirthData = {
  name: "",
  date: new Date(1990, 0, 1, 12, 0, 0),
  lat: "28.6139",
  lng: "77.2090",
  place: "New Delhi",
};

function validateForm(f: BirthData): string | null {
  if (!f.date || isNaN(f.date.getTime()))
    return "कृपया जन्म तिथि चुनें · Select birth date";
  if (!f.lat || !f.lng) return "कृपया जन्म स्थान चुनें · Select birth place";
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// SMALL UI ATOMS
// ─────────────────────────────────────────────────────────────────────────────

const SecDiv = ({ en, hi }: { en: string; hi: string }) => {
  const { st } = useKundliStyles();
  return (
    <View style={st.secDiv}>
      <View style={st.secLine} />
      <View style={st.secPill}>
        <Text style={st.secHi}>{hi}</Text>
        <Text style={st.secEn}> · {en}</Text>
      </View>
      <View style={st.secLine} />
    </View>
  );
};

const InfoRow = ({
  icon,
  labelEn,
  labelHi,
  valueEn,
  valueHi,
  accent,
}: {
  icon?: string;
  labelEn: string;
  labelHi: string;
  valueEn: string;
  valueHi?: string;
  accent?: boolean;
}) => {
  const { st } = useKundliStyles();
  return (
    <View style={st.infoRow}>
      {icon ? (
        <Text style={st.infoIcon}>{icon}</Text>
      ) : (
        <View style={{ width: 22 }} />
      )}
      <View style={st.infoLabels}>
        <Text style={st.infoLHi}>{labelHi}</Text>
        <Text style={st.infoLEn}>{labelEn}</Text>
      </View>
      <View style={st.infoVals}>
        <Text style={[st.infoVEn, accent && st.accent]}>{valueEn}</Text>
        {valueHi ? <Text style={st.infoVHi}>{valueHi}</Text> : null}
      </View>
    </View>
  );
};

const fmtTime = (d: any): string => {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DATE + TIME PICKER FIELDS
// ─────────────────────────────────────────────────────────────────────────────

const DateTimeFields: React.FC<{ date: Date; onChange: (d: Date) => void }> = ({
  date,
  onChange,
}) => {
  const { colors, st } = useKundliStyles();
  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);

  const fmtDate = (d: Date) =>
    `${String(d.getDate()).padStart(2, "0")} / ${String(d.getMonth() + 1).padStart(2, "0")} / ${d.getFullYear()}`;
  const fmtTimeFmt = (d: Date) =>
    `${String(d.getHours()).padStart(2, "0")} : ${String(d.getMinutes()).padStart(2, "0")}`;

  return (
    <View style={st.formRow}>
      <Text style={st.formLabel}>
        जन्म तिथि व समय · Date & Time{" "}
        <Text style={{ color: "#EF4444" }}>*</Text>
      </Text>
      <View style={st.formDouble}>
        <TouchableOpacity
          style={[st.pickerBtn, { flex: 1 }]}
          onPress={() => setShowDate(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="calendar-outline" size={14} color={colors.gold} />
          <Text style={st.pickerTxt}>{fmtDate(date)}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[st.pickerBtn, { minWidth: 90 }]}
          onPress={() => setShowTime(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="time-outline" size={14} color={colors.gold} />
          <Text style={st.pickerTxt}>{fmtTimeFmt(date)}</Text>
        </TouchableOpacity>
      </View>

      {showDate && (
        <DateTimePicker
          value={date}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          maximumDate={new Date()}
          minimumDate={new Date(1900, 0, 1)}
          onChange={(_: any, sel?: Date) => {
            setShowDate(Platform.OS === "ios");
            if (sel) {
              const m = new Date(sel);
              m.setHours(date.getHours(), date.getMinutes());
              onChange(m);
            }
          }}
        />
      )}
      {showTime && (
        <DateTimePicker
          value={date}
          mode="time"
          is24Hour={true}
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(_: any, sel?: Date) => {
            setShowTime(Platform.OS === "ios");
            if (sel) {
              const m = new Date(date);
              m.setHours(sel.getHours(), sel.getMinutes());
              onChange(m);
            }
          }}
        />
      )}
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// BIRTH FORM
// ─────────────────────────────────────────────────────────────────────────────

const BirthForm: React.FC<{
  form: BirthData;
  setForm: React.Dispatch<React.SetStateAction<BirthData>>;
  onGenerate?: () => void;
  loading: boolean;
  compact?: boolean;
  noGenerate?: boolean;
  btnLabel?: string;
}> = ({
  form,
  setForm,
  onGenerate,
  loading,
  compact,
  noGenerate,
  btnLabel,
}) => {
  const { colors, st } = useKundliStyles();
  return (
  <KeyboardAvoidingView
    behavior={Platform.OS === "ios" ? "padding" : undefined}
  >
    <View style={[st.formCard, compact && st.formCardCompact]}>
      {!compact && (
        <View style={st.formRow}>
          <Text style={st.formLabel}>नाम · Name</Text>
          <TextInput
            style={st.input}
            placeholder="Enter name"
            placeholderTextColor={colors.textMuted}
            value={form.name}
            onChangeText={(v) => setForm((p) => ({ ...p, name: v }))}
          />
        </View>
      )}

      <DateTimeFields
        date={form.date}
        onChange={(d) => setForm((p) => ({ ...p, date: d }))}
      />

      <View style={st.formRow}>
        <Text style={st.formLabel}>
          स्थान · Location <Text style={{ color: "#EF4444" }}>*</Text>
        </Text>
        <GooglePlacesAutocomplete
          placeholder="Search city…"
          minLength={3}
          fetchDetails={true}
          onPress={(data, details = null) => {
            setForm((p) => ({
              ...p,
              place: data.description,
              lat: String(details?.geometry.location.lat ?? p.lat),
              lng: String(details?.geometry.location.lng ?? p.lng),
            }));
          }}
          query={{
            key: "AIzaSyBOSKUAAlSxejC94KZURRcCaZR3IMp2PLU",
            language: "en",
            types: "(cities)",
          }}
          listViewDisplayed="auto"
          listViewProps={{ scrollEnabled: false, nestedScrollEnabled: false }}
          keyboardShouldPersistTaps="handled"
          styles={{
            textInput: {
              backgroundColor: colors.bgSecondary,
              color: colors.textPrimary,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: colors.cardBorder,
              paddingHorizontal: 10,
            },
            listView: {
              backgroundColor: colors.cardBg,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: colors.cardBorder,
            },
            row: { backgroundColor: colors.cardBg },
            description: { color: colors.textPrimary },
          }}
        />
        <Text
          style={{
            fontSize: 11,
            color: form.place ? colors.gold : "#EF4444",
            marginTop: 4,
          }}
        >
          {form.place ? `📍 ${form.place}` : "स्थान चुनना अनिवार्य है"}
        </Text>
      </View>

      {!noGenerate && (
        <TouchableOpacity
          style={st.generateBtn}
          onPress={onGenerate}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color={colors.bgSecondary} size="small" />
          ) : (
            <Text style={st.generateBtnTxt}>
              {btnLabel ?? "कुंडली बनाएं · Generate Kundli"}
            </Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  </KeyboardAvoidingView>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// CHOGHADIYA SECTION
// ─────────────────────────────────────────────────────────────────────────────

const ChoghadiyaSection: React.FC<{ data: any }> = ({ data }) => {
  const { st } = useKundliStyles();
  const [showNight, setShowNight] = useState(false);
  const list = showNight ? data?.choghadiya?.night : data?.choghadiya?.day;
  if (!list?.length) return null;

  const rc = (r: string) =>
    r === "good" ? "#22C55E" : r === "neutral" ? "#FBBF24" : "#EF4444";

  return (
    <>
      <View style={st.chogTabs}>
        {[
          { label: "☀️ Day", val: false },
          { label: "🌙 Night", val: true },
        ].map((t) => (
          <TouchableOpacity
            key={t.label}
            style={[st.chogTab, showNight === t.val && st.chogTabActive]}
            onPress={() => setShowNight(t.val)}
          >
            <Text
              style={[
                st.chogTabTxt,
                showNight === t.val && st.chogTabTxtActive,
              ]}
            >
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {list.map((item: any, i: number) => (
        <View key={i} style={st.chogRow}>
          <View style={[st.chogDot, { backgroundColor: rc(item.rating) }]} />
          <View style={{ flex: 1 }}>
            <Text style={st.chogName}>{item.name}</Text>
            <Text style={st.chogTime}>
              {fmtTime(item.startTime)} – {fmtTime(item.endTime)}
            </Text>
          </View>
          <Text style={[st.chogRating, { color: rc(item.rating) }]}>
            {item.rating}
          </Text>
        </View>
      ))}
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// GUN MILAN
// ─────────────────────────────────────────────────────────────────────────────

function gunMilan(
  boyRashi: number,
  girlRashi: number,
  boyNak: number,
  girlNak: number,
) {
  const kootas = new Array(8).fill(0);
  kootas[0] = VARNA[boyRashi] === VARNA[girlRashi] ? 1 : 0;
  const rd = (girlRashi - boyRashi + 12) % 12;
  kootas[1] = rd <= 6 ? 2 : 1;
  const td = Math.abs(boyNak - girlNak) % 9;
  kootas[2] = td < 3 ? 3 : td < 6 ? 1 : 0;
  kootas[3] = boyNak % 3 === girlNak % 3 ? 4 : 2;
  kootas[4] = rd <= 4 ? 5 : 2;
  kootas[5] = GANA[boyNak] === GANA[girlNak] ? 6 : 3;
  kootas[6] = [2, 6, 8, 12].includes(rd) ? 0 : 7;
  kootas[7] = NADI[boyNak] === NADI[girlNak] ? 0 : 8;
  return {
    kootas,
    total: kootas.reduce((a, b) => a + b, 0),
    details: {
      boyVarna: VARNA[boyRashi],
      girlVarna: VARNA[girlRashi],
      boyGana: GANA[boyNak],
      girlGana: GANA[girlNak],
      boyNadi: NADI[boyNak],
      girlNadi: NADI[girlNak],
      bhakootDist: rd,
    },
  };
}

const scoreBg = (s: number) =>
  s >= 27 ? "#22C55E" : s >= 18 ? "#FBBF24" : "#EF4444";
const scoreVerdict = (s: number) =>
  s >= 28
    ? "उत्तम मेल · Excellent 🌟"
    : s >= 21
      ? "अच्छा मेल · Good ✅"
      : s >= 18
        ? "औसत मेल · Average ⚠️"
        : "कम अनुकूलता · Low ❌";

const MangalDosha = ({ data, label }: { data: any; label: string }) => {
  const { st } = useKundliStyles();
  const marsRashi = data?.planetaryPositions?.mars?.rashi ?? -1;
  const lagna = data?.lagna ?? data?.planetaryPositions?.sun?.rashi ?? 0;
  const house = ((marsRashi - lagna + 12) % 12) + 1;
  const has = [1, 4, 7, 8, 12].includes(house);
  return (
    <View style={st.doshaItem}>
      <Text style={st.doshaLabel}>{label}</Text>
      <Text style={[st.doshaResult, { color: has ? "#EF4444" : "#22C55E" }]}>
        {has ? "⚠️ मांगलिक" : "✅ मांगलिक नहीं"}
      </Text>
      <Text style={st.doshaSub}>Mars in house {house}</Text>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// PDF EXPORT
// ─────────────────────────────────────────────────────────────────────────────

function planetRowsHtml(data: any): string {
  return PLANET_KEY.map((key, i) => {
    const pd = data?.planetaryPositions?.[key];
    if (!pd) return "";
    const r = pd.rashi ?? 0;
    return `<tr><td>${PLANET_EN[i]} (${PLANET_HI[i]})</td><td>${RASHI_EN[r]} (${RASHI_HI[r]}) ${RASHI_SYM[r]}</td><td>${pd.degree?.toFixed(2) ?? "—"}°</td></tr>`;
  }).join("");
}

function houseCell(
  h: number,
  lagna: number,
  housePlanets: Record<number, string[]>,
): string {
  const r = (lagna + h - 2 + 12) % 12;
  const ps = housePlanets[h]?.join(" ") ?? "";
  const bg = h === 1 ? "#c9922a18" : "#181008";
  const border =
    h === 1 ? "border:1.5px solid #c9922a" : "border:1px solid #c9922a33";
  return `<td style="${border};background:${bg};padding:8px;vertical-align:top;min-width:68px;min-height:68px;text-align:center">
    <div style="font-size:9px;color:#666">${h}</div>
    <div style="font-size:14px;color:#f4d160">${RASHI_SYM[r]}</div>
    <div style="font-size:9px;color:#c9922a">${RASHI_HI[r]}</div>
    <div style="font-size:11px;color:#eee;font-weight:700">${ps}</div>
  </td>`;
}

function buildKundliHtml(form: BirthData, data: any, title: string): string {
  const lagna = data?.lagna ?? data?.planetaryPositions?.sun?.rashi ?? 0;
  const hp: Record<number, string[]> = {};
  for (let h = 1; h <= 12; h++) hp[h] = [];
  PLANET_KEY.forEach((key, idx) => {
    const rashi = data?.planetaryPositions?.[key]?.rashi ?? -1;
    if (rashi < 0) return;
    hp[((rashi - lagna + 12) % 12) + 1].push(PLANET_ABR[idx]);
  });

  return `
    <h2 style="color:#c9922a;border-bottom:1px solid #c9922a44;padding-bottom:6px">${title}</h2>
    <p style="color:#a09070;font-size:13px"><strong style="color:#f4d160">${form.name || "जातक"}</strong> &nbsp;·&nbsp;
    ${form.date.toLocaleString("en-IN", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })} &nbsp;·&nbsp; 📍 ${form.place}</p>

    <h3 style="color:#c9922a;font-size:14px;margin:18px 0 8px">जन्म कुण्डली · Birth Chart</h3>
    <table style="border-collapse:collapse;margin:0 auto 20px">
      <tr>${houseCell(12, lagna, hp)}${houseCell(1, lagna, hp)}${houseCell(2, lagna, hp)}${houseCell(3, lagna, hp)}</tr>
      <tr>${houseCell(11, lagna, hp)}
        <td colspan="2" style="background:#0d0a06;text-align:center;vertical-align:middle;border:1px solid #c9922a33">
          <div style="font-size:28px;color:#f4d16066">ॐ</div>
          <div style="font-size:11px;color:#c9922a">कुण्डली</div>
          <div style="font-size:10px;color:#888">Lagna: ${RASHI_HI[lagna]} ${RASHI_SYM[lagna]}</div>
        </td>${houseCell(4, lagna, hp)}</tr>
      <tr>${houseCell(10, lagna, hp)}<td colspan="2" style="border:1px solid #c9922a22;background:#0d0a06"></td>${houseCell(5, lagna, hp)}</tr>
      <tr>${houseCell(9, lagna, hp)}${houseCell(8, lagna, hp)}${houseCell(7, lagna, hp)}${houseCell(6, lagna, hp)}</tr>
    </table>

    <h3 style="color:#c9922a;font-size:14px;margin:18px 0 8px">ग्रह स्थिति · Planetary Positions</h3>
    <table style="border-collapse:collapse;width:100%;margin-bottom:16px">
      <tr style="background:#1e1a14"><th style="color:#c9922a;padding:8px;font-size:12px">Planet</th><th style="color:#c9922a;padding:8px">Rashi</th><th style="color:#c9922a;padding:8px">Degree</th></tr>
      ${planetRowsHtml(data)}
    </table>

    <h3 style="color:#c9922a;font-size:14px;margin:18px 0 8px">पञ्चाङ्ग</h3>
    <table style="border-collapse:collapse;width:100%;margin-bottom:16px">
      <tr><td style="padding:6px;border-bottom:1px solid #2e2820;color:#a09070">तिथि</td><td style="padding:6px;border-bottom:1px solid #2e2820">${tithiNames?.[data.tithi] ?? data.tithi} · ${TITHI_HI[data.tithi] ?? ""}</td></tr>
      <tr><td style="padding:6px;border-bottom:1px solid #2e2820;color:#a09070">नक्षत्र</td><td style="padding:6px;border-bottom:1px solid #2e2820">${nakshatraNames?.[data.nakshatra] ?? data.nakshatra} · ${NAKSHATRA_HI[data.nakshatra] ?? ""}</td></tr>
      <tr><td style="padding:6px;border-bottom:1px solid #2e2820;color:#a09070">योग</td><td style="padding:6px;border-bottom:1px solid #2e2820">${yogaNames?.[data.yoga] ?? data.yoga}</td></tr>
      ${data.sunrise ? `<tr><td style="padding:6px;border-bottom:1px solid #2e2820;color:#a09070">सूर्योदय</td><td style="padding:6px;border-bottom:1px solid #2e2820">${fmtTime(data.sunrise)}</td></tr>` : ""}
      ${data.rahuKalamStart ? `<tr><td style="padding:6px;color:#a09070">राहु काल</td><td style="padding:6px">${fmtTime(data.rahuKalamStart)} – ${fmtTime(data.rahuKalamEnd)}</td></tr>` : ""}
    </table>
    ${data.vimshottariDasha?.currentMahadasha ? `<p style="color:#a09070">महादशा: <strong style="color:#f4d160">${data.vimshottariDasha.currentMahadasha.planet}</strong>${data.vimshottariDasha.dashaBalance ? " · " + data.vimshottariDasha.dashaBalance : ""}</p>` : ""}
    ${data.specialYogas?.length ? `<p style="color:#a09070">विशेष योग: <span style="color:#f4d160">${data.specialYogas.join(" · ")}</span></p>` : ""}
  `;
}

const PDF_SHELL = (body: string) => `<!DOCTYPE html><html>
<head><meta charset="UTF-8"/>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari&display=swap');
  body{background:#0d0a06;color:#f0ece4;font-family:'Noto Sans Devanagari',sans-serif;padding:32px}
  h1{color:#f4d160;font-size:22px} table td,table th{font-size:13px}
  .footer{color:#444;font-size:10px;text-align:center;margin-top:40px}
</style></head>
<body>${body}<p class="footer">Sanatan Dharma App · Powered by @ishubhamx/panchangam-js</p>
</body></html>`;

async function sharePDF(html: string) {
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: "application/pdf",
      dialogTitle: "Share Kundli PDF",
    });
  } else {
    await Print.printAsync({ html });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────

export default function KundliScreen() {
  const { colors, st } = useKundliStyles();
  const [tab, setTab] = useState<"kundli" | "matching">("kundli");
  const [form, setForm] = useState<BirthData>({ ...EMPTY_FORM });
  const [form2, setForm2] = useState<BirthData>({
    ...EMPTY_FORM,
    name: "Partner",
  });
  const [data, setData] = useState<any>(null);
  const [data2, setData2] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(true);
  const [expandDasha, setExpandDasha] = useState(false);
  const [exporting, setExporting] = useState(false);

  const calc = useCallback(async (f: BirthData, cb: (d: any) => void) => {
    const err = validateForm(f);
    if (err) {
      setError(err);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const obs = new Observer(Number(f.lat), Number(f.lng), 200);
      cb(getPanchangam(f.date, obs, { timezoneOffset: TZ_OFFSET }));
    } catch (e: any) {
      setError(e.message ?? "Error");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleGenerate = () =>
    calc(form, (d) => {
      setData(d);
      setShowForm(false);
    });
  const handleMatching = async () => {
    const e1 = validateForm(form);
    if (e1) {
      setError(`👨 ${e1}`);
      return;
    }
    const e2 = validateForm(form2);
    if (e2) {
      setError(`👧 ${e2}`);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const obs1 = new Observer(Number(form.lat), Number(form.lng), 200);
      const obs2 = new Observer(Number(form2.lat), Number(form2.lng), 200);
      setData(getPanchangam(form.date, obs1, { timezoneOffset: TZ_OFFSET }));
      setData2(getPanchangam(form2.date, obs2, { timezoneOffset: TZ_OFFSET }));
      setShowForm(false);
    } catch (e: any) {
      setError(e.message ?? "Error");
    } finally {
      setLoading(false);
    }
  };

  const handleExportKundli = async () => {
    if (!data) return;
    setExporting(true);
    await sharePDF(
      PDF_SHELL(
        `<h1>🔮 जन्म कुण्डली</h1>${buildKundliHtml(form, data, `${form.name || "जातक"} — Janma Kundli`)}`,
      ),
    );
    setExporting(false);
  };

  const handleExportMatching = async () => {
    if (!data || !data2) return;
    setExporting(true);
    const score = gunMilan(
      data.planetaryPositions?.moon?.rashi ?? 0,
      data2.planetaryPositions?.moon?.rashi ?? 0,
      data.nakshatra ?? 0,
      data2.nakshatra ?? 0,
    );
    const kootaRows = KOOTA_DATA.map(
      (k, i) =>
        `<tr><td>${k.hi} (${k.en})</td><td>${score.kootas[i]}/${k.max}</td><td style="color:${score.kootas[i] === k.max ? "#22c55e" : score.kootas[i] > 0 ? "#f4d160" : "#ef4444"}">${score.kootas[i] === k.max ? "✅ Full" : score.kootas[i] > 0 ? "⚡ Partial" : "❌"}</td></tr>`,
    ).join("");
    const html = PDF_SHELL(`
      <h1>💑 गुण मिलान · Kundli Matching</h1>
      <div style="text-align:center;margin:20px 0">
        <span style="font-size:64px;color:#f4d160;font-weight:bold">${score.total}</span>
        <span style="font-size:28px;color:#888">/36</span>
        <div style="font-size:16px;color:${scoreBg(score.total)};margin-top:8px;font-weight:bold">${scoreVerdict(score.total)}</div>
      </div>
      <h2 style="color:#c9922a;border-bottom:1px solid #c9922a44;padding-bottom:6px">कूट विवरण</h2>
      <table style="border-collapse:collapse;width:100%;margin-bottom:20px">
        <tr style="background:#1e1a14"><th style="color:#c9922a;padding:8px">Koota</th><th style="color:#c9922a;padding:8px">Score</th><th style="color:#c9922a;padding:8px">Status</th></tr>
        ${kootaRows}
      </table>
      ${buildKundliHtml(form, data, `${form.name || "Boy"} — कुण्डली`)}
      ${buildKundliHtml(form2, data2, `${form2.name || "Girl"} — कुण्डली`)}
    `);
    await sharePDF(html);
    setExporting(false);
  };

  const lagna = data?.lagna ?? data?.planetaryPositions?.sun?.rashi ?? 0;
  const score =
    data && data2
      ? gunMilan(
          data.planetaryPositions?.moon?.rashi ?? 0,
          data2.planetaryPositions?.moon?.rashi ?? 0,
          data.nakshatra ?? 0,
          data2.nakshatra ?? 0,
        )
      : null;

  // All screen content as a single element — passed to FlatList as ListHeaderComponent.
  // This is the standard fix for "VirtualizedList nested inside plain ScrollView":
  // GooglePlacesAutocomplete internally renders a FlatList for its suggestions dropdown,
  // which crashes when it finds a ScrollView ancestor. Using FlatList+ListHeaderComponent
  // means there is no ScrollView ancestor at all.
  const screenContent = (
    <View>
      {/* ══ KUNDLI TAB ══ */}
      {tab === "kundli" && (
        <>
          {showForm ? (
            <BirthForm
              form={form}
              setForm={setForm}
              onGenerate={handleGenerate}
              loading={loading}
            />
          ) : (
            <TouchableOpacity
              style={st.editBar}
              onPress={() => setShowForm(true)}
              activeOpacity={0.8}
            >
              <Text style={st.editBarTxt} numberOfLines={1}>
                ✏️ {form.name || "जातक"} ·{" "}
                {form.date.toLocaleDateString("en-IN")} · {form.place}
              </Text>
              <Ionicons name="chevron-down" size={16} color={colors.gold} />
            </TouchableOpacity>
          )}
          {error ? <Text style={st.errorTxt}>⚠️ {error}</Text> : null}

          {data && !showForm && (
            <>
              {/* CHART */}
              <SecDiv en="Birth Chart" hi="जन्म कुण्डली" />
              <NorthIndianKundli data={data} lagna={lagna} />

              {/* PANCHANG TILES */}
              <SecDiv en="Panchangam" hi="पञ्चाङ्ग" />
              <View style={st.tiles}>
                {[
                  { icon: "🌅", lbl: "Sunrise", val: fmtTime(data.sunrise) },
                  { icon: "🌇", lbl: "Sunset", val: fmtTime(data.sunset) },
                  { icon: "🌙", lbl: "Moonrise", val: fmtTime(data.moonrise) },
                  {
                    icon: "⚡",
                    lbl: "Rahu Kaal",
                    val: `${fmtTime(data.rahuKalamStart)}–${fmtTime(data.rahuKalamEnd)}`,
                  },
                  {
                    icon: "🕉",
                    lbl: "Brahma Muh.",
                    val: `${fmtTime(data.brahmaMuhurta?.start)}–${fmtTime(data.brahmaMuhurta?.end)}`,
                  },
                  {
                    icon: "🌟",
                    lbl: "Abhijit Muh.",
                    val: `${fmtTime(data.abhijitMuhurta?.start)}–${fmtTime(data.abhijitMuhurta?.end)}`,
                  },
                ].map((item) => (
                  <View key={item.lbl} style={st.tile}>
                    <Text style={st.tileIcon}>{item.icon}</Text>
                    <Text style={st.tileLbl}>{item.lbl}</Text>
                    <Text style={st.tileVal}>{item.val}</Text>
                  </View>
                ))}
              </View>

              {/* CORE INFO */}
              <SecDiv en="Birth Details" hi="जन्म विवरण" />
              <InfoRow
                icon="🏠"
                labelEn="Lagna (Ascendant)"
                labelHi="लग्न"
                valueEn={`${RASHI_EN[lagna]} ${RASHI_SYM[lagna]}`}
                valueHi={RASHI_HI[lagna]}
                accent
              />
              <InfoRow
                icon="🌙"
                labelEn="Moon Rashi"
                labelHi="चन्द्र राशि"
                valueEn={RASHI_EN[data.planetaryPositions?.moon?.rashi ?? 0]}
                valueHi={RASHI_HI[data.planetaryPositions?.moon?.rashi ?? 0]}
                accent
              />
              <InfoRow
                icon="☀️"
                labelEn="Sun Rashi"
                labelHi="सूर्य राशि"
                valueEn={RASHI_EN[data.planetaryPositions?.sun?.rashi ?? 0]}
                valueHi={RASHI_HI[data.planetaryPositions?.sun?.rashi ?? 0]}
              />
              <InfoRow
                icon="⭐"
                labelEn="Janma Nakshatra"
                labelHi="जन्म नक्षत्र"
                valueEn={
                  nakshatraNames?.[data.nakshatra] ?? String(data.nakshatra)
                }
                valueHi={NAKSHATRA_HI[data.nakshatra] ?? ""}
              />
              <InfoRow
                icon="📅"
                labelEn="Tithi"
                labelHi="तिथि"
                valueEn={tithiNames?.[data.tithi] ?? String(data.tithi)}
                valueHi={TITHI_HI[data.tithi] ?? ""}
              />
              <InfoRow
                icon="🌀"
                labelEn="Yoga"
                labelHi="योग"
                valueEn={yogaNames?.[data.yoga] ?? String(data.yoga)}
              />
              <InfoRow
                icon="🎲"
                labelEn="Karana"
                labelHi="करण"
                valueEn={String(data.karana ?? "")}
              />
              <InfoRow
                icon="📆"
                labelEn="Vara"
                labelHi="वार"
                valueEn={String(data.vara ?? "")}
              />
              {data.hora && (
                <InfoRow
                  icon="⏱"
                  labelEn="Birth Hora"
                  labelHi="होरा"
                  valueEn={String(data.hora)}
                  accent
                />
              )}

              {/* PLANETS */}
              <SecDiv en="Planetary Positions" hi="ग्रह स्थिति" />
              {PLANET_KEY.map((key, i) => {
                const pd = data.planetaryPositions?.[key];
                if (!pd) return null;
                const r = pd.rashi ?? 0;
                return (
                  <InfoRow
                    key={key}
                    icon={PLANET_ICON_TXT[i]}
                    labelEn={PLANET_EN[i]}
                    labelHi={PLANET_HI[i]}
                    valueEn={`${RASHI_EN[r]}  ${pd.degree?.toFixed(2) ?? "—"}°`}
                    valueHi={RASHI_HI[r]}
                  />
                );
              })}

              {/* CHOGHADIYA */}
              {data.choghadiya && (
                <>
                  <SecDiv en="Choghadiya" hi="चौघड़िया" />
                  <ChoghadiyaSection data={data} />
                </>
              )}

              {/* DASHA */}
              {data.vimshottariDasha && (
                <>
                  <SecDiv en="Vimshottari Dasha" hi="विम्शोत्तरी दशा" />
                  <TouchableOpacity
                    style={st.dashaHdr}
                    onPress={() => setExpandDasha((v) => !v)}
                    activeOpacity={0.8}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={st.dashaPlnt}>
                        🔮{" "}
                        {data.vimshottariDasha.currentMahadasha?.planet ?? "—"}
                      </Text>
                      <Text style={st.dashaHi}>महादशा · Mahadasha</Text>
                      {data.vimshottariDasha.dashaBalance && (
                        <Text style={st.dashaBal}>
                          ⏳ {data.vimshottariDasha.dashaBalance} remaining
                        </Text>
                      )}
                    </View>
                    <Ionicons
                      name={expandDasha ? "chevron-up" : "chevron-down"}
                      size={20}
                      color={colors.gold}
                    />
                  </TouchableOpacity>
                  {expandDasha && data.vimshottariDasha.antardashas && (
                    <View style={st.antarBox}>
                      <Text style={st.antarTitle}>अंतर्दशा · Antardashas</Text>
                      {data.vimshottariDasha.antardashas.map(
                        (ad: any, i: number) => (
                          <View key={i} style={st.antarRow}>
                            <View
                              style={[
                                st.antarDot,
                                { backgroundColor: DASHA_COLORS[i % 9] },
                              ]}
                            />
                            <Text style={st.antarName}>{ad.planet}</Text>
                            <Text style={st.antarDate}>
                              {ad.startDate
                                ? new Date(ad.startDate).toLocaleDateString(
                                    "en-IN",
                                    {
                                      day: "2-digit",
                                      month: "short",
                                      year: "2-digit",
                                    },
                                  )
                                : ""}
                              {ad.endDate
                                ? ` → ${new Date(ad.endDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" })}`
                                : ""}
                            </Text>
                          </View>
                        ),
                      )}
                    </View>
                  )}
                </>
              )}

              {/* YOGAS */}
              {data.specialYogas?.length > 0 && (
                <>
                  <SecDiv en="Special Yogas" hi="विशेष योग" />
                  {data.specialYogas.map((y: string, i: number) => (
                    <View key={i} style={st.yogaRow}>
                      <Text style={st.yogaIcon}>✨</Text>
                      <Text style={st.yogaName}>{y}</Text>
                    </View>
                  ))}
                </>
              )}

              {/* ACTIONS */}
              <View style={st.actionRow}>
                <TouchableOpacity
                  style={st.exportBtn}
                  onPress={handleExportKundli}
                  disabled={exporting}
                  activeOpacity={0.8}
                >
                  {exporting ? (
                    <ActivityIndicator
                      size="small"
                      color={colors.bgSecondary}
                    />
                  ) : (
                    <>
                      <Ionicons
                        name="share-outline"
                        size={16}
                        color={colors.bgSecondary}
                      />
                      <Text style={st.exportTxt}>Export PDF</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={st.regenBtn}
                  onPress={() => {
                    setShowForm(true);
                    setData(null);
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="create-outline"
                    size={16}
                    color={colors.gold}
                  />
                  <Text style={st.regenTxt}>New Chart</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </>
      )}

      {/* ══ MATCHING TAB ══ */}
      {tab === "matching" && (
        <>
          <Text style={st.matchHdr}>💑 गुण मिलान · Kundli Matching</Text>
          <Text style={st.matchSub}>
            Ashtakoota matching using Janma Nakshatra
          </Text>

          <View style={st.personCard}>
            <Text style={st.personLbl}>👨 लड़के का विवरण · Boy Details</Text>
            <BirthForm
              form={form}
              setForm={setForm}
              loading={loading}
              compact
              noGenerate
            />
          </View>
          <View style={st.personCard}>
            <Text style={st.personLbl}>👧 लड़की का विवरण · Girl Details</Text>
            <BirthForm
              form={form2}
              setForm={setForm2}
              loading={loading}
              compact
              noGenerate
            />
            <TouchableOpacity
              style={[st.generateBtn, { marginTop: spacing.md }]}
              onPress={handleMatching}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={colors.bgSecondary} size="small" />
              ) : (
                <Text style={st.generateBtnTxt}>
                  💑 गुण मिलान करें · Calculate
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {error ? <Text style={st.errorTxt}>⚠️ {error}</Text> : null}

          {data && data2 && score && (
            <>
              <SecDiv en="Ashtakoota Score" hi="अष्टकूट मिलान" />
              <View style={st.scoreBox}>
                <Text style={st.scoreNum}>{score.total}</Text>
                <Text style={st.scoreOf}>/36</Text>
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <View style={st.scoreBar}>
                    <View
                      style={[
                        st.scoreBarFill,
                        {
                          width: `${(score.total / 36) * 100}%` as any,
                          backgroundColor: scoreBg(score.total),
                        },
                      ]}
                    />
                  </View>
                  <Text
                    style={[st.scoreVerdict, { color: scoreBg(score.total) }]}
                  >
                    {scoreVerdict(score.total)}
                  </Text>
                </View>
              </View>

              <SecDiv en="Koota Breakdown" hi="कूट विवरण" />
              {KOOTA_DATA.map((k, i) => (
                <View key={k.en} style={st.kootaBlock}>
                  <View style={st.kootaRow}>
                    <View style={{ width: 92 }}>
                      <Text style={st.kootaHi}>{k.hi}</Text>
                      <Text style={st.kootaEn}>{k.en}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={st.kootaTrack}>
                        <View
                          style={[
                            st.kootaFill,
                            {
                              width:
                                `${(score.kootas[i] / k.max) * 100}%` as any,
                              backgroundColor:
                                score.kootas[i] === k.max
                                  ? "#22C55E"
                                  : score.kootas[i] > 0
                                    ? colors.gold
                                    : "#EF4444",
                            },
                          ]}
                        />
                      </View>
                    </View>
                    <Text style={st.kootaScore}>
                      {score.kootas[i]}/{k.max}
                    </Text>
                  </View>
                </View>
              ))}

              <SecDiv en="Mangal Dosha" hi="मंगल दोष" />
              <View style={st.doshaBox}>
                <MangalDosha data={data} label={form.name || "Person 1"} />
                <View style={st.doshaDvd} />
                <MangalDosha data={data2} label={form2.name || "Person 2"} />
              </View>

              <SecDiv
                en="Boy's Kundli"
                hi={`${form.name || "लड़के"} की कुण्डली`}
              />
              <NorthIndianKundli
                data={data}
                lagna={data.lagna ?? data.planetaryPositions?.sun?.rashi ?? 0}
              />
              <SecDiv
                en="Girl's Kundli"
                hi={`${form2.name || "लड़की"} की कुण्डली`}
              />
              <NorthIndianKundli
                data={data2}
                lagna={data2.lagna ?? data2.planetaryPositions?.sun?.rashi ?? 0}
              />

              <View style={st.actionRow}>
                <TouchableOpacity
                  style={st.exportBtn}
                  onPress={handleExportMatching}
                  disabled={exporting}
                  activeOpacity={0.8}
                >
                  {exporting ? (
                    <ActivityIndicator
                      size="small"
                      color={colors.bgSecondary}
                    />
                  ) : (
                    <>
                      <Ionicons
                        name="share-outline"
                        size={16}
                        color={colors.bgSecondary}
                      />
                      <Text style={st.exportTxt}>Export Matching PDF</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={st.regenBtn}
                  onPress={() => {
                    setShowForm(true);
                    setData(null);
                    setData2(null);
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="create-outline"
                    size={16}
                    color={colors.gold}
                  />
                  <Text style={st.regenTxt}>New Match</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </>
      )}
    </View>
  );

  return (
    <GradientBackground>
      {/* Tabs — fixed above the scrollable list */}
      <View style={st.tabRow}>
        {(
          [
            ["kundli", "🔮 कुंडली"],
            ["matching", "💑 गुण मिलान"],
          ] as const
        ).map(([t, label]) => (
          <TouchableOpacity
            key={t}
            style={[st.tab, tab === t && st.tabActive]}
            onPress={() => setTab(t)}
            activeOpacity={0.7}
          >
            <Text style={[st.tabTxt, tab === t && st.tabTxtActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/*
        FlatList with a single dummy item.
        All real content lives in ListHeaderComponent.
        This is the standard RN pattern to avoid the
        "VirtualizedList nested inside plain ScrollView" error
        that GooglePlacesAutocomplete (which uses FlatList internally) triggers.
      */}
      <FlatList
        data={[null]}
        keyExtractor={() => "screen"}
        renderItem={() => null}
        ListHeaderComponent={screenContent}
        style={st.container}
        contentContainerStyle={st.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={false}
      />
    </GradientBackground>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

function makeStyles(
  colors: ThemeColors,
  spacing: Record<string, number>,
  typography: any,
) {
  return StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl * 3 },

  tabRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 10,
    backgroundColor: colors.cardBg + "60",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  tabActive: { backgroundColor: colors.gold + "20", borderColor: colors.gold },
  tabTxt: { fontSize: 12, color: colors.textMuted, fontWeight: "600" },
  tabTxtActive: { color: colors.gold },

  formCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
    gap: spacing.md,
    marginTop: spacing.md,
  },
  formCardCompact: { padding: spacing.sm, gap: spacing.sm },
  formRow: { gap: spacing.xs },
  formLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  formDouble: { flexDirection: "row", gap: spacing.sm },
  input: {
    backgroundColor: colors.bgSecondary,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
    flex: 1,
  },

  pickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.bgSecondary,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.gold + "40",
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
  },
  pickerTxt: { fontSize: 13, color: colors.gold, fontWeight: "600" },

  generateBtn: {
    backgroundColor: colors.gold,
    borderRadius: 12,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  generateBtnTxt: {
    color: colors.bgSecondary,
    fontWeight: "bold",
    fontSize: typography.fontSize.md,
  },

  editBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.gold + "10",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.gold + "30",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },
  editBarTxt: { fontSize: 12, color: colors.gold, fontWeight: "600", flex: 1 },
  errorTxt: {
    color: "#EF4444",
    textAlign: "center",
    padding: spacing.sm,
    fontSize: typography.fontSize.sm,
  },

  secDiv: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  secLine: { flex: 1, height: 1, backgroundColor: colors.gold + "30" },
  secPill: {
    flexDirection: "row",
    backgroundColor: colors.gold + "20",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginHorizontal: 8,
  },
  secHi: { fontSize: 11, color: colors.gold, fontWeight: "600" },
  secEn: { fontSize: 11, color: colors.textMuted },

  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider + "40",
    gap: 8,
  },
  infoIcon: { fontSize: 15, width: 22, textAlign: "center" },
  infoLabels: { width: 120 },
  infoLHi: { fontSize: 11, color: colors.gold + "CC" },
  infoLEn: {
    fontSize: 10,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  infoVals: { flex: 1, alignItems: "flex-end" },
  infoVEn: {
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
    fontWeight: "500",
    textAlign: "right",
  },
  infoVHi: {
    fontSize: 11,
    color: colors.gold,
    marginTop: 2,
    textAlign: "right",
  },
  accent: { color: colors.gold, fontWeight: "700" },

  // Panchang tiles
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  tile: {
    backgroundColor: colors.cardBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.sm,
    alignItems: "center",
    width: (SW - spacing.md * 2 - spacing.sm * 2) / 3,
    minHeight: 68,
  },
  tileIcon: { fontSize: 18, marginBottom: 2 },
  tileLbl: {
    fontSize: 9,
    color: colors.textMuted,
    textAlign: "center",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  tileVal: {
    fontSize: 9,
    color: colors.gold,
    textAlign: "center",
    marginTop: 2,
    fontWeight: "600",
  },

  // Choghadiya
  chogTabs: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm },
  chogTab: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: colors.cardBg + "60",
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  chogTabActive: {
    backgroundColor: colors.gold + "18",
    borderColor: colors.gold,
  },
  chogTabTxt: { fontSize: 12, color: colors.textMuted, fontWeight: "600" },
  chogTabTxtActive: { color: colors.gold },
  chogRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider + "30",
  },
  chogDot: { width: 8, height: 8, borderRadius: 4 },
  chogName: { fontSize: 13, color: colors.textPrimary, fontWeight: "600" },
  chogTime: { fontSize: 11, color: colors.textMuted },
  chogRating: { fontSize: 11, fontWeight: "700", textTransform: "capitalize" },

  // Dasha
  dashaHdr: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.gold + "40",
    padding: spacing.md,
    gap: spacing.sm,
  },
  dashaPlnt: {
    fontSize: typography.fontSize.xl,
    color: colors.gold,
    fontWeight: "bold",
  },
  dashaHi: { fontSize: 11, color: colors.textMuted },
  dashaBal: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  antarBox: {
    backgroundColor: colors.cardBg + "60",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
    marginTop: spacing.xs,
  },
  antarTitle: {
    fontSize: 11,
    color: colors.gold,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  antarRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
    gap: spacing.sm,
  },
  antarDot: { width: 8, height: 8, borderRadius: 4 },
  antarName: {
    width: 80,
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
    fontWeight: "600",
  },
  antarDate: { flex: 1, fontSize: 11, color: colors.textMuted },

  yogaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider + "40",
  },
  yogaIcon: { fontSize: 16 },
  yogaName: {
    fontSize: typography.fontSize.sm,
    color: colors.gold,
    fontWeight: "600",
  },

  actionRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
  exportBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.gold,
  },
  exportTxt: { color: colors.bgSecondary, fontWeight: "bold", fontSize: 13 },
  regenBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.cardBg + "60",
  },
  regenTxt: { fontSize: typography.fontSize.sm, color: colors.textMuted },

  // Matching
  matchHdr: {
    fontSize: typography.fontSize.xl,
    color: colors.gold,
    fontWeight: "bold",
    marginTop: spacing.lg,
    textAlign: "center",
  },
  matchSub: {
    fontSize: typography.fontSize.sm,
    color: colors.textMuted,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  personCard: {
    backgroundColor: colors.cardBg + "60",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  personLbl: {
    fontSize: typography.fontSize.md,
    color: colors.gold,
    fontWeight: "bold",
    marginBottom: spacing.xs,
  },
  scoreBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  scoreNum: { fontSize: 52, fontWeight: "bold", color: colors.gold },
  scoreOf: {
    fontSize: 22,
    color: colors.textMuted,
    alignSelf: "flex-end",
    marginBottom: 6,
  },
  scoreBar: {
    height: 8,
    backgroundColor: colors.cardBorder,
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 4,
  },
  scoreBarFill: { height: "100%", borderRadius: 4 },
  scoreVerdict: { fontSize: typography.fontSize.sm, fontWeight: "bold" },
  kootaBlock: {
    borderBottomWidth: 1,
    borderBottomColor: colors.divider + "40",
    paddingVertical: 6,
  },
  kootaRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  kootaHi: { fontSize: 11, color: colors.gold + "CC", fontWeight: "600" },
  kootaEn: { fontSize: 10, color: colors.textMuted },
  kootaTrack: {
    height: 6,
    backgroundColor: colors.cardBorder,
    borderRadius: 3,
    overflow: "hidden",
  },
  kootaFill: { height: "100%", borderRadius: 3 },
  kootaScore: {
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
    fontWeight: "600",
    width: 36,
    textAlign: "right",
  },
  doshaBox: {
    flexDirection: "row",
    backgroundColor: colors.cardBg + "60",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: "hidden",
  },
  doshaItem: {
    flex: 1,
    padding: spacing.md,
    alignItems: "center",
    gap: spacing.xs,
  },
  doshaDvd: { width: 1, backgroundColor: colors.divider },
  doshaLabel: { fontSize: 11, color: colors.textMuted, fontWeight: "600" },
  doshaResult: {
    fontSize: typography.fontSize.md,
    fontWeight: "bold",
    textAlign: "center",
  },
  doshaSub: { fontSize: 10, color: colors.textMuted },
  });
}
