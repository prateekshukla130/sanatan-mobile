/**
 * HomeScreen.tsx
 *
 * Mixed data strategy — zero changes to panchangService:
 *
 *  ① panchangService (mhah-panchang + suncalc)
 *     └─ ALL core data: tithi, nakshatra, yoga, karana, vara, masa, ritu,
 *        raasi, sunrise/set, moon times, muhurtas, samvat, ayanamsa.
 *
 *  ② @ishubhamx/panchangam-js  — festivals[] ONLY
 *     └─ Called in parallel in loadData(), fully non-fatal.
 *        Uses the same UserLocation from usePanchangLocation (already
 *        exported from panchangService) so coords stay in sync.
 *
 *  usePanchangLocation — imported from panchangService (already there).
 *  No new hook, no new service, no new file needed.
 */
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInLeft,
} from "react-native-reanimated";

import { GradientBackground } from "../../components/GradientBackground";
import { Card } from "../../components/Card";
import { AnimatedDiya } from "../../components/AnimatedDiya";
import { MoonPhase } from "../../components/MoonPhase";
import { useTheme, ThemeColors } from "../../theme";
import {
  panchangService,
  PanchangData,
  TimeSlot,
  usePanchangLocation, // ← already exported from panchangService
} from "../../services/panchangService";
import { mantraService, Mantra } from "../../services/mantraService";
import {
  FIELD_LABELS_HI,
  SECTION_LABELS_HI,
  MUHURTA_LABELS_HI,
} from "../../services/constants";
import { bhajanService } from "@/services/bhajanService";
import { artistService } from "@/services/artistsService";
import { getPanchangam, Observer } from "@ishubhamx/panchangam-js";
import { JourneyModal } from "@/components/JourneyModal";
import { useLanguage } from "@/localization";

// ─────────────────────────────────────────────
// SHARED THEME-AWARE STYLES
// ─────────────────────────────────────────────
function useHomeStyles() {
  const { colors, spacing, typography } = useTheme();
  const styles = useMemo(
    () => makeStyles(colors, spacing, typography),
    [colors, spacing, typography],
  );
  return { colors, spacing, typography, styles };
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
  const { colors, styles } = useHomeStyles();
  const accent = FESTIVAL_COLOR[fest.category ?? "minor"] ?? colors.gold;
  const emoji =
    fest.category === "major" ? "🎊" : fest.isFastingDay ? "🙏" : "🪔";
  return (
    <View style={[styles.festCard, { borderLeftColor: accent }]}>
      <View style={styles.festTop}>
        <Text style={styles.festEmoji}>{emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.festName, { color: accent }]}>{fest.name}</Text>
          {fest.category ? (
            <Text style={styles.festMeta}>
              {fest.category.charAt(0).toUpperCase() + fest.category.slice(1)}
              {fest.isFastingDay ? "  ·  व्रत / Fasting Day" : ""}
            </Text>
          ) : null}
        </View>
      </View>
      {fest.description ? (
        <Text style={styles.festDesc}>{fest.description}</Text>
      ) : null}
    </View>
  );
};

// ─────────────────────────────────────────────
// ORIGINAL ATOMS  (unchanged from your code)
// ─────────────────────────────────────────────
const BiCell = ({
  labelEn,
  labelHi,
  valueEn,
  valueHi,
  subValue,
  accent,
  fullWidth,
}: {
  labelEn: string;
  labelHi: string;
  valueEn: string;
  valueHi: string;
  subValue?: string;
  accent?: boolean;
  fullWidth?: boolean;
}) => {
  const { styles } = useHomeStyles();
  return (
    <View style={[styles.biCell, fullWidth && styles.biCellFull]}>
      <View style={styles.biCellLabelRow}>
        <Text style={styles.biCellLabelEn}>{labelEn}</Text>
        <Text style={styles.biCellLabelHi}>{labelHi}</Text>
      </View>
      <Text style={[styles.biCellValueEn, accent && styles.accent]}>
        {valueEn}
      </Text>
      <Text style={styles.biCellValueHi}>{valueHi}</Text>
      {subValue ? <Text style={styles.biCellSub}>{subValue}</Text> : null}
    </View>
  );
};

const InfoCell = ({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) => {
  const { styles } = useHomeStyles();
  return (
    <View style={styles.infoCell}>
      <Text style={styles.infoCellLabel}>{label}</Text>
      <Text style={[styles.infoCellValue, accent && styles.accent]}>
        {value}
      </Text>
      {sub ? <Text style={styles.infoCellSub}>{sub}</Text> : null}
    </View>
  );
};

const TimingRow = ({
  icon,
  labelEn,
  labelHi,
  slot,
  dot,
}: {
  icon: string;
  labelEn: string;
  labelHi: string;
  slot: TimeSlot;
  dot: string;
}) => {
  const { styles } = useHomeStyles();
  return (
    <View style={styles.timingRow}>
      <View style={[styles.dot, { backgroundColor: dot }]} />
      <Text style={styles.timingIcon}>{icon}</Text>
      <View style={styles.timingLabels}>
        <Text style={styles.timingLabelEn}>{labelEn}</Text>
        <Text style={styles.timingLabelHi}>{labelHi}</Text>
      </View>
      <Text style={styles.timingTime}>
        {slot.start}
        {"\n"}
        {slot.end}
      </Text>
    </View>
  );
};

const SectionHeader = ({ en, hi }: { en: string; hi: string }) => {
  const { styles } = useHomeStyles();
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionLine} />
      <View style={styles.sectionPill}>
        <Text style={styles.sectionEn}>{en}</Text>
        <Text style={styles.sectionHi}>{hi}</Text>
      </View>
      <View style={styles.sectionLine} />
    </View>
  );
};

const Pill = ({ text, color }: { text: string; color?: string }) => {
  const { colors, styles } = useHomeStyles();
  return (
    <View style={[styles.pill, { borderColor: color ?? colors.gold }]}>
      <Text style={[styles.pillText, { color: color ?? colors.gold }]}>
        {text}
      </Text>
    </View>
  );
};

// ─────────────────────────────────────────────
// SCREEN
// ─────────────────────────────────────────────
export default function HomeScreen() {
  // usePanchangLocation is already exported from panchangService —
  // panchangService reads the same _loc internally for its own calculations.
  const { location } = usePanchangLocation();

  const [panchang, setPanchang] = useState<PanchangData | null>(null);
  const [festivals, setFestivals] = useState<FestivalObj[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dailyMantra, setDailyMantra] = useState<Mantra | null>(null);
  const [showInauspicious, setShowInauspicious] = useState(false);
  const [journeyOpen, setJourneyOpen] = useState(false);
  const { t } = useLanguage();
  const { colors, styles } = useHomeStyles();

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

  // ── Core load — identical to your original logic ──────────────────────────
  const loadData = useCallback(async () => {
    try {
      const today = new Date();
      setPanchang(panchangService.getTodayPanchang());
      setDailyMantra(mantraService.getDailyMantra());
      loadFestivals(today); // ← new, parallel, non-fatal
    } catch (e) {
      console.error("Panchang load error:", e);
    } finally {
      setLoading(false);
    }
  }, [loadFestivals]);

  // ── Pull-to-refresh — identical to your original logic ───────────────────
  const onRefresh = useCallback(async () => {
    await Promise.all([bhajanService.refresh(), artistService.refresh()]);
    setRefreshing(true);
    try {
      const response = await mantraService.refresh();
      if (response) {
        setPanchang(panchangService.getTodayPanchang());
        setDailyMantra(response?.[0]);
        loadFestivals(new Date()); // ← refresh festivals too
      }
    } catch (e) {
      console.error("Refresh error:", e);
    } finally {
      setRefreshing(false);
    }
  }, [loadFestivals]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Re-fetch festivals when GPS location comes in after initial render
  useEffect(() => {
    if (location) loadFestivals(new Date());
  }, [location?.latitude, location?.longitude]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Loading state (unchanged) ─────────────────────────────────────────────
  if (loading && !panchang) {
    return (
      <GradientBackground>
        <View style={styles.loadingContainer}>
          <AnimatedDiya />
          <ActivityIndicator
            size="large"
            color={colors.gold}
            style={{ marginTop: 24 }}
          />
          <Text style={styles.loadingEn}>Loading Panchang…</Text>
          <Text style={styles.loadingHi}>पञ्चाङ्ग लोड हो रहा है…</Text>
        </View>
      </GradientBackground>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER  — identical structure to your original; festivals card inserted
  //           right after the header, before the mantra card.
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <GradientBackground>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.gold}
            colors={[colors.gold]}
            title="Refreshing Panchang…"
            titleColor={colors.gold}
          />
        }
      >
        {/* ── HEADER ── */}
        <Animated.View entering={FadeIn.duration(1000)} style={styles.header}>
          <AnimatedDiya />
          <Text style={styles.om}>॥ ॐ नमः शिवाय ॥</Text>
          {panchang && (
            <>
              <Text style={styles.dateEn}>{panchang.date}</Text>
              <Text style={styles.dateHi}>{panchang.date_hi}</Text>
              {/* Show city from panchangService._loc */}
              {panchang.locationCity ? (
                <View style={styles.locationPill}>
                  <Text style={styles.locationPillTxt}>
                    📍 {panchang.locationCity}
                  </Text>
                </View>
              ) : null}
            </>
          )}
          <TouchableOpacity
            style={styles.journeyBtn}
            onPress={() => setJourneyOpen(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.journeyBtnTxt}>🪷 {t("journey.openJourney")}</Text>
          </TouchableOpacity>
        </Animated.View>
        {/* ════════════════════════════════════════════════════
            FESTIVALS  — @ishubhamx/panchangam-js data
            Hidden on non-festival days (festivals.length === 0)
            ════════════════════════════════════════════════════ */}
        {festivals.length > 0 && (
          <Animated.View entering={FadeInDown.delay(50).duration(700)}>
            <Card title={`🎊 त्योहार · Today's Festivals`}>
              {festivals.map((f, i) => (
                <FestivalCard key={`${f.name}-${i}`} fest={f} />
              ))}
            </Card>
          </Animated.View>
        )}
        {/* ── DAILY MANTRA (unchanged) ── */}
        {dailyMantra && (
          <Animated.View entering={FadeInDown.delay(100).duration(700)}>
            <Card title={`✨ ${SECTION_LABELS_HI.mantra} · Today's Mantra`}>
              <Text style={styles.mantraText}>{dailyMantra.text}</Text>
              <Text style={styles.mantraMeaning}>{dailyMantra.meaning}</Text>
              <View style={styles.mantraFooter}>
                <Pill text={`देवता · Deity: ${dailyMantra.deity}`} />
              </View>
            </Card>
          </Animated.View>
        )}
        {/* ═══════════════════════════════════════════════════
            EVERYTHING BELOW — panchangService data, unchanged
            ═══════════════════════════════════════════════════ */}
        {panchang && (
          <>
            {/* ── HINDU CALENDAR ── */}
            <Animated.View entering={FadeInDown.delay(200).duration(700)}>
              <Card title={`📅 ${SECTION_LABELS_HI.calendar} · Hindu Calendar`}>
                <View style={styles.strip}>
                  <View style={styles.stripCell}>
                    <Text style={styles.stripLabelHi}>
                      {FIELD_LABELS_HI.masa}
                    </Text>
                    <Text style={styles.stripLabelEn}>Masa</Text>
                    <Text style={styles.stripValueHi}>{panchang.masa_hi}</Text>
                    <Text style={styles.stripValueEn}>{panchang.masa}</Text>
                  </View>
                  <View style={styles.stripDivider} />
                  <View style={styles.stripCell}>
                    <Text style={styles.stripLabelHi}>
                      {FIELD_LABELS_HI.ritu}
                    </Text>
                    <Text style={styles.stripLabelEn}>Ritu</Text>
                    <Text style={styles.stripValueHi}>{panchang.ritu_hi}</Text>
                    <Text style={styles.stripValueEn}>{panchang.ritu}</Text>
                  </View>
                  <View style={styles.stripDivider} />
                  <View style={styles.stripCell}>
                    <Text style={styles.stripLabelHi}>
                      {FIELD_LABELS_HI.vara}
                    </Text>
                    <Text style={styles.stripLabelEn}>Vara</Text>
                    <Text style={styles.stripValueHi}>{panchang.vara_hi}</Text>
                    <Text style={styles.stripValueEn}>{panchang.vara}</Text>
                  </View>
                </View>
                <View style={styles.samvatRow}>
                  <View style={styles.samvatItem}>
                    <Text style={styles.samvatLabelHi}>
                      {FIELD_LABELS_HI.vikramSamvat}
                    </Text>
                    <Text style={styles.samvatValue}>
                      {panchang.vikramSamvat}
                    </Text>
                  </View>
                  <View style={styles.samvatItem}>
                    <Text style={styles.samvatLabelHi}>
                      {FIELD_LABELS_HI.shakaSamvat}
                    </Text>
                    <Text style={styles.samvatValue}>
                      {panchang.shakaSamvat}
                    </Text>
                  </View>
                </View>
              </Card>
            </Animated.View>

            {/* ── PANCH-ANG ── */}
            <Animated.View entering={FadeInDown.delay(300).duration(700)}>
              <Card title={`🪔 ${SECTION_LABELS_HI.panchang} · Panch-Ang`}>
                <View style={styles.grid2}>
                  <BiCell
                    labelEn="Tithi"
                    labelHi={FIELD_LABELS_HI.tithi}
                    valueEn={panchang.tithi}
                    valueHi={panchang.tithi_hi}
                    subValue={`समाप्ति · ends ${panchang.tithiEnd}`}
                    accent
                  />
                  <BiCell
                    labelEn="Nakshatra"
                    labelHi={FIELD_LABELS_HI.nakshatra}
                    valueEn={panchang.nakshatra}
                    valueHi={panchang.nakshatra_hi}
                    subValue={`ends ${panchang.nakshatraEnd}`}
                    accent
                  />
                  <BiCell
                    labelEn="Yoga"
                    labelHi={FIELD_LABELS_HI.yoga}
                    valueEn={panchang.yoga}
                    valueHi={panchang.yoga_hi}
                    subValue={`ends ${panchang.yogaEnd}`}
                  />
                  <BiCell
                    labelEn="Karana"
                    labelHi={FIELD_LABELS_HI.karana}
                    valueEn={panchang.karana}
                    valueHi={panchang.karana_hi}
                    subValue={`ends ${panchang.karanaEnd}`}
                  />
                </View>
                <View style={styles.badgeRow}>
                  <Pill
                    text={`${panchang.paksha_hi} · ${panchang.paksha} Paksha`}
                    color={panchang.paksha === "Shukla" ? "#F4D160" : "#A78BFA"}
                  />
                  <Pill text={`${panchang.raasi_hi} · ${panchang.raasi}`} />
                </View>
              </Card>
            </Animated.View>

            {/* ── SUN & MOON ── */}
            <Animated.View entering={FadeInDown.delay(400).duration(700)}>
              <Card title={`☀️ ${SECTION_LABELS_HI.sunMoon} · Sun & Moon`}>
                <View style={styles.moonRow}>
                  <MoonPhase phase={panchang.moonPhase} size={90} />
                  <View style={styles.moonDetails}>
                    <Text style={styles.moonLabelHi}>
                      {FIELD_LABELS_HI.moonPhase}
                    </Text>
                    <Text style={styles.moonValue}>
                      {Math.round(panchang.moonPhase * 100)}%{" "}
                      {panchang.moonPhase < 0.5
                        ? FIELD_LABELS_HI.waxing
                        : FIELD_LABELS_HI.waning}
                    </Text>
                    <Text style={styles.moonLabelHi}>
                      {FIELD_LABELS_HI.raasi}
                    </Text>
                    <Text style={styles.moonValue}>
                      {panchang.raasi_hi} · {panchang.raasi}
                    </Text>
                    <Text style={styles.moonLabelHi}>
                      {FIELD_LABELS_HI.paksha}
                    </Text>
                    <Text style={styles.moonValue}>{panchang.paksha_hi}</Text>
                  </View>
                </View>
                <SectionHeader en="Daily Timings" hi="दैनिक समय" />
                <View style={styles.grid2}>
                  <InfoCell
                    label={`🌅 ${FIELD_LABELS_HI.sunrise} · Sunrise`}
                    value={panchang.sunrise}
                  />
                  <InfoCell
                    label={`🌇 ${FIELD_LABELS_HI.sunset} · Sunset`}
                    value={panchang.sunset}
                  />
                  <InfoCell
                    label={`🌕 ${FIELD_LABELS_HI.moonrise} · Moonrise`}
                    value={panchang.moonrise}
                  />
                  <InfoCell
                    label={`🌑 ${FIELD_LABELS_HI.moonset} · Moonset`}
                    value={panchang.moonset}
                  />
                  <InfoCell
                    label={`☀️ ${FIELD_LABELS_HI.solarNoon} · Solar Noon`}
                    value={panchang.solarNoon}
                  />
                  <InfoCell
                    label={`🧘 ${FIELD_LABELS_HI.brahmaHora} · Brahma Muhurta`}
                    value={panchang.brahmaHora}
                    sub="Best for meditation"
                    accent
                  />
                </View>
              </Card>
            </Animated.View>

            {/* ── AUSPICIOUS TIMINGS ── */}
            <Animated.View entering={FadeInDown.delay(500).duration(700)}>
              <Card
                title={`🌟 ${SECTION_LABELS_HI.auspicious} · Auspicious Timings`}
              >
                <TimingRow
                  icon="⭐"
                  labelEn="Abhijit Muhurta"
                  labelHi={MUHURTA_LABELS_HI.abhijit}
                  slot={panchang.abhijitMuhurta}
                  dot="#22C55E"
                />
                <TimingRow
                  icon="🍃"
                  labelEn="Amrit Kaal"
                  labelHi={MUHURTA_LABELS_HI.amritKaal}
                  slot={panchang.amritKaal}
                  dot="#34D399"
                />
                <TimingRow
                  icon="🧘"
                  labelEn="Brahma Muhurta"
                  labelHi={MUHURTA_LABELS_HI.brahma}
                  slot={{ start: panchang.brahmaHora, end: panchang.sunrise }}
                  dot="#60A5FA"
                />
                <TouchableOpacity
                  style={styles.toggleBtn}
                  onPress={() => setShowInauspicious((v) => !v)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.toggleText}>
                    {showInauspicious
                      ? "▴ अशुभ काल छुपाएँ · Hide inauspicious"
                      : "▾ अशुभ काल देखें · Show inauspicious"}
                  </Text>
                </TouchableOpacity>
              </Card>
            </Animated.View>

            {/* ── INAUSPICIOUS PERIODS ── */}
            {showInauspicious && (
              <Animated.View entering={FadeInLeft.duration(400)}>
                <Card
                  title={`⚠️ ${SECTION_LABELS_HI.inauspicious} · Inauspicious Periods`}
                >
                  <Text style={styles.avoidNote}>
                    इन समयों में महत्वपूर्ण कार्य, यात्रा या अनुष्ठान न करें।
                    {"\n"}
                    Avoid important tasks, travel, or ceremonies during these
                    times.
                  </Text>
                  <TimingRow
                    icon="🐍"
                    labelEn="Rahu Kaal"
                    labelHi={MUHURTA_LABELS_HI.rahuKaal}
                    slot={panchang.rahuKaal}
                    dot="#EF4444"
                  />
                  <TimingRow
                    icon="💀"
                    labelEn="Yamagandam"
                    labelHi={MUHURTA_LABELS_HI.yamagandam}
                    slot={panchang.yamagandam}
                    dot="#F97316"
                  />
                  <TimingRow
                    icon="😈"
                    labelEn="Gulikai / Mandi"
                    labelHi={MUHURTA_LABELS_HI.gulikai}
                    slot={panchang.gulikai}
                    dot="#A855F7"
                  />
                  <TimingRow
                    icon="🚫"
                    labelEn="Durmuhurta"
                    labelHi={MUHURTA_LABELS_HI.durmuhurta}
                    slot={panchang.durmuhurta}
                    dot="#FB923C"
                  />
                  <TimingRow
                    icon="❌"
                    labelEn="Varjyam"
                    labelHi={MUHURTA_LABELS_HI.varjyam}
                    slot={panchang.varjyam}
                    dot="#F43F5E"
                  />
                </Card>
              </Animated.View>
            )}

            {/* ── ASTRONOMICAL INFO ── */}
            <Animated.View entering={FadeInDown.delay(600).duration(700)}>
              <Card
                title={`🔭 ${SECTION_LABELS_HI.astronomy} · Astronomical Info`}
              >
                <View style={styles.grid2}>
                  <InfoCell
                    label={`${FIELD_LABELS_HI.ayanamsa} · Ayanamsa`}
                    value={panchang.ayanamsa}
                    sub="Lahiri"
                  />
                  <InfoCell
                    label="Tithi #"
                    value={`${panchang.tithiIno + 1} / 30`}
                    sub={panchang.paksha_hi}
                  />
                </View>
              </Card>
            </Animated.View>
          </>
        )}
        {/* ── FOOTER ── */}
        <Animated.View
          entering={FadeIn.delay(700).duration(1000)}
          style={styles.footer}
        >
          <Text style={styles.footerMain}>
            🙏 Jai Shri Ram · जय श्री राम 🙏
          </Text>
          <Text style={styles.footerSub}>॥ सर्वे भवन्तु सुखिनः ॥</Text>
        </Animated.View>
      </ScrollView>
      <JourneyModal visible={journeyOpen} onClose={() => setJourneyOpen(false)} />
    </GradientBackground>
  );
}

// ─────────────────────────────────────────────
// STYLES (theme-dependent — built via useHomeStyles())
// ─────────────────────────────────────────────
function makeStyles(
  colors: ThemeColors,
  spacing: Record<string, number>,
  typography: any,
) {
  return StyleSheet.create({
  // ── original ──────────────────────────────────────────────────────────────
  container: { flex: 1 },
  content: { paddingVertical: spacing.lg, paddingHorizontal: spacing.sm },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  loadingEn: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.lg,
    marginTop: spacing.md,
  },
  loadingHi: { color: colors.gold, fontSize: typography.fontSize.md },
  header: { alignItems: "center", marginVertical: spacing.lg },
  om: {
    fontSize: typography.fontSize.xxl,
    color: colors.gold,
    fontWeight: typography.fontWeight.bold,
    marginTop: spacing.md,
    letterSpacing: 1.5,
    textAlign: "center",
  },
  dateEn: {
    fontSize: typography.fontSize.sm,
    color: colors.textMuted,
    marginTop: 4,
    textAlign: "center",
  },
  dateHi: {
    fontSize: typography.fontSize.sm,
    color: colors.gold + "CC",
    marginTop: 2,
    textAlign: "center",
  },
  mantraText: {
    fontSize: typography.fontSize.xl,
    color: colors.textPrimary,
    textAlign: "center",
    marginBottom: spacing.sm,
    lineHeight: typography.fontSize.xl * 1.7,
  },
  mantraMeaning: {
    fontSize: typography.fontSize.md,
    color: colors.textMuted,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  mantraFooter: { alignItems: "center" },
  strip: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  stripCell: { flex: 1, alignItems: "center" },
  stripLabelHi: {
    fontSize: 10,
    color: colors.gold,
    marginBottom: 1,
    textAlign: "center",
  },
  stripLabelEn: {
    fontSize: 10,
    color: colors.textMuted,
    marginBottom: 4,
    textAlign: "center",
  },
  stripValueHi: {
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
    fontWeight: typography.fontWeight.bold,
    textAlign: "center",
  },
  stripValueEn: { fontSize: 11, color: colors.textMuted, textAlign: "center" },
  stripDivider: { width: 1, height: 44, backgroundColor: colors.gold + "40" },
  samvatRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    borderTopWidth: 1,
    borderTopColor: colors.gold + "30",
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
  },
  samvatItem: { alignItems: "center" },
  samvatLabelHi: { fontSize: 11, color: colors.gold, marginBottom: 2 },
  samvatValue: {
    fontSize: typography.fontSize.lg,
    color: colors.textPrimary,
    fontWeight: typography.fontWeight.bold,
  },
  grid2: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  biCell: {
    width: "48%",
    marginBottom: spacing.md,
    backgroundColor: colors.gold + "12",
    borderRadius: 10,
    padding: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.gold + "60",
  },
  biCellFull: { width: "100%" },
  biCellLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  biCellLabelEn: {
    fontSize: 10,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  biCellLabelHi: { fontSize: 11, color: colors.gold + "CC" },
  biCellValueEn: {
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
    fontWeight: typography.fontWeight.semibold,
  },
  biCellValueHi: {
    fontSize: typography.fontSize.sm,
    color: colors.gold,
    marginTop: 2,
  },
  biCellSub: { fontSize: 10, color: colors.textMuted, marginTop: 4 },
  infoCell: {
    width: "48%",
    marginBottom: spacing.md,
    backgroundColor: colors.gold + "10",
    borderRadius: 10,
    padding: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.gold + "40",
  },
  infoCellLabel: {
    fontSize: 10,
    color: colors.textMuted,
    marginBottom: 4,
    lineHeight: 15,
  },
  infoCellValue: {
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
    fontWeight: typography.fontWeight.semibold,
  },
  infoCellSub: { fontSize: 10, color: colors.textMuted, marginTop: 3 },
  accent: { color: colors.gold },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  pill: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  pillText: { fontSize: 11, fontWeight: typography.fontWeight.semibold },
  moonRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  moonDetails: { flex: 1, gap: 2 },
  moonLabelHi: { fontSize: 11, color: colors.gold + "CC", marginTop: 6 },
  moonValue: {
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
    fontWeight: typography.fontWeight.semibold,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: spacing.md,
  },
  sectionLine: { flex: 1, height: 1, backgroundColor: colors.gold + "40" },
  sectionPill: {
    backgroundColor: colors.gold + "20",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginHorizontal: spacing.sm,
    alignItems: "center",
  },
  sectionEn: { fontSize: 10, color: colors.textMuted },
  sectionHi: { fontSize: 11, color: colors.gold },
  timingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gold + "15",
    gap: 8,
  },
  dot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  timingIcon: { fontSize: 16, width: 22, textAlign: "center" },
  timingLabels: { flex: 1 },
  timingLabelEn: {
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
    fontWeight: typography.fontWeight.semibold,
  },
  timingLabelHi: { fontSize: 11, color: colors.gold + "CC", marginTop: 1 },
  timingTime: {
    fontSize: typography.fontSize.sm,
    color: colors.textMuted,
    textAlign: "right",
    lineHeight: 18,
  },
  avoidNote: {
    fontSize: typography.fontSize.sm,
    color: colors.textMuted,
    textAlign: "center",
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  toggleBtn: {
    alignItems: "center",
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
  },
  toggleText: {
    fontSize: typography.fontSize.sm,
    color: colors.gold,
    fontWeight: typography.fontWeight.semibold,
  },
  footer: {
    alignItems: "center",
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  footerMain: {
    fontSize: typography.fontSize.lg,
    color: colors.gold,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 1,
  },
  footerSub: {
    fontSize: typography.fontSize.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },

  // ── new additions ──────────────────────────────────────────────────────────
  locationPill: {
    marginTop: spacing.xs,
    backgroundColor: colors.gold + "15",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: colors.gold + "35",
  },
  locationPillTxt: { fontSize: 11, color: colors.gold, fontWeight: "600" },
  journeyBtn: {
    marginTop: spacing.sm,
    backgroundColor: colors.gold + "18",
    borderWidth: 1,
    borderColor: colors.gold + "45",
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  journeyBtnTxt: { fontSize: 12, fontWeight: "700", color: colors.gold },
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
