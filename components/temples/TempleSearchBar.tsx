import React, { useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { spacing, typography, useTheme, ThemeColors } from "@/theme";
import { TempleSuggestion } from "@/hooks/useNearbyTemples";

// ─────────────────────────────────────────────
// SHARED THEME-AWARE STYLES
// ─────────────────────────────────────────────
function useSearchBarStyles() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return { colors, styles };
}

interface TempleSearchBarProps {
  value: string;
  suggestions: TempleSuggestion[];
  loading: boolean;
  onChangeText: (text: string) => void;
  onSuggestionPress: (item: TempleSuggestion) => void;
  onClearSuggestions: () => void;
}

export function TempleSearchBar({
  value,
  suggestions,
  loading,
  onChangeText,
  onSuggestionPress,
  onClearSuggestions,
}: TempleSearchBarProps) {
  const { colors, styles } = useSearchBarStyles();
  return (
    <View style={styles.wrapper}>
      <View style={styles.inputWrap}>
        <TextInput
          placeholder="Search temple by name"
          placeholderTextColor={colors.textMuted}
          value={value}
          onChangeText={onChangeText}
          onBlur={onClearSuggestions}
          style={styles.input}
          autoCorrect={false}
          autoCapitalize="words"
        />
        {loading ? (
          <ActivityIndicator size="small" color={colors.gold} />
        ) : null}
      </View>

      {suggestions.length > 0 ? (
        <FlatList
          data={suggestions}
          keyExtractor={(item) => item.placeId}
          style={styles.suggestionList}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <Pressable
              style={styles.suggestionItem}
              onPress={() => onSuggestionPress(item)}
            >
              <Text style={styles.suggestionTitle}>{item.title}</Text>
              {!!item.subtitle && (
                <Text style={styles.suggestionSubtitle}>{item.subtitle}</Text>
              )}
            </Pressable>
          )}
        />
      ) : null}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
  wrapper: {
    position: "absolute",
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    zIndex: 20,
  },
  inputWrap: {
    backgroundColor: colors.bgSecondary + "EE",
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: typography.fontSize.md,
  },
  suggestionList: {
    marginTop: spacing.xs,
    maxHeight: 220,
    borderRadius: 12,
    backgroundColor: colors.bgSecondary + "F4",
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  suggestionItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  suggestionTitle: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  suggestionSubtitle: {
    color: colors.textMuted,
    fontSize: typography.fontSize.xs,
    marginTop: 2,
  },
  });
}
