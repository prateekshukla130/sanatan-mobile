import React, { useMemo } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, ThemeColors } from "@/theme";

interface AIChatInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onStop: () => void;
  isGenerating: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export function AIChatInput({
  value,
  onChangeText,
  onSend,
  onStop,
  isGenerating,
  disabled,
  placeholder = "अपना प्रश्न लिखें… / Type your question…",
}: AIChatInputProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const canSend = !disabled && !isGenerating && value.trim().length > 0;

  return (
    <View style={styles.wrap}>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        multiline
        maxLength={2000}
        editable={!disabled}
      />
      {isGenerating ? (
        <Pressable style={[styles.sendBtn, styles.stopBtn]} onPress={onStop}>
          <Ionicons name="stop" size={18} color={colors.bgPrimary} />
        </Pressable>
      ) : (
        <Pressable
          style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
          onPress={onSend}
          disabled={!canSend}
        >
          <Ionicons
            name="send"
            size={16}
            color={canSend ? colors.bgPrimary : colors.textMuted}
          />
        </Pressable>
      )}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrap: {
      flexDirection: "row",
      alignItems: "flex-end",
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 8,
      backgroundColor: colors.bgSecondary,
      borderTopWidth: 1,
      borderTopColor: colors.cardBorder,
    },
    input: {
      flex: 1,
      maxHeight: 120,
      minHeight: 40,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: colors.cardBg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      color: colors.textPrimary,
      fontSize: 14,
    },
    sendBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.gold,
    },
    sendBtnDisabled: {
      backgroundColor: colors.cardBg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    stopBtn: {
      backgroundColor: colors.error,
    },
  });
}
