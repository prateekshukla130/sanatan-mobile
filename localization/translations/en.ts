// English — canonical translation source. Every other language file must
// satisfy this exact shape (enforced via the Translations type).

const en = {
  nav: {
    home: "Home",
    temples: "Nearby Temples",
    kundli: "Kundli",
    shop: "Shop",
    ai: "Divya Vaani",
    scriptures: "Scriptures",
    calendar: "Calendar",
    bhajan: "Bhajan",
    jap: "Jap Counter",
    chalisa: "Chalisa",
    settings: "Settings",
    menu: "Menu",
    quickAccess: "Quick Access",
  },
  header: {
    tagline: "Panchang · Spiritual Companion",
  },
  common: {
    ok: "OK",
    cancel: "Cancel",
    close: "Close",
    save: "Save",
    loading: "Loading…",
    done: "Done",
    today: "Today",
  },
  appearance: {
    sectionTitle: "Appearance",
    themeLabel: "Theme",
    dark: "Dark Temple",
    darkSub: "Deep maroon & gold",
    light: "Light Day",
    lightSub: "Warm ivory & saffron",
    languageSectionTitle: "Language",
    languageLabel: "App Language",
    chooseLanguage: "Choose Language",
  },
  journey: {
    title: "My Journey",
    streakUnit: "Day Streak",
    thisMonth: "This Month",
    jaap: "Jaap",
    meditation: "Meditation",
    meditationUnit: "min",
    reading: "Reading",
    readingUnit: "days",
    temples: "Temples",
    todaysGoal: "Today's Goal",
    morningPrayer: "Morning Prayer",
    jap108: "108 Jaap",
    eveningMeditation: "Evening Meditation",
    openJourney: "My Journey",
    logMeditation: "Log Meditation",
    logMeditationPrompt: "How many minutes did you meditate?",
    logTemple: "Log Temple Visit",
    logTempleDone: "Temple visit logged 🛕",
    logReading: "Mark Reading Done",
    add: "Add",
    completed: "Completed",
    tapToComplete: "Tap to mark complete",
  },
} as const;

export default en;

// Same key structure as `en`, but every leaf is widened to `string` so other
// language files aren't forced to match English's literal string values.
type DeepStringify<T> = {
  [K in keyof T]: T[K] extends string ? string : DeepStringify<T[K]>;
};
export type Translations = DeepStringify<typeof en>;
