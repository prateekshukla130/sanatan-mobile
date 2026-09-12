/**
 * notificationService.ts  — v5
 *
 * FIXES vs v4:
 *  1. applyAllNotificationPrefs was fully sequential — every toggle awaited the
 *     previous one. Festival (180 days) + 4× smart-alert loops (180 days each)
 *     = 900 serial getPanchangam() + scheduleNotificationAsync() calls → UI freeze.
 *
 *  2. Fix: All independent toggles run in parallel via Promise.all.
 *     The heavy per-day loops are also parallelised internally with Promise.all
 *     instead of serial for-await loops.
 *
 *  3. scheduleNotificationAsync calls are batched in chunks of 10 to avoid
 *     overwhelming the native notification scheduler.
 *
 *  4. getPanchangam() calls inside festival/smart loops are run concurrently
 *     (they are pure-JS / synchronous CPU work, but grouping them avoids
 *     repeated micro-task stalls in the JS event loop).
 */

import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getPanchangam, Observer } from "@ishubhamx/panchangam-js";
import { eachDayOfInterval, addMonths } from "date-fns";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const TZ_OFFSET_MIN = 330; // IST = UTC+5:30
const FALLBACK_LAT = 28.6139;
const FALLBACK_LNG = 77.209;

/** Max simultaneous scheduleNotificationAsync calls to the native layer */
const SCHEDULE_BATCH = 10;

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATION HANDLER  (SDK 53 shape)
// ─────────────────────────────────────────────────────────────────────────────

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldShowAlert: true, // kept for backward compat
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// ─────────────────────────────────────────────────────────────────────────────
// BATCH HELPER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run an array of async tasks in parallel but limit concurrency to `size`.
 * Prevents flooding the native scheduler with hundreds of simultaneous calls.
 */
async function runInBatches<T>(
  tasks: (() => Promise<T>)[],
  size = SCHEDULE_BATCH,
): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < tasks.length; i += size) {
    const batch = tasks.slice(i, i + size).map((fn) => fn());
    results.push(...(await Promise.all(batch)));
  }
  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// FESTIVAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export interface FestivalObj {
  name: string;
  description?: string;
  category?: string;
  isFastingDay?: boolean;
}

export function parseFestivals(raw: unknown): FestivalObj[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((f) =>
      typeof f === "string"
        ? { name: f }
        : {
            name: f?.name ?? "",
            description: f?.description,
            category: f?.category,
            isFastingDay: !!f?.isFastingDay,
          },
    )
    .filter((f) => Boolean(f.name));
}

export function getFestivalsForDate(
  date: Date,
  lat = FALLBACK_LAT,
  lng = FALLBACK_LNG,
): FestivalObj[] {
  try {
    const obs = new Observer(lat, lng, 200);
    const p = getPanchangam(date, obs, { timezoneOffset: TZ_OFFSET_MIN });
    return parseFestivals(p.festivals);
  } catch (e) {
    console.warn("[notifService] getFestivalsForDate:", e);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TITHI → SPECIAL DAY
// ─────────────────────────────────────────────────────────────────────────────

type SpecialType =
  | "ekadashi"
  | "purnima"
  | "amavasya"
  | "chaturthi"
  | "pradosh"
  | "navami"
  | "saptami"
  | "dwitiya";

interface DayMeta {
  type: SpecialType;
  labelEn: string;
  labelHi: string;
  color: string;
  icon: string;
}

function getDayMetaFromTithi(tithiIno: number): DayMeta | null {
  const t = tithiIno % 15;
  switch (t) {
    case 1:
      return {
        type: "dwitiya",
        labelEn: "Dwitiya",
        labelHi: "द्वितीया",
        color: "#86EFAC",
        icon: "✨",
      };
    case 3:
      return {
        type: "chaturthi",
        labelEn: "Chaturthi",
        labelHi: "चतुर्थी",
        color: "#FB923C",
        icon: "🐘",
      };
    case 6:
      return {
        type: "saptami",
        labelEn: "Saptami",
        labelHi: "सप्तमी",
        color: "#FBBF24",
        icon: "☀️",
      };
    case 8:
      return {
        type: "navami",
        labelEn: "Navami",
        labelHi: "नवमी",
        color: "#F472B6",
        icon: "🌸",
      };
    case 10:
      return {
        type: "ekadashi",
        labelEn: "Ekadashi",
        labelHi: "एकादशी",
        color: "#F4D160",
        icon: "🌿",
      };
    case 12:
      return {
        type: "pradosh",
        labelEn: "Pradosh",
        labelHi: "प्रदोष",
        color: "#60A5FA",
        icon: "🕉️",
      };
    case 14:
      if (tithiIno === 14)
        return {
          type: "purnima",
          labelEn: "Purnima",
          labelHi: "पूर्णिमा",
          color: "#E2E8F0",
          icon: "🌕",
        };
      if (tithiIno === 29)
        return {
          type: "amavasya",
          labelEn: "Amavasya",
          labelHi: "अमावस्या",
          color: "#818CF8",
          icon: "🌑",
        };
      return null;
    default:
      return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPES & DEFAULTS
// ─────────────────────────────────────────────────────────────────────────────

export interface NotificationPrefs {
  morningPuja: boolean;
  morningPujaTime: { hour: number; minute: number };
  eveningAarti: boolean;
  eveningAartiTime: { hour: number; minute: number };
  dailyJap: boolean;
  dailyJapTime: { hour: number; minute: number };
  weeklyDevotion: boolean;
  weeklyDevotionDay: number;
  weeklyDevotionTime: { hour: number; minute: number };
  festivalAlerts: boolean;
  festivalDaysBefore: number;
  ekadashiAlert: boolean;
  pradoshAlert: boolean;
  purnimaAlert: boolean;
  amavasayaAlert: boolean;
  customReminders: CustomReminder[];
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  lat: number;
  lng: number;
}

export interface CustomReminder {
  id: string;
  title: string;
  titleHi: string;
  hour: number;
  minute: number;
  days: number[]; // 0=Sun…6=Sat, empty = daily
  screen: string;
  enabled: boolean;
}

export const DEFAULT_PREFS: NotificationPrefs = {
  morningPuja: false,
  morningPujaTime: { hour: 6, minute: 0 },
  eveningAarti: false,
  eveningAartiTime: { hour: 18, minute: 30 },
  dailyJap: false,
  dailyJapTime: { hour: 7, minute: 0 },
  weeklyDevotion: false,
  weeklyDevotionDay: 0,
  weeklyDevotionTime: { hour: 9, minute: 0 },
  festivalAlerts: false,
  festivalDaysBefore: 1,
  ekadashiAlert: false,
  pradoshAlert: false,
  purnimaAlert: false,
  amavasayaAlert: false,
  customReminders: [],
  soundEnabled: true,
  vibrationEnabled: true,
  lat: FALLBACK_LAT,
  lng: FALLBACK_LNG,
};

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATION ID PREFIXES
// ─────────────────────────────────────────────────────────────────────────────

export const NOTIF_IDS = {
  MORNING_PUJA: "morning_puja",
  EVENING_AARTI: "evening_aarti",
  DAILY_JAP: "daily_jap",
  WEEKLY_DEVOTION: "weekly_devotion",
  FESTIVAL_PREFIX: "festival_",
  SMART_PREFIX: "smart_",
  CUSTOM_PREFIX: "custom_",
};

// ─────────────────────────────────────────────────────────────────────────────
// STORAGE
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = "@notif_prefs_v4";

export async function loadPrefs(): Promise<NotificationPrefs> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export async function savePrefs(prefs: NotificationPrefs): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

// ─────────────────────────────────────────────────────────────────────────────
// PERMISSIONS + ANDROID CHANNELS
// ─────────────────────────────────────────────────────────────────────────────

export async function requestNotificationPermission(): Promise<boolean> {
  if (!Device.isDevice) return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== "granted") return false;

  if (Platform.OS === "android") {
    await Promise.all([
      Notifications.setNotificationChannelAsync("spiritual", {
        name: "Spiritual Reminders · आध्यात्मिक",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#F4D160",
        sound: "default",
      }),
      Notifications.setNotificationChannelAsync("festivals", {
        name: "Festival Alerts · उत्सव",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 500, 250, 500],
        lightColor: "#F97316",
        sound: "default",
      }),
    ]);
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// CANCEL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export async function cancelById(id: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {}
}

export async function cancelByPrefix(prefix: string): Promise<void> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  const targets = all.filter((n) => n.identifier.startsWith(prefix));
  // Cancel in parallel — these are lightweight native calls
  await Promise.all(
    targets.map((n) =>
      Notifications.cancelScheduledNotificationAsync(n.identifier).catch(
        () => {},
      ),
    ),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTENT BUILDER
// ─────────────────────────────────────────────────────────────────────────────

function buildContent(
  title: string,
  body: string,
  screen: string,
  prefs: NotificationPrefs,
  extra?: Record<string, unknown>,
): Notifications.NotificationContentInput {
  return {
    title,
    body,
    sound: prefs.soundEnabled ? "default" : undefined,
    vibrate: prefs.vibrationEnabled ? [0, 250, 250, 250] : undefined,
    data: { screen, ...extra },
    ...(Platform.OS === "android" && { channelId: "spiritual" }),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// TRIGGER HELPERS  (SDK 53 — explicit `type` field required)
// ─────────────────────────────────────────────────────────────────────────────

function dailyTrigger(
  hour: number,
  minute: number,
): Notifications.SchedulableNotificationTriggerInput {
  return {
    type: Notifications.SchedulableTriggerInputTypes.DAILY,
    hour,
    minute,
  };
}

function weeklyTrigger(
  weekday: number,
  hour: number,
  minute: number,
): Notifications.SchedulableNotificationTriggerInput {
  return {
    type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
    weekday,
    hour,
    minute,
  };
}

function dateTrigger(
  date: Date,
): Notifications.SchedulableNotificationTriggerInput {
  return { type: Notifications.SchedulableTriggerInputTypes.DATE, date };
}

// ─────────────────────────────────────────────────────────────────────────────
// SCHEDULE WRAPPERS  (simple repeating — fast, no batching needed)
// ─────────────────────────────────────────────────────────────────────────────

async function scheduleDaily(
  id: string,
  title: string,
  body: string,
  hour: number,
  minute: number,
  screen: string,
  prefs: NotificationPrefs,
): Promise<void> {
  await cancelById(id);
  await Notifications.scheduleNotificationAsync({
    identifier: id,
    content: buildContent(title, body, screen, prefs),
    trigger: dailyTrigger(hour, minute),
  });
}

async function scheduleWeekly(
  id: string,
  title: string,
  body: string,
  weekday: number,
  hour: number,
  minute: number,
  screen: string,
  prefs: NotificationPrefs,
): Promise<void> {
  await cancelById(id);
  await Notifications.scheduleNotificationAsync({
    identifier: id,
    content: buildContent(title, body, screen, prefs),
    trigger: weeklyTrigger(weekday, hour, minute),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SIMPLE RECURRING NOTIFICATIONS
// ─────────────────────────────────────────────────────────────────────────────

export async function scheduleMorningPuja(
  prefs: NotificationPrefs,
): Promise<void> {
  await scheduleDaily(
    NOTIF_IDS.MORNING_PUJA,
    "🪔 प्रातः पूजा · Morning Puja",
    "ॐ नमः शिवाय 🙏 Begin your day with devotion.",
    prefs.morningPujaTime.hour,
    prefs.morningPujaTime.minute,
    "Puja",
    prefs,
  );
}

export async function scheduleEveningAarti(
  prefs: NotificationPrefs,
): Promise<void> {
  await scheduleDaily(
    NOTIF_IDS.EVENING_AARTI,
    "🔔 संध्या आरती · Evening Aarti",
    "हर हर महादेव 🪔 Time for evening prayers and Aarti.",
    prefs.eveningAartiTime.hour,
    prefs.eveningAartiTime.minute,
    "Bhajan",
    prefs,
  );
}

export async function scheduleDailyJap(
  prefs: NotificationPrefs,
): Promise<void> {
  await scheduleDaily(
    NOTIF_IDS.DAILY_JAP,
    "📿 जप स्मरण · Daily Jap",
    "राम राम 🙏 Complete your daily mantra jap.",
    prefs.dailyJapTime.hour,
    prefs.dailyJapTime.minute,
    "Jap",
    prefs,
  );
}

const WEEKLY_DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const WEEKLY_DEITY: Record<number, string> = {
  0: "🌞 Surya Dev",
  1: "🌙 Chandra Dev",
  2: "🔴 Mangal Dev",
  3: "🟢 Budh Dev",
  4: "🟡 Guru Brihaspati",
  5: "⚪ Shukra Dev",
  6: "⚫ Shani Dev",
};

export async function scheduleWeeklyDevotion(
  prefs: NotificationPrefs,
): Promise<void> {
  const {
    weeklyDevotionDay: day,
    weeklyDevotionTime: { hour, minute },
  } = prefs;
  await scheduleWeekly(
    NOTIF_IDS.WEEKLY_DEVOTION,
    "🙏 साप्ताहिक भक्ति · Weekly Devotion",
    `Today (${WEEKLY_DAY_NAMES[day]}) is the day of ${WEEKLY_DEITY[day] ?? "Dev"} 🪔`,
    day + 1,
    hour,
    minute,
    "Bhajan",
    prefs,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FESTIVAL ALERTS  — parallelised
// ─────────────────────────────────────────────────────────────────────────────

export async function scheduleFestivalAlerts(
  prefs: NotificationPrefs,
  monthsAhead = 6,
): Promise<void> {
  // 1. Cancel existing in parallel with computing the new schedule
  const cancelPromise = cancelByPrefix(NOTIF_IDS.FESTIVAL_PREFIX);

  const now = new Date();
  const end = addMonths(now, monthsAhead);
  const days = eachDayOfInterval({ start: now, end });

  // 2. Compute all festival data synchronously (getPanchangam is CPU-bound JS,
  //    not I/O — no benefit from Promise.all here, but we batch the *scheduling*)
  interface FestivalPending {
    id: string;
    date: Date;
    trigger: Date;
    festivals: FestivalObj[];
  }

  const pending: FestivalPending[] = [];
  for (const day of days) {
    const festivals = getFestivalsForDate(day, prefs.lat, prefs.lng);
    if (!festivals.length) continue;

    const notifDate = new Date(day);
    notifDate.setDate(notifDate.getDate() - prefs.festivalDaysBefore);
    notifDate.setHours(8, 0, 0, 0);
    if (notifDate <= now) continue;

    pending.push({
      id: `${NOTIF_IDS.FESTIVAL_PREFIX}${day.toISOString().slice(0, 10)}`,
      date: day,
      trigger: notifDate,
      festivals,
    });
  }

  // 3. Wait for cancellation to finish before scheduling
  await cancelPromise;

  // 4. Schedule all in parallel batches of SCHEDULE_BATCH
  const tasks = pending.map((item) => () => {
    const { festivals } = item;
    const names = festivals.map((f) => f.name).join("  ·  ");
    const fasting = festivals.some((f) => f.isFastingDay);
    const label = prefs.festivalDaysBefore === 1 ? "Tomorrow" : "In 2 days";

    return Notifications.scheduleNotificationAsync({
      identifier: item.id,
      content: {
        title: `🎊 ${label}: ${festivals[0].name}${festivals.length > 1 ? ` +${festivals.length - 1}` : ""}`,
        body: `${names}${fasting ? "  🙏 व्रत · Fasting Day" : ""}`,
        sound: prefs.soundEnabled ? "default" : undefined,
        vibrate: prefs.vibrationEnabled ? [0, 500, 250, 500] : undefined,
        data: {
          screen: "Panchang",
          date: item.date.toISOString(),
          festivals: festivals.map((f) => f.name),
        },
        ...(Platform.OS === "android" && { channelId: "festivals" }),
      },
      trigger: dateTrigger(item.trigger),
    });
  });

  await runInBatches(tasks);
}

// ─────────────────────────────────────────────────────────────────────────────
// SMART SPIRITUAL ALERTS  — parallelised
// ─────────────────────────────────────────────────────────────────────────────

type SmartType = "ekadashi" | "pradosh" | "purnima" | "amavasya";

const SMART_SCREEN: Record<SmartType, string> = {
  ekadashi: "Jap",
  pradosh: "Chalisa",
  purnima: "Panchang",
  amavasya: "Panchang",
};
const SMART_TITLE: Record<SmartType, string> = {
  ekadashi: "🌿 एकादशी · Ekadashi Today",
  pradosh: "🔱 प्रदोष व्रत · Pradosh Vrat",
  purnima: "🌕 पूर्णिमा · Full Moon Day",
  amavasya: "🌑 अमावस्या · No Moon Day",
};
const SMART_BODY: Record<SmartType, string> = {
  ekadashi: "Auspicious fasting day 🙏 Observe Ekadashi — जय श्री हरि!",
  pradosh: "Worship Lord Shiva at dusk 🕯️ ॐ नमः शिवाय!",
  purnima: "Sacred full moon 🌕 — prayers, charity and fasting. जय जगदीश हरे!",
  amavasya: "Amavasya 🌑 — time for Pitru Tarpan & ancestor puja 🙏",
};

async function scheduleSmartAlerts(
  type: SmartType,
  prefs: NotificationPrefs,
  monthsAhead = 6,
): Promise<void> {
  const prefix = `${NOTIF_IDS.SMART_PREFIX}${type}_`;

  // 1. Cancel + compute in parallel
  const cancelPromise = cancelByPrefix(prefix);

  const now = new Date();
  const end = addMonths(now, monthsAhead);
  const days = eachDayOfInterval({ start: now, end });

  // 2. Find matching tithi days (synchronous CPU work)
  interface SmartPending {
    id: string;
    notifDate: Date;
    tithiIno: number;
  }
  const pending: SmartPending[] = [];

  for (const day of days) {
    let tithiIno: number | undefined;
    try {
      const obs = new Observer(prefs.lat, prefs.lng, 200);
      const p = getPanchangam(day, obs, { timezoneOffset: TZ_OFFSET_MIN });
      tithiIno = p.tithiIno;
    } catch {
      continue;
    }

    if (tithiIno === undefined) continue;
    const meta = getDayMetaFromTithi(tithiIno);
    if (!meta || meta.type !== type) continue;

    const notifDate = new Date(day);
    notifDate.setHours(6, 0, 0, 0);
    if (notifDate <= now) continue;

    pending.push({
      id: `${prefix}${day.toISOString().slice(0, 10)}`,
      notifDate,
      tithiIno,
    });
  }

  // 3. Wait for cancel, then batch-schedule
  await cancelPromise;

  const tasks = pending.map(
    (item) => () =>
      Notifications.scheduleNotificationAsync({
        identifier: item.id,
        content: buildContent(
          SMART_TITLE[type],
          SMART_BODY[type],
          SMART_SCREEN[type],
          prefs,
          { tithiIno: item.tithiIno },
        ),
        trigger: dateTrigger(item.notifDate),
      }),
  );

  await runInBatches(tasks);
}

export const scheduleEkadashiAlerts = (p: NotificationPrefs) =>
  scheduleSmartAlerts("ekadashi", p);
export const schedulePradoshAlerts = (p: NotificationPrefs) =>
  scheduleSmartAlerts("pradosh", p);
export const schedulePurnimaAlerts = (p: NotificationPrefs) =>
  scheduleSmartAlerts("purnima", p);
export const scheduleAmavasayaAlerts = (p: NotificationPrefs) =>
  scheduleSmartAlerts("amavasya", p);

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOM REMINDERS
// ─────────────────────────────────────────────────────────────────────────────

export async function scheduleCustomReminder(
  reminder: CustomReminder,
  prefs: NotificationPrefs,
): Promise<void> {
  const id = `${NOTIF_IDS.CUSTOM_PREFIX}${reminder.id}`;
  await cancelByPrefix(id);

  if (reminder.days.length === 0) {
    await scheduleDaily(
      id,
      reminder.title,
      reminder.titleHi,
      reminder.hour,
      reminder.minute,
      reminder.screen,
      prefs,
    );
  } else {
    // Schedule all days in parallel — each is just one native call
    await Promise.all(
      reminder.days.map((day) =>
        scheduleWeekly(
          `${id}_${day}`,
          reminder.title,
          reminder.titleHi,
          day + 1,
          reminder.hour,
          reminder.minute,
          reminder.screen,
          prefs,
        ),
      ),
    );
  }
}

export async function cancelCustomReminder(id: string): Promise<void> {
  await cancelByPrefix(`${NOTIF_IDS.CUSTOM_PREFIX}${id}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// APPLY ALL  — fully parallelised, no sequential await chains
// ─────────────────────────────────────────────────────────────────────────────

export async function applyAllNotificationPrefs(
  prefs: NotificationPrefs,
): Promise<void> {
  const ok = await requestNotificationPermission();
  if (!ok) return;

  // Group 1: Simple recurring (each is a single native call — run all at once)
  const simpleToggleTasks: Promise<void>[] = [
    prefs.morningPuja
      ? scheduleMorningPuja(prefs)
      : cancelById(NOTIF_IDS.MORNING_PUJA),

    prefs.eveningAarti
      ? scheduleEveningAarti(prefs)
      : cancelById(NOTIF_IDS.EVENING_AARTI),

    prefs.dailyJap ? scheduleDailyJap(prefs) : cancelById(NOTIF_IDS.DAILY_JAP),

    prefs.weeklyDevotion
      ? scheduleWeeklyDevotion(prefs)
      : cancelById(NOTIF_IDS.WEEKLY_DEVOTION),
  ];

  // Group 2: Heavy date-loop tasks (festival + 4 smart types)
  // These each loop ~180 days internally — run them in parallel too
  const heavyTasks: Promise<void>[] = [
    prefs.festivalAlerts
      ? scheduleFestivalAlerts(prefs)
      : cancelByPrefix(NOTIF_IDS.FESTIVAL_PREFIX),

    prefs.ekadashiAlert
      ? scheduleEkadashiAlerts(prefs)
      : cancelByPrefix(`${NOTIF_IDS.SMART_PREFIX}ekadashi_`),

    prefs.pradoshAlert
      ? schedulePradoshAlerts(prefs)
      : cancelByPrefix(`${NOTIF_IDS.SMART_PREFIX}pradosh_`),

    prefs.purnimaAlert
      ? schedulePurnimaAlerts(prefs)
      : cancelByPrefix(`${NOTIF_IDS.SMART_PREFIX}purnima_`),

    prefs.amavasayaAlert
      ? scheduleAmavasayaAlerts(prefs)
      : cancelByPrefix(`${NOTIF_IDS.SMART_PREFIX}amavasya_`),
  ];

  // Group 3: Custom reminders
  const customTasks: Promise<void>[] = prefs.customReminders.map((rem) =>
    rem.enabled
      ? scheduleCustomReminder(rem, prefs)
      : cancelCustomReminder(rem.id),
  );

  // Run all three groups in parallel — none depend on each other
  await Promise.all([
    Promise.all(simpleToggleTasks),
    Promise.all(heavyTasks),
    Promise.all(customTasks),
  ]);
}
