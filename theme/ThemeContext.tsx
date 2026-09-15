import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { THEMES, ThemeName, ThemeColors } from "./themes";
import { spacing } from "./spacing";
import { typography } from "./typography";

const STORAGE_KEY = "@sanatan_theme_name";

interface ThemeContextValue {
  themeName: ThemeName;
  colors: ThemeColors;
  spacing: typeof spacing;
  typography: typeof typography;
  setThemeName: (t: ThemeName) => void;
  toggleTheme: () => void;
  isReady: boolean;
}

const ThemeContext = createContext<ThemeContextValue>({
  themeName: "dark",
  colors: THEMES.dark,
  spacing,
  typography,
  setThemeName: () => {},
  toggleTheme: () => {},
  isReady: false,
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [themeName, setThemeNameState] = useState<ThemeName>("dark");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved === "dark" || saved === "light") {
          setThemeNameState(saved);
        }
      } catch {
        // ignore, default theme stays
      } finally {
        setIsReady(true);
      }
    })();
  }, []);

  const setThemeName = useCallback((t: ThemeName) => {
    setThemeNameState(t);
    AsyncStorage.setItem(STORAGE_KEY, t).catch(() => {});
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeNameState((prev) => {
      const next: ThemeName = prev === "dark" ? "light" : "dark";
      AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      themeName,
      colors: THEMES[themeName],
      spacing,
      typography,
      setThemeName,
      toggleTheme,
      isReady,
    }),
    [themeName, isReady, setThemeName, toggleTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
