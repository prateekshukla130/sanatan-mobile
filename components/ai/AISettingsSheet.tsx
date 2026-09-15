import React, { forwardRef, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BottomSheetModal, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, ThemeColors } from "@/theme";
import { MODEL_REGISTRY } from "@/services/modelService";
import { GenerationOptions, ModelId } from "@/types/ai";

interface AISettingsSheetProps {
  currentModelId: ModelId;
  readyModelIds: ModelId[];
  options: GenerationOptions;
  onModelChange: (modelId: ModelId) => void;
  onOptionsChange: (options: GenerationOptions) => void;
  onManageModels: () => void;
  onClearChat: () => void;
}

function Stepper({
  label,
  value,
  onChange,
  min,
  max,
  step,
  format,
  colors,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  format?: (v: number) => string;
  colors: ThemeColors;
}) {
  const styles = makeStyles(colors);
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v * 100) / 100));
  return (
    <View style={styles.stepperRow}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperControls}>
        <Pressable
          style={styles.stepperBtn}
          onPress={() => onChange(clamp(value - step))}
        >
          <Ionicons name="remove" size={16} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.stepperValue}>{format ? format(value) : value}</Text>
        <Pressable
          style={styles.stepperBtn}
          onPress={() => onChange(clamp(value + step))}
        >
          <Ionicons name="add" size={16} color={colors.textPrimary} />
        </Pressable>
      </View>
    </View>
  );
}

export const AISettingsSheet = forwardRef<BottomSheetModal, AISettingsSheetProps>(
  function AISettingsSheet(
    {
      currentModelId,
      readyModelIds,
      options,
      onModelChange,
      onOptionsChange,
      onManageModels,
      onClearChat,
    },
    ref,
  ) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const snapPoints = useMemo(() => ["45%", "75%"], []);
    const [advancedOpen, setAdvancedOpen] = useState(false);

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={snapPoints}
        backgroundStyle={styles.sheetBg}
        handleIndicatorStyle={styles.indicator}
      >
        <BottomSheetScrollView contentContainerStyle={styles.content}>
          <Text style={styles.heading}>Model</Text>
          {Object.values(MODEL_REGISTRY).map((model) => {
            const isReady = readyModelIds.includes(model.id);
            const isActive = model.id === currentModelId;
            return (
              <Pressable
                key={model.id}
                style={[styles.modelRow, isActive && styles.modelRowActive]}
                onPress={() => isReady && onModelChange(model.id)}
                disabled={!isReady}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.modelRowLabel}>{model.label}</Text>
                  <Text style={styles.modelRowSub}>
                    {isReady ? "Installed" : "Not downloaded"}
                  </Text>
                </View>
                {isActive && <Ionicons name="checkmark-circle" size={20} color={colors.gold} />}
              </Pressable>
            );
          })}
          <Pressable style={styles.linkBtn} onPress={onManageModels}>
            <Text style={styles.linkBtnText}>Manage models</Text>
          </Pressable>

          <View style={styles.divider} />

          <Text style={styles.heading}>Response style</Text>
          <Stepper
            label="Temperature"
            value={options.temperature}
            onChange={(v) => onOptionsChange({ ...options, temperature: v })}
            min={0.2}
            max={1.0}
            step={0.1}
            format={(v) => v.toFixed(1)}
            colors={colors}
          />

          <Pressable
            style={styles.advancedToggle}
            onPress={() => setAdvancedOpen((v) => !v)}
          >
            <Text style={styles.advancedToggleText}>Advanced</Text>
            <Ionicons
              name={advancedOpen ? "chevron-up" : "chevron-down"}
              size={16}
              color={colors.textMuted}
            />
          </Pressable>

          {advancedOpen && (
            <>
              <Stepper
                label="Max tokens"
                value={options.maxTokens}
                onChange={(v) => onOptionsChange({ ...options, maxTokens: v })}
                min={128}
                max={1024}
                step={128}
                colors={colors}
              />
              <Stepper
                label="Context length"
                value={options.contextLength}
                onChange={(v) => onOptionsChange({ ...options, contextLength: v })}
                min={1024}
                max={4096}
                step={512}
                colors={colors}
              />
            </>
          )}

          <View style={styles.divider} />

          <Pressable style={styles.dangerBtn} onPress={onClearChat}>
            <Ionicons name="trash-outline" size={15} color={colors.error} />
            <Text style={styles.dangerBtnText}>Clear this chat</Text>
          </Pressable>
        </BottomSheetScrollView>
      </BottomSheetModal>
    );
  },
);

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    sheetBg: { backgroundColor: colors.bgSecondary },
    indicator: { backgroundColor: colors.gold + "66" },
    content: { padding: 20, paddingBottom: 40 },
    heading: {
      fontSize: 12,
      fontWeight: "800",
      color: colors.gold + "AA",
      letterSpacing: 1,
      marginBottom: 10,
    },
    modelRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.cardBg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 12,
      padding: 12,
      marginBottom: 8,
    },
    modelRowActive: { borderColor: colors.gold },
    modelRowLabel: { fontSize: 14, fontWeight: "600", color: colors.textPrimary },
    modelRowSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
    linkBtn: { alignSelf: "flex-start", marginTop: 4, marginBottom: 4 },
    linkBtnText: { fontSize: 12.5, color: colors.gold, fontWeight: "600" },
    divider: { height: 1, backgroundColor: colors.divider, marginVertical: 18 },
    stepperRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 10,
    },
    stepperLabel: { fontSize: 13, color: colors.textPrimary },
    stepperControls: { flexDirection: "row", alignItems: "center", gap: 10 },
    stepperBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.cardBg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      alignItems: "center",
      justifyContent: "center",
    },
    stepperValue: { fontSize: 13, color: colors.textPrimary, width: 44, textAlign: "center" },
    advancedToggle: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 8,
    },
    advancedToggleText: { fontSize: 12.5, fontWeight: "600", color: colors.textMuted },
    dangerBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      alignSelf: "flex-start",
    },
    dangerBtnText: { fontSize: 13, color: colors.error, fontWeight: "600" },
  });
}
