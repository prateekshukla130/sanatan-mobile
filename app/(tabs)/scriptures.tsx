/**
 * ScripturesScreen.tsx (Integrated)
 *
 * Combines Gita (existing) + Chalisas (new)
 * - Tab 1: गीता (Gita chapters - existing functionality)
 * - Tab 2: चालीसा (Chalisas - new single scroll detail view)
 */

import React, { useEffect, useState, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  ScrollView,
  Dimensions,
  Share,
  Animated as RNAnimated,
} from "react-native";
import { GradientBackground } from "../../components/GradientBackground";
import { useTheme, ThemeColors, spacing, typography } from "../../theme";
import { gitaService, Chapter, Verse } from "../../services/gitaService";
import { chalisasService, Chalisa } from "../../services/chalisasService";
import { Ionicons } from "@expo/vector-icons";

const { width: SW, height: SH } = Dimensions.get("window");

// ─────────────────────────────────────────────
// SHARED THEME-AWARE STYLES
// ─────────────────────────────────────────────
function useScripturesStyles() {
  const { colors, spacing, typography } = useTheme();
  const styles = useMemo(
    () => makeStyles(colors, spacing, typography),
    [colors, spacing, typography],
  );
  return { colors, spacing, typography, styles };
}

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────

const CH_ACCENT = [
  "#E8933A",
  "#D4A017",
  "#C06020",
  "#B8860B",
  "#CF7A2A",
  "#A0522D",
  "#CD853F",
  "#DAA520",
  "#B8732A",
  "#C97B2A",
  "#E8901A",
  "#D4890A",
  "#C47B0A",
  "#F0A500",
  "#E09020",
  "#D08010",
  "#C07000",
  "#B06000",
];
const CH_SYMBOL = [
  "🔱",
  "🪷",
  "⚔️",
  "🕉️",
  "🌿",
  "🧘",
  "✨",
  "🌺",
  "🙏",
  "💫",
  "🌸",
  "🌊",
  "🔥",
  "🌙",
  "☀️",
  "🌟",
  "💎",
  "🕊️",
];

const CHALISA_ACCENT = "#E8933A";

// ─────────────────────────────────────────────
// UTILITY FUNCTIONS
// ─────────────────────────────────────────────

function accent(chNum: number): string {
  return CH_ACCENT[(chNum - 1) % CH_ACCENT.length];
}

function symbol(chNum: number): string {
  return CH_SYMBOL[(chNum - 1) % CH_SYMBOL.length];
}

function toRoman(n: number): string {
  const v = [10, 9, 5, 4, 1],
    s = ["X", "IX", "V", "IV", "I"];
  let r = "";
  for (let i = 0; i < v.length; i++) {
    while (n >= v[i]) {
      r += s[i];
      n -= v[i];
    }
  }
  return r;
}

// Helper to get text by language
function getText(obj: any, lang: string): string {
  if (!obj) return "";
  return obj[lang] || obj.hindi || "";
}

// Split chaupai by ॥
function splitParagraphs(text: string): string[] {
  return text
    .split("॥")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

// ─────────────────────────────────────────────
// ATOMS
// ─────────────────────────────────────────────

const FadeIn = ({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) => {
  const op = useRef(new RNAnimated.Value(0)).current;
  const ty = useRef(new RNAnimated.Value(18)).current;
  useEffect(() => {
    RNAnimated.parallel([
      RNAnimated.timing(op, {
        toValue: 1,
        duration: 340,
        delay,
        useNativeDriver: true,
      }),
      RNAnimated.timing(ty, {
        toValue: 0,
        duration: 340,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);
  return (
    <RNAnimated.View style={{ opacity: op, transform: [{ translateY: ty }] }}>
      {children}
    </RNAnimated.View>
  );
};

// ─────────────────────────────────────────────
// CHAPTER CARD (GITA)
// ─────────────────────────────────────────────

const ChapterCard = React.memo(
  ({
    item,
    index,
    onPress,
  }: {
    item: Chapter;
    index: number;
    onPress: () => void;
  }) => {
    const { styles } = useScripturesStyles();
    const a = accent(item.number);
    const s = symbol(item.number);
    const scale = useRef(new RNAnimated.Value(1)).current;

    const onPressIn = () =>
      RNAnimated.spring(scale, {
        toValue: 0.97,
        useNativeDriver: true,
        speed: 30,
      }).start();
    const onPressOut = () =>
      RNAnimated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 30,
      }).start();

    return (
      <FadeIn delay={index * 35}>
        <RNAnimated.View style={{ transform: [{ scale }] }}>
          <TouchableOpacity
            style={[styles.chCard, { borderLeftColor: a }]}
            onPress={onPress}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            activeOpacity={1}
          >
            <Text style={[styles.chWatermark, { color: a }]}>
              {toRoman(item.number)}
            </Text>
            <View style={styles.chTop}>
              <View
                style={[
                  styles.chCircle,
                  { backgroundColor: a + "22", borderColor: a + "55" },
                ]}
              >
                <Text style={[styles.chCircleNum, { color: a }]}>
                  {item.number}
                </Text>
              </View>
              <View style={styles.chBadges}>
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: a + "18", borderColor: a + "40" },
                  ]}
                >
                  <Text style={{ fontSize: 11 }}>{s}</Text>
                  <Text style={[styles.badgeTxt, { color: a }]}>
                    {item.verses} श्लोक
                  </Text>
                </View>
              </View>
            </View>
            <Text style={styles.chSanskrit}>{item.name}</Text>
            <Text style={styles.chMeaning}>{item.meaning}</Text>
          </TouchableOpacity>
        </RNAnimated.View>
      </FadeIn>
    );
  },
);

// ─────────────────────────────────────────────
// CHALISA CARD (CHALISAS LIST)
// ─────────────────────────────────────────────

const ChalisaCard = React.memo(
  ({
    item,
    index,
    onPress,
  }: {
    item: any;
    index: number;
    onPress: () => void;
  }) => {
    const { styles } = useScripturesStyles();
    const scale = useRef(new RNAnimated.Value(1)).current;

    const onPressIn = () =>
      RNAnimated.spring(scale, {
        toValue: 0.97,
        useNativeDriver: true,
        speed: 30,
      }).start();
    const onPressOut = () =>
      RNAnimated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 30,
      }).start();

    return (
      <FadeIn delay={index * 35}>
        <RNAnimated.View style={{ transform: [{ scale }] }}>
          <TouchableOpacity
            style={[styles.chCard, { borderLeftColor: CHALISA_ACCENT }]}
            onPress={onPress}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            activeOpacity={1}
          >
            <View style={styles.chTop}>
              <View
                style={[
                  styles.chCircle,
                  {
                    backgroundColor: CHALISA_ACCENT + "22",
                    borderColor: CHALISA_ACCENT + "55",
                  },
                ]}
              >
                <Text style={{ fontSize: 20 }}>🙏</Text>
              </View>
              <View style={styles.chBadges}>
                <View
                  style={[
                    styles.badge,
                    {
                      backgroundColor: CHALISA_ACCENT + "18",
                      borderColor: CHALISA_ACCENT + "40",
                    },
                  ]}
                >
                  <Text style={[styles.badgeTxt, { color: CHALISA_ACCENT }]}>
                    चालीसा
                  </Text>
                </View>
              </View>
            </View>
            <Text style={styles.chSanskrit}>{getText(item.title, "hindi")}</Text>
            <Text style={styles.chMeaning}>भक्ति ग्रंथ</Text>
          </TouchableOpacity>
        </RNAnimated.View>
      </FadeIn>
    );
  },
);

// ─────────────────────────────────────────────
// VERSE CARD (GITA)
// ─────────────────────────────────────────────

const VerseCard = React.memo(
  ({ item, a, onPress }: { item: Verse; a: string; onPress: () => void }) => {
    const { styles } = useScripturesStyles();
    return (
    <TouchableOpacity
      style={[styles.vCard, { borderTopColor: a + "55" }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View
        style={[styles.vPill, { backgroundColor: a + "20", borderColor: a + "55" }]}
      >
        <Text style={[styles.vPillTxt, { color: a }]}>श्लोक {item.verse}</Text>
      </View>
      <Text style={styles.vSanskrit} numberOfLines={2}>
        {item.sanskrit}
      </Text>
      <Text style={styles.vTransl} numberOfLines={2}>
        {item.translation}
      </Text>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 3,
          marginTop: spacing.xs,
        }}
      >
        <Text style={[styles.vMore, { color: a }]}>Read more</Text>
        <Ionicons name="chevron-forward" size={11} color={a} />
      </View>
    </TouchableOpacity>
    );
  },
);

// ─────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────

export default function ScripturesScreen() {
  const { colors, styles } = useScripturesStyles();
  const [tab, setTab] = useState<"gita" | "chalisas">("gita");

  // GITA STATE
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<number | undefined>();
  const [verses, setVerses] = useState<Verse[]>([]);
  const [currentVerseIndex, setCurrentVerseIndex] = useState(1);
  const [selectedVerse, setSelectedVerse] = useState<Verse | null>(null);

  // CHALISAS STATE
  const [chalisas, setChalisas] = useState<any[]>([]);
  const [selectedChalisa, setSelectedChalisa] = useState<any | null>(null);
  const [chalisaLang, setChalisaLang] = useState<
    "hindi" | "english" | "sanskrit"
  >("hindi");

  // ── Data loading ───────────────────────────
  useEffect(() => {
    gitaService.getAllChapters().then(setChapters);
    loadChalisas();
  }, []);

  const loadChalisas = async () => {
    const data = await chalisasService.getAllChalisas();
    setChalisas(data);
  };

  useEffect(() => {
    if (selectedChapter) {
      gitaService.getShloks(selectedChapter, currentVerseIndex).then(setVerses);
    }
  }, [selectedChapter, currentVerseIndex]);

  const handleVerseChange = (dir: "prev" | "next") => {
    const totalV = selectedChapter
      ? chapters.find((ch) => ch.number === selectedChapter)?.verses || 0
      : 0;
    setCurrentVerseIndex((prev) => {
      if (dir === "prev" && prev > 1) return prev - 1;
      if (dir === "next" && prev < totalV) return prev + 1;
      return prev;
    });
  };

  const toggleBookmark = (key: string) => {
    // Implement bookmark logic here
  };

  // ─────────────────────────────────────────
  // GITA VIEW
  // ─────────────────────────────────────────

  if (tab === "gita") {
    if (!selectedChapter) {
      return (
        <GradientBackground>
          <View style={styles.root}>
            {/* Header */}
            <View style={styles.hdr}>
              <Text style={styles.hdrOm}>ॐ</Text>
              <View>
                <Text style={styles.hdrTitle}>भगवद् गीता</Text>
                <Text style={styles.hdrSub}>18 अध्याय · 700 श्लोक</Text>
              </View>
            </View>

            {/* Tabs */}
            <View style={styles.tabsContainer}>
              <TouchableOpacity
                style={[
                  styles.tab,
                  tab === "gita" && {
                    borderBottomColor: colors.gold,
                    borderBottomWidth: 3,
                  },
                ]}
                onPress={() => setTab("gita")}
              >
                <Text
                  style={[
                    styles.tabText,
                    tab === "gita" && {
                      color: colors.gold,
                      fontWeight: "bold",
                    },
                  ]}
                >
                  📖 गीता
                </Text>
                <Text
                  style={[
                    styles.chalisaTabTextEnglish,
                    tab === "gita" && {
                      color: colors.gold,
                      fontWeight: "bold",
                    },
                  ]}
                >
                  Geeta
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.tab,
                  tab === "chalisas" && {
                    borderBottomColor: CHALISA_ACCENT,
                    borderBottomWidth: 3,
                  },
                ]}
                onPress={() => setTab("chalisas")}
              >
                <Text
                  style={[
                    styles.tabText,
                    tab === "chalisas" && {
                      color: CHALISA_ACCENT,
                      fontWeight: "bold",
                    },
                  ]}
                >
                  🙏 चालीसा
                </Text>
                <Text
                  style={[
                    styles.chalisaTabTextEnglish,
                    tab === "chalisas" && {
                      color: colors.gold,
                      fontWeight: "bold",
                    },
                  ]}
                >
                  Chalisa
                </Text>
              </TouchableOpacity>
            </View>

            {/* Chapters List */}
            <FlatList
              data={chapters}
              keyExtractor={(i) => i.number.toString()}
              renderItem={({ item, index }) => (
                <ChapterCard
                  item={item}
                  index={index}
                  onPress={() => {
                    setSelectedChapter(item.number);
                    setCurrentVerseIndex(1);
                  }}
                />
              )}
              contentContainerStyle={styles.listPad}
            />
          </View>
        </GradientBackground>
      );
    }

    // Verses view
    const chData = chapters.find((ch) => ch.number === selectedChapter);
    const a = accent(selectedChapter);

    return (
      <GradientBackground>
        <View style={styles.root}>
          {/* Header */}
          <View style={[styles.mHdr, { borderBottomColor: a + "40" }]}>
            <TouchableOpacity
              style={[
                styles.mBackBtn,
                { backgroundColor: a + "18", borderColor: a + "40" },
              ]}
              onPress={() => setSelectedChapter(undefined)}
            >
              <Ionicons name="chevron-back" size={22} color={a} />
            </TouchableOpacity>
            <View style={{ alignItems: "center", flex: 1 }}>
              <Text style={[styles.mHdrName, { color: a }]} numberOfLines={1}>
                {chData?.name}
              </Text>
            </View>
            <View style={{ width: 40 }} />
          </View>

          {/* Navigation */}
          <View style={[styles.navBar, { borderColor: a + "35" }]}>
            <TouchableOpacity
              style={[styles.navBtn, currentVerseIndex <= 1 && styles.navBtnDim]}
              onPress={() => handleVerseChange("prev")}
              disabled={currentVerseIndex <= 1}
            >
              <Ionicons
                name="chevron-back"
                size={20}
                color={currentVerseIndex <= 1 ? colors.textMuted + "40" : a}
              />
            </TouchableOpacity>
            <Text style={[styles.navCount, { color: a }]}>
              {currentVerseIndex}/{chData?.verses}
            </Text>
            <TouchableOpacity
              style={[
                styles.navBtn,
                currentVerseIndex >= (chData?.verses ?? 0) && styles.navBtnDim,
              ]}
              onPress={() => handleVerseChange("next")}
              disabled={currentVerseIndex >= (chData?.verses ?? 0)}
            >
              <Ionicons
                name="chevron-forward"
                size={20}
                color={
                  currentVerseIndex >= (chData?.verses ?? 0)
                    ? colors.textMuted + "40"
                    : a
                }
              />
            </TouchableOpacity>
          </View>

          {/* Verses List */}
          <FlatList
            data={verses}
            keyExtractor={(i) => `${i.chapter}-${i.verse}`}
            renderItem={({ item }) => (
              <VerseCard
                item={item}
                a={a}
                onPress={() => setSelectedVerse(item)}
              />
            )}
            contentContainerStyle={[styles.listPad, { paddingBottom: 40 }]}
          />

          {/* Verse Detail Modal */}
          <Modal
            visible={selectedVerse !== null}
            animationType="slide"
            onRequestClose={() => setSelectedVerse(null)}
            transparent
          >
            <GradientBackground>
              <View style={styles.vsOverlay}>
                <TouchableOpacity
                  style={StyleSheet.absoluteFillObject}
                  activeOpacity={1}
                  onPress={() => setSelectedVerse(null)}
                />
                <View style={styles.vsSheet}>
                  <View style={styles.vsHandle} />
                  {selectedVerse && (
                    <>
                      <View style={[styles.vsHdr, { borderBottomColor: a + "40" }]}>
                        <Text style={[styles.vsHdrChapter, { color: a }]}>
                          श्लोक {selectedVerse.verse}
                        </Text>
                        <View style={styles.vsActions}>
                          <TouchableOpacity
                            style={styles.vsActionBtn}
                            onPress={() =>
                              toggleBookmark(
                                `gita-${selectedVerse.chapter}-${selectedVerse.verse}`,
                              )
                            }
                          >
                            <Ionicons
                              name="bookmark-outline"
                              size={20}
                              color={colors.textMuted}
                            />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.vsActionBtn}
                            onPress={() =>
                              Share.share({
                                message: `${selectedVerse.sanskrit}\n\n${selectedVerse.translation}`,
                              })
                            }
                          >
                            <Ionicons
                              name="share-outline"
                              size={20}
                              color={colors.textMuted}
                            />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[
                              styles.vsActionBtn,
                              { backgroundColor: colors.cardBorder + "80" },
                            ]}
                            onPress={() => setSelectedVerse(null)}
                          >
                            <Ionicons
                              name="close"
                              size={18}
                              color={colors.textPrimary}
                            />
                          </TouchableOpacity>
                        </View>
                      </View>
                      <ScrollView
                        style={styles.vsScroll}
                        contentContainerStyle={styles.vsScrollContent}
                        showsVerticalScrollIndicator={false}
                      >
                        <View
                          style={[
                            styles.sanskritBox,
                            {
                              borderColor: a + "45",
                              backgroundColor: a + "08",
                            },
                          ]}
                        >
                          <Text style={styles.sanskritTxt}>
                            {selectedVerse.sanskrit}
                          </Text>
                        </View>
                        <Text style={styles.translTxt}>
                          {selectedVerse.translation}
                        </Text>
                      </ScrollView>
                    </>
                  )}
                </View>
              </View>
            </GradientBackground>
          </Modal>
        </View>
      </GradientBackground>
    );
  }

  // ─────────────────────────────────────────
  // CHALISAS VIEW - LIST
  // ─────────────────────────────────────────

  if (tab === "chalisas" && !selectedChalisa) {
    return (
      <GradientBackground>
        <View style={styles.root}>
          {/* Header */}
          <View style={styles.hdr}>
            <Text style={styles.hdrOm}>ॐ</Text>
            <View>
              <Text style={styles.hdrTitle}>चालीसा</Text>
              <Text style={styles.hdrSub}>{chalisas.length} भक्ति ग्रंथ</Text>
            </View>
          </View>

          {/* Tabs */}
          <View style={styles.tabsContainer}>
            <TouchableOpacity
              style={[
                styles.tab,
                tab === "gita" && {
                  borderBottomColor: colors.gold,
                  borderBottomWidth: 3,
                },
              ]}
              onPress={() => setTab("gita")}
            >
              <Text
                style={[
                  styles.tabText,
                  tab === "gita" && { color: colors.gold, fontWeight: "bold" },
                ]}
              >
                📖 गीता
              </Text>
              <Text
                style={[
                  styles.chalisaTabTextEnglish,
                  tab === "gita" && {
                    color: colors.gold,
                    fontWeight: "bold",
                  },
                ]}
              >
                Geeta
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.tab,
                tab === "chalisas" && {
                  borderBottomColor: CHALISA_ACCENT,
                  borderBottomWidth: 3,
                },
              ]}
              onPress={() => setTab("chalisas")}
            >
              <Text
                style={[
                  styles.tabText,
                  tab === "chalisas" && {
                    color: CHALISA_ACCENT,
                    fontWeight: "bold",
                  },
                ]}
              >
                🙏 चालीसा
              </Text>
              <Text
                style={[
                  styles.chalisaTabTextEnglish,
                  tab === "chalisas" && {
                    color: colors.gold,
                    fontWeight: "bold",
                  },
                ]}
              >
                Chalisa
              </Text>
            </TouchableOpacity>
          </View>

          {/* Chalisas List */}
          <FlatList
            data={chalisas}
            keyExtractor={(i) => i.id}
            renderItem={({ item, index }) => (
              <ChalisaCard
                item={item}
                index={index}
                onPress={() => setSelectedChalisa(item)}
              />
            )}
            contentContainerStyle={styles.listPad}
          />
        </View>
      </GradientBackground>
    );
  }

  // ─────────────────────────────────────────
  // CHALISAS VIEW - DETAIL (SINGLE SCROLL)
  // ─────────────────────────────────────────

  if (tab === "chalisas" && selectedChalisa) {
    return (
      <GradientBackground>
        <View style={styles.root}>
          {/* Header with Back & Share */}
          <View style={styles.chalisaHeader}>
            <TouchableOpacity
              style={styles.chalisaBackBtn}
              onPress={() => setSelectedChalisa(null)}
            >
              <Ionicons name="chevron-back" size={24} color={CHALISA_ACCENT} />
            </TouchableOpacity>
            <Text style={styles.chalisaHeaderTitle} numberOfLines={1}>
              {getText(selectedChalisa.title, "hindi")}
            </Text>
            <TouchableOpacity
              style={styles.chalisaShareBtn}
              onPress={() => {
                const content = `${getText(selectedChalisa.title, "hindi")}\n\n${getText(selectedChalisa.startingDoha, "hindi")}\n\n${getText(selectedChalisa.chaupai, "hindi")}\n\n${getText(selectedChalisa.jaiKara, "hindi")}`;
                Share.share({ message: content });
              }}
            >
              <Ionicons name="share-outline" size={22} color={CHALISA_ACCENT} />
            </TouchableOpacity>
          </View>

          {/* Language Tabs */}
          <View style={styles.chalisaTabsContainer}>
            {["hindi", "english"].map((l) => (
              <TouchableOpacity
                key={l}
                style={[
                  styles.chalisaTab,
                  chalisaLang === l && styles.chalisaTabActive,
                ]}
                onPress={() =>
                  setChalisaLang(l as "hindi" | "english" | "sanskrit")
                }
              >
                <Text
                  style={[
                    styles.chalisaTabText,
                    chalisaLang === l && styles.chalisaTabTextActive,
                  ]}
                >
                  {l === "hindi"
                    ? "हिंदी"
                    : l === "english"
                      ? "English"
                      : "Sanskrit"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Content Scroll */}
          <ScrollView
            style={styles.chalisaScroll}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.chalisaContent}>
              {/* Title */}
              <View style={styles.chalisaTitleSection}>
                <Text style={styles.chalisaTitle}>
                  {getText(selectedChalisa.title, chalisaLang)}
                </Text>
              </View>

              <View style={styles.chalisaDivider} />

              {/* Starting Doha */}
              <View style={styles.chalisaSection}>
                <Text style={styles.chalisaSectionLabel}>Opening Verse (दोहा)</Text>
                <Text style={styles.chalisaDohaText}>
                  {getText(selectedChalisa.startingDoha, chalisaLang)}
                </Text>
              </View>

              <View style={styles.chalisaDivider} />

              {/* Chaupai */}
              <View style={styles.chalisaSection}>
                <Text style={styles.chalisaSectionLabel}>Body (चौपाई)</Text>
                {splitParagraphs(
                  getText(selectedChalisa.chaupai, chalisaLang),
                ).map((para, idx) => (
                  <View key={idx} style={styles.chalisaChaupaiPara}>
                    <Text style={styles.chalisaChaupaiText}>{para}॥</Text>
                  </View>
                ))}
              </View>

              {/* Ending Doha */}
              {selectedChalisa.endingDoha && (
                <>
                  <View style={styles.chalisaDivider} />
                  <View style={styles.chalisaSection}>
                    <Text style={styles.chalisaSectionLabel}>
                      Closing Verse (दोहा)
                    </Text>
                    <Text style={styles.chalisaDohaText}>
                      {getText(selectedChalisa.endingDoha, chalisaLang)}
                    </Text>
                  </View>
                </>
              )}

              {/* Jai Kara */}
              <View style={styles.chalisaDivider} />
              <View style={styles.chalisaSection}>
                <Text style={styles.chalisaSectionLabel}>Jai Kara (जय कारा)</Text>
                <Text style={styles.chalisaJaiKaraText}>
                  {getText(selectedChalisa.jaiKara, chalisaLang)}
                </Text>
              </View>

              <View style={{ height: spacing.xl }} />
            </View>
          </ScrollView>
        </View>
      </GradientBackground>
    );
  }

  return null;
}

// ─────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────

function makeStyles(
  colors: ThemeColors,
  spacing: Record<string, number>,
  typography: any,
) {
  return StyleSheet.create({
  root: { flex: 1 },

  // Header
  hdr: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    paddingTop: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.gold + "28",
  },
  hdrOm: {
    fontSize: 38,
    color: colors.gold,
    opacity: 0.82,
    marginRight: spacing.sm,
  },
  hdrTitle: {
    fontSize: typography.fontSize.xxl,
    fontWeight: "700",
    color: colors.gold,
  },
  hdrSub: { fontSize: 10, color: colors.textMuted, marginTop: 2 },

  // Tabs
  tabsContainer: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  tab: { flex: 1, paddingVertical: spacing.md, alignItems: "center" },
  tabText: {
    fontSize: typography.fontSize.md,
    color: colors.textMuted,
    fontWeight: "500",
  },

  listPad: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },

  // Chapter Card
  chCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderLeftWidth: 3,
    padding: spacing.md,
    marginBottom: spacing.sm,
    overflow: "hidden",
    position: "relative",
  },
  chWatermark: {
    position: "absolute",
    right: 10,
    top: 2,
    fontSize: 50,
    fontWeight: "900",
    opacity: 0.065,
  },
  chTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  chCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  chCircleNum: { fontSize: typography.fontSize.lg, fontWeight: "700" },
  chBadges: { flexDirection: "row", gap: spacing.xs },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  badgeTxt: { fontSize: 11, fontWeight: "600" },
  chSanskrit: {
    fontSize: typography.fontSize.xl,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 2,
  },
  chMeaning: { fontSize: typography.fontSize.sm, color: colors.textMuted },

  // Verse Card
  vCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderTopWidth: 2,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  vPill: {
    alignSelf: "flex-start",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  vPillTxt: { fontSize: 12, fontWeight: "bold" },
  vSanskrit: {
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
    lineHeight: 26,
    marginBottom: spacing.xs,
  },
  vTransl: {
    fontSize: typography.fontSize.sm,
    color: colors.textMuted,
    lineHeight: 20,
  },
  vMore: { fontSize: 11, fontWeight: "600" },

  // Middle Header
  mHdr: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    paddingTop: 52,
    borderBottomWidth: 1,
  },
  mBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  mHdrName: {
    fontSize: typography.fontSize.lg,
    fontWeight: "700",
    textAlign: "center",
    flex: 1,
  },

  // Navigation Bar
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: spacing.md,
    marginVertical: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    borderWidth: 1,
  },
  navBtn: { flexDirection: "row", alignItems: "center", gap: 2 },
  navBtnDim: { opacity: 0.4 },
  navCount: {
    fontSize: typography.fontSize.md,
    fontWeight: "700",
    minWidth: 42,
    textAlign: "center",
  },

  // Verse Modal
  vsOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "flex-end",
  },
  vsSheet: {
    backgroundColor: colors.bgSecondary,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    height: SH * 0.92,
    paddingBottom: 32,
  },
  vsHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.textMuted + "50",
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 4,
  },
  vsHdr: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  vsHdrChapter: { fontSize: typography.fontSize.md, fontWeight: "700" },
  vsActions: { flexDirection: "row", gap: spacing.sm },
  vsActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  vsScroll: { flex: 1 },
  vsScrollContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  sanskritBox: {
    borderRadius: 16,
    borderWidth: 1,
    padding: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    alignItems: "center",
  },
  sanskritTxt: {
    fontSize: typography.fontSize.xl,
    color: colors.textPrimary,
    textAlign: "center",
    lineHeight: 28,
    fontWeight: "500",
  },
  translTxt: {
    fontSize: typography.fontSize.lg,
    color: colors.textPrimary,
    lineHeight: 24,
    marginVertical: spacing.xs,
  },

  // Chalisa Detail Header
  chalisaHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    paddingTop: 48,
    borderBottomWidth: 1,
    borderBottomColor: CHALISA_ACCENT + "20",
    backgroundColor: colors.cardBg + "40",
  },
  chalisaBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  chalisaHeaderTitle: {
    flex: 1,
    fontSize: typography.fontSize.lg,
    fontWeight: "700",
    color: CHALISA_ACCENT,
    marginHorizontal: spacing.md,
    letterSpacing: 0.5,
  },
  chalisaShareBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },

  // Chalisa Tabs
  chalisaTabsContainer: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
    backgroundColor: colors.cardBg + "20",
  },
  chalisaTab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  chalisaTabActive: { borderBottomColor: CHALISA_ACCENT },
  chalisaTabText: {
    fontSize: typography.fontSize.sm,
    fontWeight: "600",
    color: colors.textMuted,
    letterSpacing: 0.3,
  },
  chalisaTabTextEnglish: {
    fontSize: typography.fontSize.xs,
    fontWeight: "600",
    color: colors.textMuted,
    letterSpacing: 0.3,
    marginLeft: 25,
  },
  chalisaTabTextActive: { color: CHALISA_ACCENT, fontWeight: "700" },

  // Chalisa Content
  chalisaScroll: { flex: 1 },
  chalisaContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },

  chalisaTitleSection: {
    alignItems: "center",
    marginBottom: spacing.lg,
    paddingVertical: spacing.lg,
    borderRadius: 16,
    backgroundColor: CHALISA_ACCENT + "10",
  },
  chalisaTitle: {
    fontSize: typography.fontSize.xxl,
    fontWeight: "700",
    color: CHALISA_ACCENT,
    textAlign: "center",
    lineHeight: 40,
    letterSpacing: 0.5,
  },

  chalisaDivider: {
    height: 1,
    backgroundColor: CHALISA_ACCENT + "15",
    marginVertical: spacing.lg,
  },

  chalisaSection: { marginBottom: spacing.lg },
  chalisaSectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: CHALISA_ACCENT,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: spacing.md,
  },

  chalisaDohaText: {
    fontSize: typography.fontSize.lg,
    fontWeight: "500",
    color: colors.textPrimary,
    lineHeight: 34,
    textAlign: "center",
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    backgroundColor: CHALISA_ACCENT + "08",
  },

  chalisaChaupaiPara: { marginBottom: spacing.md, paddingVertical: spacing.sm },
  chalisaChaupaiText: {
    fontSize: typography.fontSize.md,
    fontWeight: "400",
    color: colors.textPrimary,
    lineHeight: 30,
    textAlign: "justify",
  },

  chalisaJaiKaraText: {
    fontSize: typography.fontSize.lg,
    fontWeight: "600",
    color: CHALISA_ACCENT,
    lineHeight: 32,
    textAlign: "center",
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    backgroundColor: CHALISA_ACCENT + "12",
  },
  });
}
