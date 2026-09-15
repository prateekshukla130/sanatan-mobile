export type LanguageCode = "en" | "hi" | "bn" | "mr" | "te" | "ta" | "gu";

export interface LanguageMeta {
  code: LanguageCode;
  name: string; // English name
  nativeName: string; // shown in the language's own script — never translated
}

export const LANGUAGES: LanguageMeta[] = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी" },
  { code: "bn", name: "Bengali", nativeName: "বাংলা" },
  { code: "mr", name: "Marathi", nativeName: "मराठी" },
  { code: "te", name: "Telugu", nativeName: "తెలుగు" },
  { code: "ta", name: "Tamil", nativeName: "தமிழ்" },
  { code: "gu", name: "Gujarati", nativeName: "ગુજરાતી" },
];

export const DEFAULT_LANGUAGE: LanguageCode = "en";
