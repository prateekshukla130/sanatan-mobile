import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";
import BhajanData from "./Bhajan.json";
export interface Bhajan {
  id: string;
  title: string;
  artist: string;
  deity: string;
  duration: string;
  audioUrl: string;
}

let _cache: Bhajan[] = [];
let _initialized = false;

async function fetchFromFirebase(): Promise<Bhajan[]> {
  const isServerOpen = Boolean(process.env.EXPO_USE_SERVER);
  if (!isServerOpen) {
    _cache = BhajanData;
    return BhajanData;
  }
  const snap = await getDocs(collection(db, "bhajans"));
  if (snap.empty) return [];

  return snap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      title: d.title ?? "Untitled",
      artist: d.artist ?? "Traditional",
      deity: d.deity ?? "Unknown",
      duration: d.duration ?? "",
      audioUrl: d.audioUrl ?? d.youtubeUrl ?? d.url ?? "",
    };
  });
}

export const bhajanService = {
  async init(): Promise<void> {
    if (_initialized) return;
    try {
      const firebase = await fetchFromFirebase();
      _cache = firebase;
    } catch (err) {
      console.warn(
        "[bhajanService] Firebase fetch failed, using static fallback:",
        err,
      );
    } finally {
      _initialized = true;
    }
  },

  async refresh(): Promise<Bhajan[]> {
    try {
      const firebase = await fetchFromFirebase();
      if (firebase.length > 0) _cache = firebase;
    } catch (err) {
      console.warn("[bhajanService] Refresh failed, keeping cache:", err);
    }
    return _cache;
  },

  getAllBhajans(): Bhajan[] {
    return _cache;
  },

  getBhajansByDeity(deity: string): Bhajan[] {
    return _cache.filter(
      (b) => b?.deity?.toLowerCase() === deity?.toLowerCase(),
    );
  },

  getBhajanById(id: string): Bhajan | undefined {
    return _cache?.find((b) => b?.id === id);
  },

  get isLoaded(): boolean {
    return _initialized;
  },
};
