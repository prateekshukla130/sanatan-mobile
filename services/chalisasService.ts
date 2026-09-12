/**
 * chalisasService.ts (Complete Redesign)
 *
 * Structure:
 * - Title (hindi, english, sanskrit)
 * - Starting Doha (hindi, english, sanskrit)
 * - Chaupai - paragraphs separated by ॥ (hindi, english, sanskrit)
 * - Ending Doha - optional (hindi, english, sanskrit)
 * - Jai Kara (hindi, english, sanskrit)
 */

import { db } from "../firebase";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import ChalisaData from "./Chalisas.json";
// ─────────────────────────────────────────────
// TYPE DEFINITIONS
// ─────────────────────────────────────────────

export interface TextContent {
  hindi: string;
  english: string;
  sanskrit: string;
}

export interface Chalisa {
  id: string;
  title: TextContent;
  startingDoha: TextContent;
  chaupai: TextContent; // Multi-line paragraph
  endingDoha?: TextContent; // Optional
  jaiKara: TextContent;
  createdAt?: any;
}

// ─────────────────────────────────────────────
// CHALISAS SERVICE
// ─────────────────────────────────────────────

class ChalisasService {
  private chalisaCache: Map<string, Chalisa> = new Map();

  /**
   * Fetch all chalisas (for list view)
   */
  async getAllChalisas(): Promise<
    Array<{ id: string; title: string; deity: string }>
  > {
    try {
      const isServerOpen = Boolean(process.env.EXPO_USE_SERVER);
      if (!isServerOpen) {
        return ChalisaData;
      }

      // ✅ CORRECT - Extracts and returns the data
      const snapshot = await getDocs(collection(db, "chalisas"));
      const chalisas = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        title: docSnap.data()?.title || {
          hindi: "",
          english: "",
          sanskrit: "",
        },
        startingDoha: docSnap.data().startingDoha || {
          hindi: "",
          english: "",
          sanskrit: "",
        },
        chaupai: docSnap.data().chaupai || {
          hindi: "",
          english: "",
          sanskrit: "",
        },
        endingDoha: docSnap.data().endingDoha,
        jaiKara: docSnap.data().jaiKara || {
          hindi: "",
          english: "",
          sanskrit: "",
        },
        createdAt: docSnap.data().createdAt,
      }));
      return chalisas;
    } catch (error) {
      console.error("Error fetching chalisas:", error);
      return [];
    }
  }

  clearCache() {
    this.chalisaCache.clear();
  }
}

export const chalisasService = new ChalisasService();
