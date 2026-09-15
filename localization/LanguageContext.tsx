import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LanguageCode, LANGUAGES, DEFAULT_LANGUAGE } from "./languages";
import en, { Translations } from "./translations/en";
import hi from "./translations/hi";
import bn from "./translations/bn";
import mr from "./translations/mr";
import te from "./translations/te";
import ta from "./translations/ta";
import gu from "./translations/gu";

const DICTIONARIES: Record<LanguageCode, Translations> = {
  en,
  hi,
  bn,
  mr,
  te,
  ta,
  gu,
};

const STORAGE_KEY = "@sanatan_language";

// Generates dot-path union types from the Translations shape, e.g. "nav.home"
type DotPaths<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${K}`
    : DotPaths<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

export type TranslationKey = DotPaths<Translations>;

function resolve(dict: unknown, path: string): string {
  const value = path
    .split(".")
    .reduce<unknown>(
      (acc, key) =>
        acc && typeof acc === "object" ? (acc as any)[key] : undefined,
      dict,
    );
  return typeof value === "string" ? value : path;
}

interface LanguageContextValue {
  language: LanguageCode;
  setLanguage: (l: LanguageCode) => void;
  t: (key: TranslationKey) => string;
  isReady: boolean;
}

const LanguageContext = createContext<LanguageContextValue>({
  language: DEFAULT_LANGUAGE,
  setLanguage: () => {},
  t: (key) => resolve(en, key),
  isReady: false,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [language, setLanguageState] = useState<LanguageCode>(
    DEFAULT_LANGUAGE,
  );
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved && LANGUAGES.some((l) => l.code === saved)) {
          setLanguageState(saved as LanguageCode);
        }
      } catch {
        // ignore, default language stays
      } finally {
        setIsReady(true);
      }
    })();
  }, []);

  const setLanguage = useCallback((l: LanguageCode) => {
    setLanguageState(l);
    AsyncStorage.setItem(STORAGE_KEY, l).catch(() => {});
  }, []);

  const t = useCallback(
    (key: TranslationKey) => resolve(DICTIONARIES[language], key),
    [language],
  );

  const value = useMemo<LanguageContextValue>(
    () => ({ language, setLanguage, t, isReady }),
    [language, setLanguage, t, isReady],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
