// // Mantra Service - Daily Mantras and Jap Mantras

// export interface Mantra {
//   id: string;
//   text: string;
//   meaning: string;
//   deity: string;
// }

// export const DAILY_MANTRAS: Mantra[] = [
//   {
//     id: '1',
//     text: 'ॐ गं गणपतये नमः',
//     meaning: 'Salutations to Lord Ganesha',
//     deity: 'Ganesha',
//   },
//   {
//     id: '2',
//     text: 'ॐ नमः शिवाय',
//     meaning: 'Salutations to Lord Shiva',
//     deity: 'Shiva',
//   },
//   {
//     id: '3',
//     text: 'ॐ नमो भगवते वासुदेवाय',
//     meaning: 'Salutations to Lord Vasudeva (Krishna)',
//     deity: 'Krishna',
//   },
//   {
//     id: '4',
//     text: 'ॐ ऐं ह्रीं क्लीं चामुण्डायै विच्चे',
//     meaning: 'Salutations to Goddess Chamunda',
//     deity: 'Durga',
//   },
//   {
//     id: '5',
//     text: 'ॐ श्री रामाय नमः',
//     meaning: 'Salutations to Lord Rama',
//     deity: 'Rama',
//   },
//   {
//     id: '6',
//     text: 'ॐ श्री हनुमते नमः',
//     meaning: 'Salutations to Lord Hanuman',
//     deity: 'Hanuman',
//   },
//   {
//     id: '7',
//     text: 'गायत्री मन्त्र: ॐ भूर्भुवः स्वः',
//     meaning: 'The Gayatri Mantra - Universal Prayer',
//     deity: 'Savitri',
//   },
// ];

// export const JAP_MANTRAS: Mantra[] = [
//   ...DAILY_MANTRAS,
//   {
//     id: '8',
//     text: 'हरे कृष्ण हरे कृष्ण कृष्ण कृष्ण हरे हरे',
//     meaning: 'Hare Krishna Maha Mantra',
//     deity: 'Krishna',
//   },
//   {
//     id: '9',
//     text: 'ॐ तत्पुरुषाय विद्महे',
//     meaning: 'Shiva Gayatri Mantra',
//     deity: 'Shiva',
//   },
// ];

// export const mantraService = {
//   getDailyMantra(): Mantra {
//     const today = new Date().getDate();
//     const index = today % DAILY_MANTRAS.length;
//     return DAILY_MANTRAS[index];
//   },

//   getAllJapMantras(): Mantra[] {
//     return JAP_MANTRAS;
//   },
// };
// Mantra Service - Daily Mantras and Jap Mantras
//
// Priority:
//  1. Fetches from Firebase Firestore ("mantras" collection)
//  2. Falls back to static arrays if Firebase fails or returns empty
//
// Usage:
//  await mantraService.init();          // call once at app start
//  mantraService.getDailyMantra();      // sync after init
//  await mantraService.getAllJapMantras(); // always fresh

import { db } from "../firebase"; // adjust path as needed
import { collection, getDocs, orderBy, query } from "firebase/firestore";

// ─────────────────────────────────────────────
// TYPE
// ─────────────────────────────────────────────
export interface Mantra {
  id: string;
  text: string;
  meaning: string;
  deity: string;
  title?: string; // Firebase docs may have a "title" field
}

// ─────────────────────────────────────────────
// STATIC FALLBACK DATA
// Used when Firebase is unreachable or returns nothing
// ─────────────────────────────────────────────
export const DAILY_MANTRAS_STATIC: Mantra[] = [
  {
    id: "1",
    text: "ॐ गं गणपतये नमः",
    meaning: "Salutations to Lord Ganesha",
    deity: "Ganesha",
  },
  {
    id: "2",
    text: "ॐ नमः शिवाय",
    meaning: "Salutations to Lord Shiva",
    deity: "Shiva",
  },
  {
    id: "3",
    text: "ॐ नमो भगवते वासुदेवाय",
    meaning: "Salutations to Lord Vasudeva (Krishna)",
    deity: "Krishna",
  },
  {
    id: "4",
    text: "ॐ ऐं ह्रीं क्लीं चामुण्डायै विच्चे",
    meaning: "Salutations to Goddess Chamunda",
    deity: "Durga",
  },
  {
    id: "5",
    text: "ॐ श्री रामाय नमः",
    meaning: "Salutations to Lord Rama",
    deity: "Rama",
  },
  {
    id: "6",
    text: "ॐ श्री हनुमते नमः",
    meaning: "Salutations to Lord Hanuman",
    deity: "Hanuman",
  },
  {
    id: "7",
    text: "गायत्री मन्त्र: ॐ भूर्भुवः स्वः",
    meaning: "The Gayatri Mantra - Universal Prayer",
    deity: "Savitri",
  },
];

export const JAP_MANTRAS_STATIC: Mantra[] = [
  ...DAILY_MANTRAS_STATIC,
  {
    id: "8",
    text: "हरे कृष्ण हरे कृष्ण कृष्ण कृष्ण हरे हरे",
    meaning: "Hare Krishna Maha Mantra",
    deity: "Krishna",
  },
  {
    id: "9",
    text: "ॐ तत्पुरुषाय विद्महे",
    meaning: "Shiva Gayatri Mantra",
    deity: "Shiva",
  },
];

// ─────────────────────────────────────────────
// IN-MEMORY CACHE
// Populated by init() so getDailyMantra() is sync
// ─────────────────────────────────────────────
let _cache: Mantra[] = [];
let _initialized = false;

// ─────────────────────────────────────────────
// FIREBASE FETCH
// Maps Firestore doc fields → Mantra interface
// Handles both "text" and "sanskrit" field names
// from your admin dashboard
// ─────────────────────────────────────────────
async function fetchFromFirebase(): Promise<Mantra[]> {
  const snap = await getDocs(
    query(collection(db, "mantras"), orderBy("createdAt", "desc")),
  );

  if (snap.empty) return [];

  return snap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      text: d.sanskrit ?? d.text ?? "", // admin uses "sanskrit" field
      meaning: d.meaning ?? "",
      deity: d.deity ?? "",
      title: d.title ?? undefined,
    };
  });
}

// ─────────────────────────────────────────────
// SERVICE
// ─────────────────────────────────────────────
export const mantraService = {
  /**
   * Call once at app start (e.g. in App.tsx useEffect).
   * Loads Firebase mantras into cache; falls back to static if failed.
   */
  async init(): Promise<void> {
    if (_initialized) return;
    try {
      const isServerOpen = Boolean(process.env.EXPO_USE_SERVER);
      if (!isServerOpen) {
        return DAILY_MANTRAS_STATIC;
      }
      const firebase = await fetchFromFirebase();
      _cache =
        firebase.length > 0
          ? [...firebase, ...DAILY_MANTRAS_STATIC]
          : DAILY_MANTRAS_STATIC;
    } catch (err) {
      console.warn(
        "[mantraService] Firebase fetch failed, using static fallback:",
        err,
      );
      _cache = DAILY_MANTRAS_STATIC;
    } finally {
      _initialized = true;
    }
  },

  /**
   * Synchronous — returns today's mantra from cache.
   * Call init() first, or it uses the static fallback automatically.
   */
  getDailyMantra(): Mantra | undefined {
    const pool =
      _cache.length > 0
        ? [..._cache, ...DAILY_MANTRAS_STATIC]
        : DAILY_MANTRAS_STATIC;

    const dayId = new Date().getUTCDay();

    return pool.find((m) => Number(m.id) === dayId + 1);
  },

  /**
   * Returns all mantras for Jap screen.
   * Always returns cached/fallback instantly — no await needed after init().
   */
  getAllJapMantras(): Mantra[] {
    return _cache.length > 0
      ? [..._cache, ...JAP_MANTRAS_STATIC]
      : JAP_MANTRAS_STATIC;
  },

  /**
   * Force a fresh fetch from Firebase (e.g. pull-to-refresh).
   * Updates cache in place.
   */
  async refresh(): Promise<Mantra[]> {
    try {
      const firebase = await fetchFromFirebase();
      _cache = [...firebase, ...DAILY_MANTRAS_STATIC];
    } catch (err) {
      console.warn(
        "[mantraService] Refresh failed, keeping existing cache:",
        err,
      );
    }

    return _cache.length > 0 ? _cache : JAP_MANTRAS_STATIC;
  },

  /** True if Firebase data is loaded (vs. fallback) */
  get isLoaded(): boolean {
    return _initialized;
  },
};
