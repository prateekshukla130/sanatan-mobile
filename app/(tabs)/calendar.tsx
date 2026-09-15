import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Animated,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { GradientBackground } from "../../components/GradientBackground";
import { spacing, typography, theme, useTheme, ThemeColors } from "../../theme";
import {
  panchangService,
  PanchangData,
  usePanchangLocation,
} from "../../services/panchangService";
import { Ionicons } from "@expo/vector-icons";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  addMonths,
  subMonths,
  getDay,
  isToday,
} from "date-fns";
import { getPanchangam, Observer } from "@ishubhamx/panchangam-js";
import { FadeInDown } from "react-native-reanimated";
import { Card } from "@/components/Card";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const DAY_SIZE = Math.floor((SCREEN_WIDTH - spacing.md * 2) / 7);

// ─────────────────────────────────────────────
// SHARED THEME-AWARE STYLES
// (built once per theme change, shared by every atom in this file)
// ─────────────────────────────────────────────
function useCalendarStyles() {
  const { colors, spacing, typography } = useTheme();
  const s = useMemo(
    () => makeStyles(colors, spacing, typography),
    [colors, spacing, typography],
  );
  const mStyles = useMemo(
    () => makeModalStyles(colors, spacing, typography),
    [colors, spacing, typography],
  );
  return { colors, spacing, typography, s, mStyles };
}

// ─────────────────────────────────────────────
// FESTIVAL HELPERS
// library returns: [{name, description, category, isFastingDay, ...}]
// ─────────────────────────────────────────────
interface FestivalObj {
  name: string;
  description?: string;
  category?: string; // "major" | "minor" | "fasting"
  isFastingDay?: boolean;
}

function parseFestivals(raw: unknown): FestivalObj[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((f) =>
      typeof f === "string"
        ? { name: f }
        : {
            name: f?.name ?? "",
            description: f?.description,
            category: f?.category,
            isFastingDay: !!f?.isFastingDay,
          },
    )
    .filter((f) => Boolean(f.name));
}

const FESTIVAL_COLOR: Record<string, string> = {
  major: "#F4D160",
  minor: "#60A5FA",
  fasting: "#86EFAC",
};

// IST = UTC+5:30 = 330 min. Ideally derive from UserLocation.timezone,
// but IST covers 99% of the app's target audience.
const TZ_OFFSET_MIN = 330;

// Fallback if location isn't ready yet when festivals are first requested
const FALLBACK_LAT = 28.6139;
const FALLBACK_LNG = 77.209;

// ─────────────────────────────────────────────
// FESTIVAL CARD  (new, self-contained)
// ─────────────────────────────────────────────
const FestivalCard = ({ fest }: { fest: FestivalObj }) => {
  const { colors, mStyles } = useCalendarStyles();
  const accent = FESTIVAL_COLOR[fest.category ?? "minor"] ?? colors.gold;
  const emoji =
    fest.category === "major" ? "🎊" : fest.isFastingDay ? "🙏" : "🪔";
  return (
    <View style={[mStyles.festCard, { borderLeftColor: accent }]}>
      <View style={mStyles.festTop}>
        <Text style={mStyles.festEmoji}>{emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[mStyles.festName, { color: accent }]}>{fest.name}</Text>
          {fest.category ? (
            <Text style={mStyles.festMeta}>
              {fest.category.charAt(0).toUpperCase() + fest.category.slice(1)}
              {fest.isFastingDay ? "  ·  व्रत / Fasting Day" : ""}
            </Text>
          ) : null}
        </View>
      </View>
      {fest.description ? (
        <Text style={mStyles.festDesc}>{fest.description}</Text>
      ) : null}
    </View>
  );
};

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
type SpecialType =
  | "ekadashi"
  | "purnima"
  | "amavasya"
  | "chaturthi"
  | "pradosh"
  | "navami"
  | "saptami"
  | "dwitiya";

interface DayMeta {
  type: SpecialType;
  labelEn: string;
  labelHi: string;
  color: string;
  icon: string;
}

// ─────────────────────────────────────────────
// TITHI → SPECIAL DAY  (uses real panchang data)
// tithiIno: 0=Pratipada…14=Purnima, 15=Pratipada…29=Amavasya
// ─────────────────────────────────────────────
function getDayMetaFromTithi(tithiIno: number): DayMeta | null {
  const t = tithiIno % 15; // normalise to 0–14 within paksha
  switch (t) {
    case 1:
      return {
        type: "dwitiya",
        labelEn: "Dwitiya",
        labelHi: "द्वितीया",
        color: "#86EFAC",
        icon: "✨",
      };
    case 3:
      return {
        type: "chaturthi",
        labelEn: "Chaturthi",
        labelHi: "चतुर्थी",
        color: "#FB923C",
        icon: "🐘",
      };
    case 6:
      return {
        type: "saptami",
        labelEn: "Saptami",
        labelHi: "सप्तमी",
        color: "#FBBF24",
        icon: "☀️",
      };
    case 8:
      return {
        type: "navami",
        labelEn: "Navami",
        labelHi: "नवमी",
        color: "#F472B6",
        icon: "🌸",
      };
    case 10:
      return {
        type: "ekadashi",
        labelEn: "Ekadashi",
        labelHi: "एकादशी",
        color: "#F4D160",
        icon: "🌿",
      };
    case 12:
      return {
        type: "pradosh",
        labelEn: "Pradosh",
        labelHi: "प्रदोष",
        color: "#60A5FA",
        icon: "🕉️",
      };
    case 14:
      // Purnima = tithi 14 in Shukla (ino 14), Amavasya = tithi 14 in Krishna (ino 29)
      if (tithiIno === 14)
        return {
          type: "purnima",
          labelEn: "Purnima",
          labelHi: "पूर्णिमा",
          color: "#E2E8F0",
          icon: "🌕",
        };
      if (tithiIno === 29)
        return {
          type: "amavasya",
          labelEn: "Amavasya",
          labelHi: "अमावस्या",
          color: "#818CF8",
          icon: "🌑",
        };
      return null;
    default:
      return null;
  }
}

// Pre-compute special days for a whole month (runs once per month change)
function buildMonthSpecialDays(days: Date[]): Map<string, DayMeta> {
  const map = new Map<string, DayMeta>();
  for (const day of days) {
    try {
      const p = panchangService.getPanchangForDate(day);
      const meta = getDayMetaFromTithi(p.tithiIno);
      if (meta) map.set(day.toDateString(), meta);
    } catch (_) {}
  }
  return map;
}

// ─────────────────────────────────────────────
// MOON PHASE EMOJI
// ─────────────────────────────────────────────
function moonIcon(phase: number): string {
  if (phase < 0.03 || phase > 0.97) return "🌑";
  if (phase < 0.22) return "🌒";
  if (phase < 0.28) return "🌓";
  if (phase < 0.47) return "🌔";
  if (phase < 0.53) return "🌕";
  if (phase < 0.72) return "🌖";
  if (phase < 0.78) return "🌗";
  return "🌘";
}

// ─────────────────────────────────────────────
// LEGEND CONFIG
// ─────────────────────────────────────────────
const LEGEND = [
  { color: "#F4D160", labelEn: "Ekadashi", labelHi: "एकादशी" },
  { color: "#E2E8F0", labelEn: "Purnima", labelHi: "पूर्णिमा" },
  { color: "#818CF8", labelEn: "Amavasya", labelHi: "अमावस्या" },
  { color: "#FB923C", labelEn: "Chaturthi", labelHi: "चतुर्थी" },
  { color: "#60A5FA", labelEn: "Pradosh", labelHi: "प्रदोष" },
  { color: "#F472B6", labelEn: "Navami", labelHi: "नवमी" },
  { color: "#FBBF24", labelEn: "Saptami", labelHi: "सप्तमी" },
  { color: "#86EFAC", labelEn: "Dwitiya", labelHi: "द्वितीया" },
];

// ─────────────────────────────────────────────
// MODAL ATOMS
// ─────────────────────────────────────────────
const InfoRow = ({
  icon,
  labelEn,
  labelHi,
  valueEn,
  valueHi,
  accent,
}: {
  icon: string;
  labelEn: string;
  labelHi: string;
  valueEn: string;
  valueHi?: string;
  accent?: boolean;
}) => {
  const { mStyles } = useCalendarStyles();
  return (
  <View style={mStyles.infoRow}>
    <Text style={mStyles.infoIcon}>{icon}</Text>
    <View style={mStyles.infoLabels}>
      <Text style={mStyles.infoLabelHi}>{labelHi}</Text>
      <Text style={mStyles.infoLabelEn}>{labelEn}</Text>
    </View>
    <View style={mStyles.infoValues}>
      <Text style={[mStyles.infoValueEn, accent && mStyles.accent]}>
        {valueEn}
      </Text>
      {valueHi ? <Text style={mStyles.infoValueHi}>{valueHi}</Text> : null}
    </View>
  </View>
  );
};

const TimeRow = ({
  icon,
  labelEn,
  labelHi,
  value,
  dot,
}: {
  icon: string;
  labelEn: string;
  labelHi: string;
  value: string;
  dot: string;
}) => {
  const { mStyles } = useCalendarStyles();
  return (
  <View style={mStyles.infoRow}>
    <View style={[mStyles.dot, { backgroundColor: dot }]} />
    <Text style={mStyles.infoIcon}>{icon}</Text>
    <View style={mStyles.infoLabels}>
      <Text style={mStyles.infoLabelHi}>{labelHi}</Text>
      <Text style={mStyles.infoLabelEn}>{labelEn}</Text>
    </View>
    <View style={mStyles.infoValues}>
      <Text style={mStyles.infoValueEn}>{value}</Text>
    </View>
  </View>
  );
};

const SlotRow = ({
  icon,
  labelEn,
  labelHi,
  start,
  end,
  dot,
}: {
  icon: string;
  labelEn: string;
  labelHi: string;
  start: string;
  end: string;
  dot: string;
}) => {
  const { mStyles } = useCalendarStyles();
  return (
  <View style={mStyles.infoRow}>
    <View style={[mStyles.dot, { backgroundColor: dot }]} />
    <Text style={mStyles.infoIcon}>{icon}</Text>
    <View style={mStyles.infoLabels}>
      <Text style={mStyles.infoLabelHi}>{labelHi}</Text>
      <Text style={mStyles.infoLabelEn}>{labelEn}</Text>
    </View>
    <View style={mStyles.infoValues}>
      <Text style={mStyles.infoValueEn}>{start}</Text>
      <Text style={mStyles.infoValueHi}>{end}</Text>
    </View>
  </View>
  );
};

const SecDiv = ({ en, hi }: { en: string; hi: string }) => {
  const { mStyles } = useCalendarStyles();
  return (
  <View style={mStyles.secDiv}>
    <View style={mStyles.secLine} />
    <View style={mStyles.secPill}>
      <Text style={mStyles.secHi}>{hi}</Text>
      <Text style={mStyles.secEn}> · {en}</Text>
    </View>
    <View style={mStyles.secLine} />
  </View>
  );
};

// ─────────────────────────────────────────────
// SCREEN
// ─────────────────────────────────────────────
export default function CalendarScreen() {
  const { colors, s, mStyles } = useCalendarStyles();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [panchang, setPanchang] = useState<PanchangData | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [loadingModal, setLoadingModal] = useState(false);
  const [showInauspicious, setShowInauspicious] = useState(false);
  const [specialDays, setSpecialDays] = useState<Map<string, DayMeta>>(
    new Map(),
  );
  const [festivals, setFestivals] = useState<FestivalObj[]>([]);
  const [buildingCalendar, setBuildingCalendar] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;

  const { location } = usePanchangLocation();
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const leadingBlanks = getDay(monthStart);

  // ── Festival loader (@ishubhamx/panchangam-js) ────────────────────────────
  // Non-fatal: if it throws, festivals stay []. Never blocks the screen.
  const loadFestivals = useCallback(
    (date: Date) => {
      try {
        const lat = location?.latitude ?? FALLBACK_LAT;
        const lng = location?.longitude ?? FALLBACK_LNG;
        const obs = new Observer(lat, lng, 200);
        const p = getPanchangam(date, obs, { timezoneOffset: TZ_OFFSET_MIN });
        setFestivals(parseFestivals(p.festivals));
      } catch (e) {
        console.warn("[festivals] non-fatal:", e);
        setFestivals([]);
      }
    },
    [location?.latitude, location?.longitude],
  );

  // Build special day map whenever month changes
  useEffect(() => {
    setBuildingCalendar(true);
    // Run on next tick so UI doesn't freeze
    setTimeout(() => {
      const today = new Date();
      loadFestivals(today); // ← new, parallel, non-fatal
      const map = buildMonthSpecialDays(daysInMonth);
      setSpecialDays(map);
      setBuildingCalendar(false);
    }, 0);
  }, [currentMonth.getFullYear(), currentMonth.getMonth()]);
  useEffect(() => {
    if (location) loadFestivals(new Date());
  }, [location?.latitude, location?.longitude]); // eslint-disable-line react-hooks/exhaustive-deps

  const openPanchang = useCallback(
    (date: Date) => {
      setSelectedDate(date);

      setLoadingModal(true);
      setModalVisible(true);
      setShowInauspicious(false);
      // Use setTimeout so modal animates open before computation
      setTimeout(() => {
        try {
          const data = panchangService.getPanchangForDate(date);
          loadFestivals(date);
          setPanchang(data);
        } catch (e) {
          console.error("Panchang error:", e);
        } finally {
          setLoadingModal(false);
        }
      }, 50);
    },
    [loadFestivals],
  );

  const navigateMonth = useCallback(
    (dir: 1 | -1) => {
      Animated.sequence([
        Animated.timing(slideAnim, {
          toValue: dir * -20,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();
      setCurrentMonth((prev) =>
        dir === 1 ? addMonths(prev, 1) : subMonths(prev, 1),
      );
    },
    [slideAnim],
  );

  // ── Day cell ──────────────────────────────
  const renderDay = (date: Date) => {
    const today = isToday(date);
    const selected = selectedDate ? isSameDay(date, selectedDate) : false;
    const special = specialDays.get(date.toDateString());
    const weekend = date.getDay() === 0 || date.getDay() === 6;

    return (
      <TouchableOpacity
        key={date.toISOString()}
        style={[
          s.dayCell,
          today && s.todayCell,
          selected && s.selectedCell,
          special &&
            !today &&
            !selected && { borderColor: special.color, borderWidth: 1.5 },
        ]}
        onPress={() => openPanchang(date)}
        activeOpacity={0.7}
      >
        <Text
          style={[
            s.dayNum,
            today && s.todayNum,
            selected && s.selectedNum,
            weekend && !today && !selected && s.weekendNum,
          ]}
        >
          {format(date, "d")}
        </Text>
        {special && <Text style={s.specialIcon}>{special.icon}</Text>}
        {special && (
          <View style={[s.specialDot, { backgroundColor: special.color }]} />
        )}
      </TouchableOpacity>
    );
  };

  // Build grid rows
  const allCells: (Date | null)[] = [
    ...Array(leadingBlanks).fill(null),
    ...daysInMonth,
  ];
  while (allCells.length % 7 !== 0) allCells.push(null);
  const rows: (Date | null)[][] = [];
  for (let i = 0; i < allCells.length; i += 7)
    rows.push(allCells.slice(i, i + 7));

  return (
    <GradientBackground>
      <ScrollView
        style={s.container}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── MONTH NAV ── */}
        <View style={s.monthHeader}>
          <TouchableOpacity
            style={s.navBtn}
            onPress={() => navigateMonth(-1)}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={22} color={colors.gold} />
          </TouchableOpacity>
          <View style={s.monthTitleBox}>
            <Text style={s.monthTitle}>
              {format(currentMonth, "MMMM yyyy")}
            </Text>
            <Text style={s.monthTitleHi}>
              {currentMonth.toLocaleDateString("hi-IN", {
                month: "long",
                year: "numeric",
              })}
            </Text>
          </View>
          <TouchableOpacity
            style={s.navBtn}
            onPress={() => navigateMonth(1)}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-forward" size={22} color={colors.gold} />
          </TouchableOpacity>
        </View>

        {/* ── WEEKDAY HEADERS ── */}
        <View style={s.weekRow}>
          {["रवि", "सोम", "मंगल", "बुध", "गुरु", "शुक्र", "शनि"].map((d, i) => (
            <View key={i} style={s.weekCell}>
              <Text style={[s.weekHi, (i === 0 || i === 6) && s.weekendHi]}>
                {d}
              </Text>
              <Text style={[s.weekEn, (i === 0 || i === 6) && s.weekendEn]}>
                {["S", "M", "T", "W", "T", "F", "S"][i]}
              </Text>
            </View>
          ))}
        </View>

        {/* ── CALENDAR GRID ── */}
        <Animated.View
          style={[s.gridWrap, { transform: [{ translateX: slideAnim }] }]}
        >
          {buildingCalendar ? (
            <View style={s.calLoader}>
              <ActivityIndicator size="large" color={colors.gold} />
            </View>
          ) : (
            <>
              {rows.map((row, ri) => (
                <View key={ri} style={s.gridRow}>
                  {row.map((date, ci) =>
                    date ? (
                      renderDay(date)
                    ) : (
                      <View key={`b-${ri}-${ci}`} style={s.blankCell} />
                    ),
                  )}
                </View>
              ))}
            </>
          )}
        </Animated.View>

        {/* ── TODAY STRIP ── */}
        <TouchableOpacity
          style={s.todayStrip}
          onPress={() => openPanchang(new Date())}
          activeOpacity={0.8}
        >
          <Text style={s.todayStripEmoji}>🪔</Text>
          <View style={s.todayStripText}>
            <Text style={s.todayStripHi}>आज का पञ्चाङ्ग देखें</Text>
            <Text style={s.todayStripEn}>
              Tap to view today's full Panchang
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.gold} />
        </TouchableOpacity>

        {/* ── LEGEND ── */}
        <View style={s.legendCard}>
          <Text style={s.legendTitle}>चिह्न · Legend</Text>
          <View style={s.legendGrid}>
            {LEGEND.map((l) => (
              <View key={l.labelEn} style={s.legendItem}>
                <View style={[s.legendDot, { backgroundColor: l.color }]} />
                <View>
                  <Text style={s.legendHi}>{l.labelHi}</Text>
                  <Text style={s.legendEn}>{l.labelEn}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* ── PANCHANG BOTTOM SHEET ── */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={mStyles.overlay}>
          <View style={mStyles.sheet}>
            <View style={mStyles.handle} />

            {/* Header */}
            <View style={mStyles.header}>
              <View style={{ flex: 1 }}>
                <Text style={mStyles.headerEn}>
                  {selectedDate
                    ? format(selectedDate, "EEEE, MMMM d, yyyy")
                    : ""}
                </Text>
                <Text style={mStyles.headerHi}>
                  {selectedDate
                    ? selectedDate.toLocaleDateString("hi-IN", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })
                    : ""}
                </Text>
              </View>
              <TouchableOpacity
                style={mStyles.closeBtn}
                onPress={() => setModalVisible(false)}
              >
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Content */}
            {loadingModal ? (
              <View style={mStyles.loader}>
                <ActivityIndicator size="large" color={colors.gold} />
                <Text style={mStyles.loaderTxt}>पञ्चाङ्ग लोड हो रहा है…</Text>
              </View>
            ) : panchang ? (
              <ScrollView
                style={mStyles.scroll}
                contentContainerStyle={mStyles.scrollContent}
                showsVerticalScrollIndicator={false}
              >
                {/* Special day badge */}
                {(() => {
                  const sp = getDayMetaFromTithi(panchang.tithiIno);
                  return sp ? (
                    <View style={[mStyles.badge, { borderColor: sp.color }]}>
                      <Text style={mStyles.badgeIcon}>{sp.icon}</Text>
                      <View>
                        <Text style={[mStyles.badgeHi, { color: sp.color }]}>
                          {sp.labelHi}
                        </Text>
                        <Text style={mStyles.badgeEn}>{sp.labelEn}</Text>
                      </View>
                    </View>
                  ) : null;
                })()}
                {/* Moon banner */}
                <View style={mStyles.moonBanner}>
                  <Text style={mStyles.moonEmoji}>
                    {moonIcon(panchang.moonPhase)}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text style={mStyles.moonPhaseTxt}>
                      {Math.round(panchang.moonPhase * 100)}%{" "}
                      {panchang.moonPhase < 0.5
                        ? "Waxing · शुक्ल"
                        : "Waning · कृष्ण"}
                    </Text>
                    <Text style={mStyles.moonSubTxt}>
                      {panchang.paksha_hi} · {panchang.paksha} Paksha
                    </Text>
                  </View>
                  <View>
                    <Text style={mStyles.raasiHi}>{panchang.raasi_hi}</Text>
                    <Text style={mStyles.raasiEn}>{panchang.raasi}</Text>
                  </View>
                </View>
                {festivals.length > 0 && (
                  <>
                    <SecDiv en="Festivals" hi="🎊 त्योहार " />
                    {festivals.map((f, i) => (
                      <FestivalCard key={`${f.name}-${i}`} fest={f} />
                    ))}
                  </>
                )}
                {/* Panch-Ang */}
                <SecDiv en="Panch-Ang" hi="पञ्चाङ्ग" />
                <InfoRow
                  icon="🌙"
                  labelEn="Tithi"
                  labelHi="तिथि"
                  valueEn={`${panchang.tithi} (ends ${panchang.tithiEnd})`}
                  valueHi={panchang.tithi_hi}
                  accent
                />
                <InfoRow
                  icon="⭐"
                  labelEn="Nakshatra"
                  labelHi="नक्षत्र"
                  valueEn={`${panchang.nakshatra} (ends ${panchang.nakshatraEnd})`}
                  valueHi={panchang.nakshatra_hi}
                  accent
                />
                <InfoRow
                  icon="🔯"
                  labelEn="Yoga"
                  labelHi="योग"
                  valueEn={`${panchang.yoga} (ends ${panchang.yogaEnd})`}
                  valueHi={panchang.yoga_hi}
                />
                <InfoRow
                  icon="🌿"
                  labelEn="Karana"
                  labelHi="करण"
                  valueEn={`${panchang.karana} (ends ${panchang.karanaEnd})`}
                  valueHi={panchang.karana_hi}
                />
                <InfoRow
                  icon="📅"
                  labelEn="Vara"
                  labelHi="वार"
                  valueEn={panchang.vara}
                  valueHi={panchang.vara_hi}
                />

                {/* Hindu Calendar */}
                <SecDiv en="Hindu Calendar" hi="हिन्दू पंचांग" />
                <InfoRow
                  icon="🗓"
                  labelEn="Masa"
                  labelHi="मास"
                  valueEn={panchang.masa}
                  valueHi={panchang.masa_hi}
                />
                <InfoRow
                  icon="🍃"
                  labelEn="Ritu (Season)"
                  labelHi="ऋतु"
                  valueEn={panchang.ritu}
                  valueHi={panchang.ritu_hi}
                />
                <InfoRow
                  icon="♈"
                  labelEn="Raasi"
                  labelHi="राशि"
                  valueEn={panchang.raasi}
                  valueHi={panchang.raasi_hi}
                />
                <InfoRow
                  icon="📜"
                  labelEn="Vikram Samvat"
                  labelHi="विक्रम संवत्"
                  valueEn={panchang.vikramSamvat}
                />
                <InfoRow
                  icon="📜"
                  labelEn="Shaka Samvat"
                  labelHi="शक संवत्"
                  valueEn={panchang.shakaSamvat}
                />

                {/* Sun & Moon Times */}
                <SecDiv en="Sun & Moon Times" hi="सूर्य-चन्द्र समय" />
                <TimeRow
                  icon="🌅"
                  labelEn="Sunrise"
                  labelHi="सूर्योदय"
                  value={panchang.sunrise}
                  dot="#FCD34D"
                />
                <TimeRow
                  icon="🌇"
                  labelEn="Sunset"
                  labelHi="सूर्यास्त"
                  value={panchang.sunset}
                  dot="#F97316"
                />
                <TimeRow
                  icon="☀️"
                  labelEn="Solar Noon"
                  labelHi="मध्याह्न"
                  value={panchang.solarNoon}
                  dot="#FBBF24"
                />
                <TimeRow
                  icon="🌕"
                  labelEn="Moonrise"
                  labelHi="चन्द्रोदय"
                  value={panchang.moonrise}
                  dot="#E2E8F0"
                />
                <TimeRow
                  icon="🌑"
                  labelEn="Moonset"
                  labelHi="चन्द्रास्त"
                  value={panchang.moonset}
                  dot="#94A3B8"
                />
                <TimeRow
                  icon="🧘"
                  labelEn="Brahma Muhurta"
                  labelHi="ब्रह्म मुहूर्त"
                  value={panchang.brahmaHora}
                  dot="#60A5FA"
                />

                {/* Auspicious */}
                <SecDiv en="Auspicious Timings" hi="शुभ मुहूर्त" />
                <SlotRow
                  icon="⭐"
                  labelEn="Abhijit Muhurta"
                  labelHi="अभिजित् मुहूर्त"
                  start={panchang.abhijitMuhurta.start}
                  end={panchang.abhijitMuhurta.end}
                  dot="#22C55E"
                />
                <SlotRow
                  icon="🍃"
                  labelEn="Amrit Kaal"
                  labelHi="अमृत काल"
                  start={panchang.amritKaal.start}
                  end={panchang.amritKaal.end}
                  dot="#34D399"
                />

                {/* Inauspicious toggle */}
                <TouchableOpacity
                  style={mStyles.toggleBtn}
                  onPress={() => setShowInauspicious((v) => !v)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={showInauspicious ? "chevron-up" : "chevron-down"}
                    size={16}
                    color={colors.gold}
                  />
                  <Text style={mStyles.toggleTxt}>
                    {showInauspicious
                      ? "अशुभ काल छुपाएँ · Hide"
                      : "अशुभ काल देखें · Show inauspicious"}
                  </Text>
                </TouchableOpacity>

                {showInauspicious && (
                  <View style={mStyles.inauspBox}>
                    <Text style={mStyles.inauspNote}>
                      इन समयों में महत्वपूर्ण कार्य न करें · Avoid important
                      tasks
                    </Text>
                    <SlotRow
                      icon="🐍"
                      labelEn="Rahu Kaal"
                      labelHi="राहु काल"
                      start={panchang.rahuKaal.start}
                      end={panchang.rahuKaal.end}
                      dot="#EF4444"
                    />
                    <SlotRow
                      icon="💀"
                      labelEn="Yamagandam"
                      labelHi="यमगण्डम्"
                      start={panchang.yamagandam.start}
                      end={panchang.yamagandam.end}
                      dot="#F97316"
                    />
                    <SlotRow
                      icon="😈"
                      labelEn="Gulikai / Mandi"
                      labelHi="गुलिकाई / मांडी"
                      start={panchang.gulikai.start}
                      end={panchang.gulikai.end}
                      dot="#A855F7"
                    />
                    <SlotRow
                      icon="🚫"
                      labelEn="Durmuhurta"
                      labelHi="दुर्मुहूर्त"
                      start={panchang.durmuhurta.start}
                      end={panchang.durmuhurta.end}
                      dot="#FB923C"
                    />
                    <SlotRow
                      icon="❌"
                      labelEn="Varjyam"
                      labelHi="वर्ज्यम्"
                      start={panchang.varjyam.start}
                      end={panchang.varjyam.end}
                      dot="#F43F5E"
                    />
                  </View>
                )}

                {/* Astronomical */}
                <SecDiv en="Astronomical" hi="खगोलीय" />
                <InfoRow
                  icon="🔭"
                  labelEn="Ayanamsa"
                  labelHi="अयनांश"
                  valueEn={panchang.ayanamsa}
                />
                <InfoRow
                  icon="🔢"
                  labelEn="Tithi #"
                  labelHi="तिथि क्र."
                  valueEn={`${panchang.tithiIno + 1} / 30`}
                />
              </ScrollView>
            ) : (
              <View style={mStyles.loader}>
                <Text style={mStyles.loaderTxt}>
                  कोई डेटा नहीं · No data available
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </GradientBackground>
  );
}

// ─────────────────────────────────────────────
// CALENDAR STYLES
// ─────────────────────────────────────────────
function makeStyles(
  colors: ThemeColors,
  spacing: Record<string, number>,
  typography: any,
) {
  return StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: spacing.xl },

  monthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.gold + "20",
    alignItems: "center",
    justifyContent: "center",
  },
  monthTitleBox: { alignItems: "center" },
  monthTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.gold,
    letterSpacing: 0.5,
  },
  monthTitleHi: {
    fontSize: typography.fontSize.sm,
    color: colors.textMuted,
    marginTop: 2,
  },

  weekRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider + "80",
  },
  weekCell: { width: DAY_SIZE, alignItems: "center" },
  weekHi: { fontSize: 10, color: colors.gold, fontWeight: "600" },
  weekEn: { fontSize: 9, color: colors.textMuted, marginTop: 1 },
  weekendHi: { color: "#F87171" },
  weekendEn: { color: "#F87171" },

  gridWrap: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  gridRow: { flexDirection: "row" },
  calLoader: { height: 200, alignItems: "center", justifyContent: "center" },

  dayCell: {
    width: DAY_SIZE,
    height: DAY_SIZE,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    marginVertical: 2,
    backgroundColor: colors.cardBg + "80",
    position: "relative",
  },
  blankCell: { width: DAY_SIZE, height: DAY_SIZE },
  todayCell: {
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.gold,
  },
  selectedCell: {
    backgroundColor: colors.gold + "30",
    borderWidth: 2,
    borderColor: colors.gold,
  },

  dayNum: {
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
    fontWeight: "500",
  },
  todayNum: { color: colors.gold, fontWeight: typography.fontWeight.bold },
  selectedNum: { color: colors.gold, fontWeight: typography.fontWeight.bold },
  weekendNum: { color: "#F87171" },
  specialIcon: { fontSize: 8 },
  specialDot: {
    position: "absolute",
    bottom: 3,
    width: 4,
    height: 4,
    borderRadius: 2,
  },

  todayStrip: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.gold + "15",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.gold + "40",
    gap: spacing.sm,
  },
  todayStripEmoji: { fontSize: 20 },
  todayStripText: { flex: 1 },
  todayStripHi: {
    fontSize: typography.fontSize.sm,
    color: colors.gold,
    fontWeight: "600",
  },
  todayStripEn: { fontSize: 11, color: colors.textMuted, marginTop: 2 },

  legendCard: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.cardBg + "80",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  legendTitle: {
    fontSize: typography.fontSize.sm,
    color: colors.gold,
    fontWeight: "600",
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  legendGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    width: "48%",
    gap: 8,
    marginBottom: 8,
  },
  legendDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  legendHi: { fontSize: 11, color: colors.textPrimary, fontWeight: "600" },
  legendEn: { fontSize: 10, color: colors.textMuted },
  });
}

// ─────────────────────────────────────────────
// MODAL STYLES
// ─────────────────────────────────────────────
function makeModalStyles(
  colors: ThemeColors,
  spacing: Record<string, number>,
  typography: any,
) {
  return StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.bgSecondary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: SCREEN_HEIGHT * 0.92,
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
  headerEn: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.gold,
  },
  headerHi: {
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

  loader: { padding: 48, alignItems: "center", gap: 12 },
  loaderTxt: { color: colors.gold, fontSize: typography.fontSize.md },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },

  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: 10,
    borderWidth: 1.5,
    backgroundColor: colors.cardBg + "60",
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  badgeIcon: { fontSize: 24 },
  badgeHi: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },
  badgeEn: { fontSize: typography.fontSize.sm, color: colors.textMuted },

  moonBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    backgroundColor: colors.gold + "12",
    borderRadius: 12,
    marginVertical: spacing.sm,
    gap: spacing.md,
  },
  moonEmoji: { fontSize: 36 },
  moonPhaseTxt: {
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
    fontWeight: "600",
  },
  moonSubTxt: {
    fontSize: typography.fontSize.sm,
    color: colors.textMuted,
    marginTop: 2,
  },
  raasiHi: {
    fontSize: typography.fontSize.md,
    color: colors.gold,
    fontWeight: typography.fontWeight.bold,
    textAlign: "right",
  },
  raasiEn: { fontSize: 11, color: colors.textMuted, textAlign: "right" },

  secDiv: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.md,
    marginBottom: spacing.xs,
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
  dot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  infoIcon: { fontSize: 15, width: 22, textAlign: "center" },
  infoLabels: { width: 100 },
  infoLabelHi: { fontSize: 11, color: colors.gold + "CC" },
  infoLabelEn: {
    fontSize: 10,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  infoValues: { flex: 1, alignItems: "flex-end" },
  infoValueEn: {
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
    fontWeight: "500",
    textAlign: "right",
  },
  infoValueHi: {
    fontSize: 11,
    color: colors.gold,
    marginTop: 2,
    textAlign: "right",
  },
  accent: { color: colors.gold },

  toggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  toggleTxt: {
    fontSize: typography.fontSize.sm,
    color: colors.gold,
    fontWeight: "600",
  },
  inauspBox: {
    backgroundColor: colors.cardBg + "60",
    borderRadius: 10,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: "#EF4444" + "40",
  },
  inauspNote: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: "center",
    marginBottom: spacing.sm,
    fontStyle: "italic",
  },
  festCard: {
    borderLeftWidth: 4,
    borderRadius: 10,
    backgroundColor: colors.gold + "10",
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.gold + "20",
    marginBottom: spacing.xs,
  },
  festTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  festEmoji: { fontSize: 20 },
  festName: { fontSize: typography.fontSize.md, fontWeight: "700" },
  festMeta: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 1,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  festDesc: {
    fontSize: typography.fontSize.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
    lineHeight: 18,
  },
  });
}
