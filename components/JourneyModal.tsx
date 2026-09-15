import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme, ThemeColors } from "@/theme";
import { useLanguage } from "@/localization";
import {
  journeyService,
  DayLog,
  MonthStats,
} from "@/services/journeyService";

interface Props {
  visible: boolean;
  onClose: () => void;
}

export const JourneyModal: React.FC<Props> = ({ visible, onClose }) => {
  const { colors, spacing, typography } = useTheme();
  const { t } = useLanguage();
  const router = useRouter();
  const st = useMemo(() => makeStyles(colors, spacing, typography), [
    colors,
    spacing,
    typography,
  ]);

  const [today, setToday] = useState<DayLog | null>(null);
  const [month, setMonth] = useState<MonthStats | null>(null);
  const [streak, setStreak] = useState(0);

  const refresh = useCallback(async () => {
    const [t, m, s] = await Promise.all([
      journeyService.getToday(),
      journeyService.getMonthStats(),
      journeyService.getStreak(),
    ]);
    setToday(t);
    setMonth(m);
    setStreak(s);
  }, []);

  useEffect(() => {
    if (visible) refresh();
  }, [visible, refresh]);

  const toggleMorning = async () => {
    await journeyService.toggleMorningPrayer();
    refresh();
  };
  const toggleEvening = async () => {
    await journeyService.toggleEveningMeditation();
    refresh();
  };
  const addMeditation = async (min: number) => {
    await journeyService.logMeditationMinutes(min);
    refresh();
  };
  const addTempleVisit = async () => {
    await journeyService.logTempleVisit();
    refresh();
  };
  const addMala = async () => {
    await journeyService.logJapIncrement(108);
    refresh();
  };
  const toggleReading = async () => {
    await journeyService.markReadingDone();
    refresh();
  };

  const jap108Done = (today?.japCount ?? 0) >= 108;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={st.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={st.sheet}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* ── Header ── */}
            <View style={st.header}>
              <Text style={st.title}>🪷 {t("journey.title")}</Text>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* ── Streak ── */}
            <View style={st.streakBox}>
              <Text style={st.streakEmoji}>🔥</Text>
              <Text style={st.streakTxt}>
                {streak} {t("journey.streakUnit")}
              </Text>
            </View>

            {/* ── This Month ── */}
            <Text style={st.sectionLabel}>{t("journey.thisMonth")}</Text>
            <View style={st.divider} />
            <View style={st.statsGrid}>
              <StatItem
                emoji="🙏"
                label={t("journey.jaap")}
                value={`${(month?.jaap ?? 0).toLocaleString()}`}
                onAdd={addMala}
                addLabel="+108"
                st={st}
              />
              <StatItem
                emoji="🧘"
                label={t("journey.meditation")}
                value={`${month?.meditationMinutes ?? 0} ${t("journey.meditationUnit")}`}
                onAdd={() => addMeditation(10)}
                addLabel="+10"
                st={st}
              />
              <StatItem
                emoji="📖"
                label={t("journey.reading")}
                value={`${month?.readingDays ?? 0} ${t("journey.readingUnit")}`}
                onAdd={toggleReading}
                addLabel="+1"
                st={st}
              />
              <StatItem
                emoji="🛕"
                label={t("journey.temples")}
                value={`${month?.temples ?? 0}`}
                onAdd={addTempleVisit}
                addLabel="+1"
                st={st}
              />
            </View>

            {/* ── Today's Goal ── */}
            <Text style={st.sectionLabel}>{t("journey.todaysGoal")}</Text>
            <View style={st.divider} />

            <GoalRow
              done={today?.morningPrayer ?? false}
              label={t("journey.morningPrayer")}
              onPress={toggleMorning}
              st={st}
              colors={colors}
            />
            <GoalRow
              done={jap108Done}
              label={t("journey.jap108")}
              onPress={() => router.push("/(tabs)/jap" as any)}
              st={st}
              colors={colors}
            />
            <GoalRow
              done={today?.eveningMeditation ?? false}
              label={t("journey.eveningMeditation")}
              onPress={toggleEvening}
              st={st}
              colors={colors}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const StatItem = ({
  emoji,
  label,
  value,
  onAdd,
  addLabel,
  st,
}: {
  emoji: string;
  label: string;
  value: string;
  onAdd: () => void;
  addLabel: string;
  st: ReturnType<typeof makeStyles>;
}) => (
  <View style={st.statCell}>
    <Text style={st.statEmoji}>{emoji}</Text>
    <View style={{ flex: 1 }}>
      <Text style={st.statLabel}>{label}</Text>
      <Text style={st.statValue}>{value}</Text>
    </View>
    <TouchableOpacity style={st.addBtn} onPress={onAdd} activeOpacity={0.7}>
      <Text style={st.addBtnTxt}>{addLabel}</Text>
    </TouchableOpacity>
  </View>
);

const GoalRow = ({
  done,
  label,
  onPress,
  st,
  colors,
}: {
  done: boolean;
  label: string;
  onPress: () => void;
  st: ReturnType<typeof makeStyles>;
  colors: ThemeColors;
}) => (
  <TouchableOpacity style={st.goalRow} onPress={onPress} activeOpacity={0.75}>
    <Ionicons
      name={done ? "checkmark-circle" : "ellipse-outline"}
      size={22}
      color={done ? colors.success : colors.textMuted}
    />
    <Text style={[st.goalLabel, done && st.goalLabelDone]}>{label}</Text>
  </TouchableOpacity>
);

function makeStyles(
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
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      borderWidth: 1,
      borderColor: colors.gold + "30",
      maxHeight: "82%",
      padding: spacing.md,
      paddingBottom: spacing.xl,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing.sm,
    },
    title: {
      fontSize: typography.fontSize.xl,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    streakBox: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: colors.gold + "15",
      borderWidth: 1,
      borderColor: colors.gold + "35",
      borderRadius: 14,
      paddingVertical: spacing.md,
      marginBottom: spacing.md,
    },
    streakEmoji: { fontSize: 22 },
    streakTxt: {
      fontSize: typography.fontSize.lg,
      fontWeight: "700",
      color: colors.gold,
    },
    sectionLabel: {
      fontSize: 12,
      fontWeight: "800",
      color: colors.gold,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      marginTop: spacing.sm,
      marginBottom: 6,
    },
    divider: {
      height: 1,
      backgroundColor: colors.divider,
      marginBottom: spacing.sm,
    },
    statsGrid: {
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    statCell: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      backgroundColor: colors.cardBg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 12,
      padding: spacing.sm,
    },
    statEmoji: { fontSize: 22 },
    statLabel: { fontSize: 12, color: colors.textMuted },
    statValue: {
      fontSize: typography.fontSize.md,
      fontWeight: "700",
      color: colors.textPrimary,
      marginTop: 1,
    },
    addBtn: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: colors.gold + "20",
      borderWidth: 1,
      borderColor: colors.gold + "45",
    },
    addBtnTxt: { fontSize: 12, fontWeight: "700", color: colors.gold },
    goalRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    goalLabel: {
      fontSize: typography.fontSize.md,
      color: colors.textPrimary,
      fontWeight: "600",
    },
    goalLabelDone: {
      color: colors.textMuted,
      textDecorationLine: "line-through",
    },
  });
}
