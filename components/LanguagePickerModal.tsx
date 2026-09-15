import React, { useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal, FlatList } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, ThemeColors } from "@/theme";
import { useLanguage, LANGUAGES, LanguageCode } from "@/localization";

interface Props {
  visible: boolean;
  onClose: () => void;
}

export const LanguagePickerModal: React.FC<Props> = ({ visible, onClose }) => {
  const { colors, spacing, typography } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const st = useMemo(() => makeStyles(colors, spacing, typography), [
    colors,
    spacing,
    typography,
  ]);

  const select = (code: LanguageCode) => {
    setLanguage(code);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={st.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={st.sheet}>
          <View style={st.header}>
            <Ionicons name="language-outline" size={20} color={colors.gold} />
            <Text style={st.title}>{t("appearance.chooseLanguage")}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={LANGUAGES}
            keyExtractor={(item) => item.code}
            renderItem={({ item }) => {
              const active = item.code === language;
              return (
                <TouchableOpacity
                  style={[st.row, active && st.rowActive]}
                  onPress={() => select(item.code)}
                  activeOpacity={0.75}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[st.native, active && st.activeTxt]}>{item.nativeName}</Text>
                    <Text style={[st.name, active && st.activeSubTxt]}>{item.name}</Text>
                  </View>
                  {active && <Ionicons name="checkmark-circle" size={20} color={colors.bgSecondary} />}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
};

function makeStyles(colors: ThemeColors, spacing: Record<string, number>, typography: any) {
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
      maxHeight: "70%",
      paddingBottom: spacing.lg,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    title: {
      flex: 1,
      fontSize: typography.fontSize.lg,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      marginHorizontal: spacing.md,
      marginTop: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.cardBg,
    },
    rowActive: {
      backgroundColor: colors.gold,
      borderColor: colors.gold,
    },
    native: {
      fontSize: typography.fontSize.lg,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    name: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
    },
    activeTxt: { color: colors.bgSecondary },
    activeSubTxt: { color: colors.bgSecondary + "CC" },
  });
}
