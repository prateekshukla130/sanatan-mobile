import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, ThemeColors } from "@/theme";
import { MODEL_REGISTRY } from "@/services/modelService";
import { ModelDownloadState, ModelId } from "@/types/ai";

interface AIModelSetupProps {
  downloadStates: Record<ModelId, ModelDownloadState>;
  onDownload: (modelId: ModelId) => void;
  onCancelDownload: (modelId: ModelId) => void;
  onDelete: (modelId: ModelId) => void;
  onUseModel: (modelId: ModelId) => void;
}

export function AIModelSetup({
  downloadStates,
  onDownload,
  onCancelDownload,
  onDelete,
  onUseModel,
}: AIModelSetupProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <ScrollView contentContainerStyle={styles.wrap} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Ionicons name="cloud-download-outline" size={28} color={colors.gold} />
        <Text style={styles.title}>AI मॉडल इंस्टॉल नहीं है</Text>
        <Text style={styles.subtitle}>AI model not installed</Text>
        <Text style={styles.body}>
          चैट शुरू करने के लिए एक मॉडल डाउनलोड करें। यह एक बार डाउनलोड होने के बाद पूरी
          तरह ऑफलाइन काम करता है।{"\n"}Download a model to start chatting — it works
          fully offline once installed.
        </Text>
      </View>

      {Object.values(MODEL_REGISTRY).map((model) => {
        const state = downloadStates[model.id] ?? { status: "not_downloaded", progress: 0 };
        return (
          <View key={model.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <View style={styles.titleRow}>
                  <Text style={styles.modelLabel}>{model.label}</Text>
                  {model.recommended && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>Recommended</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.modelHindi}>{model.hindiLabel}</Text>
              </View>
            </View>

            <Text style={styles.desc}>{model.description}</Text>
            <Text style={styles.meta}>
              ~{(model.sizeMB / 1024).toFixed(1)} GB · needs ~{model.minRAMGB} GB RAM
            </Text>

            {state.status === "downloading" && (
              <View style={styles.progressWrap}>
                <View style={styles.progressTrack}>
                  <View
                    style={[styles.progressFill, { width: `${Math.round(state.progress * 100)}%` }]}
                  />
                </View>
                <Text style={styles.progressText}>{Math.round(state.progress * 100)}%</Text>
              </View>
            )}

            {state.status === "error" && (
              <Text style={styles.errorText}>{state.error ?? "Download failed."}</Text>
            )}

            <View style={styles.actions}>
              {state.status === "not_downloaded" && (
                <Pressable style={styles.primaryBtn} onPress={() => onDownload(model.id)}>
                  <Ionicons name="download-outline" size={15} color={colors.bgPrimary} />
                  <Text style={styles.primaryBtnText}>Download</Text>
                </Pressable>
              )}
              {state.status === "downloading" && (
                <Pressable style={styles.secondaryBtn} onPress={() => onCancelDownload(model.id)}>
                  <Text style={styles.secondaryBtnText}>Cancel</Text>
                </Pressable>
              )}
              {state.status === "error" && (
                <Pressable style={styles.primaryBtn} onPress={() => onDownload(model.id)}>
                  <Text style={styles.primaryBtnText}>Retry</Text>
                </Pressable>
              )}
              {state.status === "ready" && (
                <>
                  <Pressable style={styles.primaryBtn} onPress={() => onUseModel(model.id)}>
                    <Ionicons name="chatbubbles-outline" size={15} color={colors.bgPrimary} />
                    <Text style={styles.primaryBtnText}>Use this model</Text>
                  </Pressable>
                  <Pressable style={styles.secondaryBtn} onPress={() => onDelete(model.id)}>
                    <Text style={styles.secondaryBtnText}>Delete</Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrap: { padding: 16, paddingBottom: 40 },
    header: { alignItems: "center", marginBottom: 20, gap: 4 },
    title: { fontSize: 16, fontWeight: "700", color: colors.textPrimary, marginTop: 8 },
    subtitle: { fontSize: 12, color: colors.textMuted },
    body: {
      fontSize: 12,
      color: colors.textMuted,
      textAlign: "center",
      marginTop: 10,
      lineHeight: 18,
    },
    card: {
      backgroundColor: colors.cardBg,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: 14,
      marginBottom: 12,
    },
    cardHeader: { flexDirection: "row", alignItems: "flex-start" },
    titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    modelLabel: { fontSize: 15, fontWeight: "700", color: colors.textPrimary },
    modelHindi: { fontSize: 12, color: colors.gold, marginTop: 1 },
    badge: {
      backgroundColor: colors.gold,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    badgeText: { fontSize: 9, fontWeight: "700", color: colors.bgPrimary },
    desc: { fontSize: 12.5, color: colors.textMuted, marginTop: 8 },
    meta: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
    progressWrap: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
    progressTrack: {
      flex: 1,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.divider,
      overflow: "hidden",
    },
    progressFill: { height: 6, borderRadius: 3, backgroundColor: colors.gold },
    progressText: { fontSize: 11, color: colors.textMuted, width: 36 },
    errorText: { fontSize: 11.5, color: colors.error, marginTop: 8 },
    actions: { flexDirection: "row", gap: 8, marginTop: 12 },
    primaryBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.gold,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    primaryBtnText: { fontSize: 12.5, fontWeight: "700", color: colors.bgPrimary },
    secondaryBtn: {
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    secondaryBtnText: { fontSize: 12.5, fontWeight: "600", color: colors.textMuted },
  });
}
