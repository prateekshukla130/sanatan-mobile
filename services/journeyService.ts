import AsyncStorage from "@react-native-async-storage/async-storage";

const LOG_KEY = "@sanatan_journey_log";

export interface DayLog {
  morningPrayer: boolean;
  eveningMeditation: boolean;
  japCount: number;
  meditationMinutes: number;
  templeVisits: number;
  readingDone: boolean;
}

export interface MonthStats {
  jaap: number;
  meditationMinutes: number;
  readingDays: number;
  temples: number;
}

type JourneyLog = Record<string, DayLog>; // key = YYYY-MM-DD

const emptyDay = (): DayLog => ({
  morningPrayer: false,
  eveningMeditation: false,
  japCount: 0,
  meditationMinutes: 0,
  templeVisits: 0,
  readingDone: false,
});

function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isDayActive(day: DayLog): boolean {
  return (
    day.morningPrayer ||
    day.eveningMeditation ||
    day.japCount > 0 ||
    day.meditationMinutes > 0 ||
    day.templeVisits > 0 ||
    day.readingDone
  );
}

async function readLog(): Promise<JourneyLog> {
  try {
    const raw = await AsyncStorage.getItem(LOG_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function writeLog(log: JourneyLog): Promise<void> {
  await AsyncStorage.setItem(LOG_KEY, JSON.stringify(log));
}

async function updateToday(mutator: (day: DayLog) => void): Promise<DayLog> {
  const log = await readLog();
  const key = dateKey(new Date());
  const day = log[key] ?? emptyDay();
  mutator(day);
  log[key] = day;
  await writeLog(log);
  return day;
}

export const journeyService = {
  async getToday(): Promise<DayLog> {
    const log = await readLog();
    return log[dateKey(new Date())] ?? emptyDay();
  },

  async toggleMorningPrayer(): Promise<DayLog> {
    return updateToday((d) => {
      d.morningPrayer = !d.morningPrayer;
    });
  },

  async toggleEveningMeditation(): Promise<DayLog> {
    return updateToday((d) => {
      d.eveningMeditation = !d.eveningMeditation;
    });
  },

  async logJapIncrement(n = 1): Promise<DayLog> {
    return updateToday((d) => {
      d.japCount += n;
    });
  },

  async logMeditationMinutes(minutes: number): Promise<DayLog> {
    return updateToday((d) => {
      d.meditationMinutes += minutes;
    });
  },

  async logTempleVisit(): Promise<DayLog> {
    return updateToday((d) => {
      d.templeVisits += 1;
    });
  },

  async markReadingDone(): Promise<DayLog> {
    return updateToday((d) => {
      d.readingDone = true;
    });
  },

  async getMonthStats(): Promise<MonthStats> {
    const log = await readLog();
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    let jaap = 0;
    let meditationMinutes = 0;
    let readingDays = 0;
    let temples = 0;
    for (const [key, day] of Object.entries(log)) {
      if (key.startsWith(ym)) {
        jaap += day.japCount;
        meditationMinutes += day.meditationMinutes;
        temples += day.templeVisits;
        if (day.readingDone) readingDays += 1;
      }
    }
    return { jaap, meditationMinutes, readingDays, temples };
  },

  async getStreak(): Promise<number> {
    const log = await readLog();
    const cursor = new Date();
    const todayActive = isDayActive(log[dateKey(cursor)] ?? emptyDay());
    if (!todayActive) {
      cursor.setDate(cursor.getDate() - 1);
    }
    let streak = 0;
    for (let i = 0; i < 3650; i++) {
      const day = log[dateKey(cursor)];
      if (day && isDayActive(day)) {
        streak += 1;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  },
};
