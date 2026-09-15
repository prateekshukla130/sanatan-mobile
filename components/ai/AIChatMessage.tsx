import React, { memo, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, ThemeColors } from "@/theme";
import { ChatMessage } from "@/types/ai";

interface AIChatMessageProps {
  message: ChatMessage;
  onCopy?: (text: string) => void;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const hours = d.getHours() % 12 || 12;
  const minutes = d.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes} ${d.getHours() >= 12 ? "PM" : "AM"}`;
}

function AIChatMessageComponent({ message, onCopy }: AIChatMessageProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const isUser = message.role === "user";

  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowAI]}>
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAI]}>
        <Text style={[styles.text, isUser ? styles.textUser : styles.textAI]}>
          {message.content}
        </Text>
        <View style={styles.footer}>
          <Text style={styles.time}>{formatTime(message.createdAt)}</Text>
          {!isUser && onCopy && message.content.length > 0 && (
            <Pressable
              hitSlop={8}
              onPress={() => onCopy(message.content)}
              style={styles.copyBtn}
            >
              <Ionicons name="copy-outline" size={13} color={colors.textMuted} />
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

export const AIChatMessage = memo(AIChatMessageComponent, (prev, next) => {
  return (
    prev.message.id === next.message.id &&
    prev.message.content === next.message.content
  );
});

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    row: { paddingHorizontal: 12, marginVertical: 4 },
    rowUser: { alignItems: "flex-end" },
    rowAI: { alignItems: "flex-start" },
    bubble: {
      maxWidth: "84%",
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    bubbleUser: {
      backgroundColor: colors.gold,
      borderBottomRightRadius: 4,
    },
    bubbleAI: {
      backgroundColor: colors.cardBg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderBottomLeftRadius: 4,
    },
    text: { fontSize: 14, lineHeight: 20 },
    textUser: { color: colors.bgPrimary, fontWeight: "500" },
    textAI: { color: colors.textPrimary },
    footer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      marginTop: 4,
      gap: 8,
    },
    time: { fontSize: 9, color: colors.textMuted },
    copyBtn: { padding: 2 },
  });
}
