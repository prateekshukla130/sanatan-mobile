// Theme System Entry Point
import { colors } from './colors';
import { spacing } from './spacing';
import { typography } from './typography';

export { THEMES, THEME_LABELS } from './themes';
export type { ThemeName, ThemeColors } from './themes';
export { ThemeProvider, useTheme } from './ThemeContext';

export const theme = {
  colors,
  spacing,
  typography,
  
  // Border Radius
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 16,
    xl: 24,
    round: 999,
  },
  
  // Shadows
  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 2,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.30,
      shadowRadius: 4.65,
      elevation: 4,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.37,
      shadowRadius: 7.49,
      elevation: 8,
    },
    goldGlow: {
      shadowColor: '#D4AF37',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.5,
      shadowRadius: 10,
      elevation: 5,
    },
  },
};

export { colors, spacing, typography };
export type Theme = typeof theme;
