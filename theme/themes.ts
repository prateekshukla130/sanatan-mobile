// Theme Registry — maps theme names to color palettes
import { colors as darkColors } from "./colors";
import { lightColors } from "./lightColors";

export type ThemeName = "dark" | "light";

export const THEMES: Record<ThemeName, typeof darkColors> = {
  dark: darkColors,
  light: lightColors,
};

export const THEME_LABELS: Record<ThemeName, { en: string; hi: string }> = {
  dark: { en: "Dark Temple", hi: "डार्क मंदिर" },
  light: { en: "Light Day", hi: "लाइट डे" },
};

export type ThemeColors = typeof darkColors;
