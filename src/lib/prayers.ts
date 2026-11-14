import { format, parseISO } from "date-fns";

export const PRAYERS = [
  { key: "Fajr", label: "الفجر" },
  { key: "Dhuhr", label: "الظهر" },
  { key: "Asr", label: "العصر" },
  { key: "Maghrib", label: "المغرب" },
  { key: "Isha", label: "العشاء" },
] as const;

export const AZANS = [
  { value: "/azan/makki.mp3", label: "الحرم المكي" },
  { value: "/azan/madani.mp3", label: "الحرم المدني" },
  { value: "/azan/aqsa.mp3", label: "الأقصى" },
] as const;

export type AzanSource = (typeof AZANS)[number]["value"];
export type PrayerKey = (typeof PRAYERS)[number]["key"];
export type PrayerLocation =
  | { type: "coordinates"; latitude: number; longitude: number }
  | { type: "city"; city: string; country: string };

export type PrayerSchedule = {
  dateKey: string;
  timings: Record<PrayerKey, string>;
  timestamps: Record<PrayerKey, number>;
  timezone: string;
  hijriDate: string;
};

export type ZonedClock = { dateKey: string; time: string };

export type NextPrayer = {
  key: PrayerKey;
  label: string;
  dateKey: string;
  time: string;
  timestamp: number;
};

type AladhanResponse = {
  code: number;
  data?: {
    timings: Partial<Record<PrayerKey, string>>;
    meta: { timezone: string };
    date: {
      gregorian: { date: string };
      hijri?: { day: string; month: { ar: string }; year: string };
    };
  };
};

function normalizeTime(value: unknown) {
  const match =
    typeof value === "string" ? value.match(/^(\d{1,2}):(\d{2})(?:\s|$)/) : null;
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) {
    throw new Error("ورد وقت صلاة غير صالح. يرجى المحاولة مرة أخرى.");
  }
  return match[1].padStart(2, "0") + ":" + match[2];
}

function createZonedFormatter(timezone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    calendar: "gregory",
    numberingSystem: "latn",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
}

/** Use the location's timezone, including its daylight-saving rules. */
export function getZonedClock(date: Date, timezone: string): ZonedClock {
  const parts = createZonedFormatter(timezone).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    dateKey: [values.year, values.month, values.day].join("-"),
    time: values.hour + ":" + values.minute,
  };
}

/** Resolve a local prayer time to an instant using that date's UTC offset. */
export function getPrayerTimestamp(dateKey: string, time: string, timezone: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const desiredWallTime = Date.UTC(year, month - 1, day, hour, minute, 0);
  const formatter = createZonedFormatter(timezone);
  let timestamp = desiredWallTime;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = Object.fromEntries(
      formatter.formatToParts(new Date(timestamp)).map((part) => [part.type, Number(part.value)])
    );
    const actualWallTime = Date.UTC(
      parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second
    );
    const correction = desiredWallTime - actualWallTime;
    if (correction === 0) return timestamp;
    timestamp += correction;
  }

  throw new Error("تعذر تحديد توقيت الصلاة القادمة في هذه المنطقة الزمنية.");
}

export function getNextPrayer(schedule: PrayerSchedule, now: number): NextPrayer | null {
  const prayer = PRAYERS.find((item) => schedule.timestamps[item.key] > now);
  return prayer
    ? {
        ...prayer,
        dateKey: schedule.dateKey,
        time: schedule.timings[prayer.key],
        timestamp: schedule.timestamps[prayer.key],
      }
    : null;
}

export async function fetchPrayerTimes(
  location: PrayerLocation,
  dateKey: string,
  signal?: AbortSignal
): Promise<PrayerSchedule> {
  const apiDate = format(parseISO(dateKey), "dd-MM-yyyy");
  const params = new URLSearchParams({ method: "5" });
  const endpoint = location.type === "coordinates" ? "timings" : "timingsByCity";

  if (location.type === "coordinates") {
    params.set("latitude", String(location.latitude));
    params.set("longitude", String(location.longitude));
  } else {
    params.set("city", location.city);
    params.set("country", location.country);
  }

  const response = await fetch(
    "https://api.aladhan.com/v1/" + endpoint + "/" + apiDate + "?" + params,
    { signal }
  );
  if (!response.ok) {
    throw new Error("تعذر تحميل المواقيت. تحقق من الموقع والاتصال ثم حاول مرة أخرى.");
  }

  const body = (await response.json()) as AladhanResponse;
  const data = body.data;
  if (body.code !== 200 || !data || data.date?.gregorian?.date !== apiDate) {
    throw new Error("لم تتوفر مواقيت لهذا الموقع والتاريخ. تحقق من المدينة والدولة.");
  }

  const timezone = data.meta?.timezone;
  if (typeof timezone !== "string") {
    throw new Error("تعذر تحديد المنطقة الزمنية لهذا الموقع.");
  }
  // Validate before a timezone can enter the notification timer.
  try {
    getZonedClock(new Date(), timezone);
  } catch {
    throw new Error("وردت منطقة زمنية غير صالحة لهذا الموقع.");
  }

  const timings = Object.fromEntries(
    PRAYERS.map((prayer) => [prayer.key, normalizeTime(data.timings?.[prayer.key])])
  ) as Record<PrayerKey, string>;
  const timestamps = Object.fromEntries(
    PRAYERS.map((prayer) => [
      prayer.key,
      getPrayerTimestamp(dateKey, timings[prayer.key], timezone),
    ])
  ) as Record<PrayerKey, number>;
  const hijri = data.date.hijri;

  return {
    dateKey,
    timings,
    timestamps,
    timezone,
    hijriDate:
      hijri?.day && hijri.month?.ar && hijri.year
        ? [hijri.day, hijri.month.ar, hijri.year, "هـ"].join(" ")
        : "",
  };
}
