import React, { useMemo } from "react";
import { View, Text, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { useTheme, theme } from "../theme";

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  title?: string;
  subtitle?: string;
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  title,
  subtitle,
}) => {
  const { colors, spacing, typography } = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          marginHorizontal: spacing.md,
          marginVertical: spacing.sm,
        },
        card: {
          backgroundColor: colors.cardBg,
          borderRadius: theme.borderRadius.lg,
          borderWidth: 1,
          borderColor: colors.cardBorder,
          padding: spacing.md,
          ...theme.shadows.md,
        },
        header: {
          marginBottom: spacing.md,
        },
        title: {
          fontSize: typography.fontSize.xl,
          fontWeight: typography.fontWeight.bold,
          color: colors.textPrimary,
          marginBottom: spacing.xs,
        },
        subtitle: {
          fontSize: typography.fontSize.md,
          color: colors.textMuted,
        },
      }),
    [colors, spacing, typography],
  );

  return (
    <View style={[styles.container, style]}>
      <View style={styles.card}>
        {title && (
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          </View>
        )}
        {children}
      </View>
    </View>
  );
};
