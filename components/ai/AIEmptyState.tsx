import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTheme, ThemeColors } from "@/theme";

const SUGGESTIONS = [
  "आज का मंत्र",
  "ध्यान कैसे करें?",
  "भगवान शिव के बारे में बताएं",
  "गीता से क्या सीख सकते हैं?",
  "सुबह की पूजा कैसे करें?",
  "हनुमान चालीसा का महत्व क्या है?",
];

interface AIEmptyStateProps {
  onSuggestionPress: (text: string) => void;
}

export function AIEmptyState({ onSuggestionPress }: AIEmptyStateProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.wrap}>
      <View style={styles.omCircle}>
        <Text style={styles.omText}>ॐ</Text>
      </View>
      <Text style={styles.greeting}>नमस्ते 🙏</Text>
      <Text style={styles.title}>मैं दिव्य वाणी हूँ</Text>
      <Text style={styles.subtitle}>
        आप मुझसे धर्म, ध्यान, मंत्र, पूजा, भक्ति, योग और भारतीय आध्यात्मिक परंपराओं के
        बारे में पूछ सकते हैं।
      </Text>

      <ScrollView
        contentContainerStyle={styles.chipsWrap}
        showsVerticalScrollIndicator={false}
      >
        {SUGGESTIONS.map((s) => (
          <Pressable
            key={s}
            style={styles.chip}
            onPress={() => onSuggestionPress(s)}
          >
            <Text style={styles.chipText}>{s}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrap: { flex: 1, alignItems: "center", paddingTop: 32, paddingHorizontal: 20 },
    omCircle: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.gold + "1A",
      borderWidth: 1.5,
      borderColor: colors.gold + "55",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 12,
    },
    omText: { fontSize: 30, color: colors.gold },
    greeting: { fontSize: 20, color: colors.textPrimary, fontWeight: "700" },
    title: { fontSize: 15, color: colors.gold, marginTop: 4, fontWeight: "600" },
    subtitle: {
      fontSize: 13,
      color: colors.textMuted,
      textAlign: "center",
      marginTop: 10,
      lineHeight: 19,
      paddingHorizontal: 8,
    },
    chipsWrap: {
      marginTop: 24,
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: 8,
      paddingBottom: 24,
    },
    chip: {
      backgroundColor: colors.cardBg,
      borderWidth: 1,
      borderColor: colors.gold + "33",
      borderRadius: 18,
      paddingHorizontal: 14,
      paddingVertical: 9,
      margin: 4,
    },
    chipText: { fontSize: 12.5, color: colors.textPrimary },
  });
}
