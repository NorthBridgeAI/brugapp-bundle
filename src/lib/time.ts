import { TIMEZONE } from "./types";

const weekdayFmt = new Intl.DateTimeFormat("nl-NL", {
  timeZone: TIMEZONE,
  weekday: "short",
});

const longWeekdayFmt = new Intl.DateTimeFormat("nl-NL", {
  timeZone: TIMEZONE,
  weekday: "long",
});

const dateFmt = new Intl.DateTimeFormat("nl-NL", {
  timeZone: TIMEZONE,
  day: "numeric",
  month: "long",
});

const timeFmt = new Intl.DateTimeFormat("nl-NL", {
  timeZone: TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const dateTimeFmt = new Intl.DateTimeFormat("nl-NL", {
  timeZone: TIMEZONE,
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function amsterdamParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  const weekdayMap: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };

  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    second: Number(get("second")),
    isoWeekday: weekdayMap[get("weekday")] ?? 1,
  };
}

export function minutesOfDay(date: Date): number {
  const { hour, minute } = amsterdamParts(date);
  return hour * 60 + minute;
}

export function parseHhmm(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function formatTime(date: Date): string {
  return timeFmt.format(date);
}

export function formatClock(date: Date): string {
  return dateTimeFmt.format(date);
}

export function formatDate(date: Date): string {
  return dateFmt.format(date);
}

export function formatWeekday(date: Date, long = false): string {
  const label = long ? longWeekdayFmt.format(date) : weekdayFmt.format(date);
  return label.replace(/\.$/, "");
}

export function formatCountdown(from: Date, to: Date): string {
  const diffMs = to.getTime() - from.getTime();
  if (diffMs <= 0) return "nu";

  const totalMinutes = Math.round(diffMs / 60_000);
  if (totalMinutes < 1) return "zojuist";
  if (totalMinutes < 60) return `over ${totalMinutes} min`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours >= 24) {
    const days = Math.round(hours / 24);
    return days === 1 ? "morgen" : `over ${days} dagen`;
  }
  if (minutes === 0) return hours === 1 ? "over 1 uur" : `over ${hours} uur`;
  return `over ${hours} u ${minutes} min`;
}

export function isWeekend(isoWeekday: number): boolean {
  return isoWeekday === 6 || isoWeekday === 7;
}

/** Build a Date for today's Amsterdam wall-clock HH:mm. */
export function atToday(now: Date, hhmm: string): Date {
  const parts = amsterdamParts(now);
  const [hour, minute] = hhmm.split(":").map(Number);
  return zonedDate(parts.year, parts.month, parts.day, hour, minute);
}

export function addAmsterdamDays(now: Date, days: number): Date {
  const parts = amsterdamParts(now);
  const utcNoon = Date.UTC(parts.year, parts.month - 1, parts.day, 12, 0, 0);
  const shifted = new Date(utcNoon + days * 24 * 60 * 60 * 1000);
  return zonedDate(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth() + 1,
    shifted.getUTCDate(),
    0,
    0,
  );
}

export function zonedDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): Date {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const offset = amsterdamOffsetMs(new Date(utcGuess));
  return new Date(utcGuess - offset);
}

function wallAsUtcMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const num = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return Date.UTC(
    num("year"),
    num("month") - 1,
    num("day"),
    num("hour"),
    num("minute"),
    num("second"),
  );
}

function amsterdamOffsetMs(date: Date): number {
  return wallAsUtcMs(date, TIMEZONE) - date.getTime();
}

export function inWindow(nowMinutes: number, start: string, end: string): boolean {
  const from = parseHhmm(start);
  const to = parseHhmm(end);
  if (from === to) return false;
  if (from < to) return nowMinutes >= from && nowMinutes < to;
  return nowMinutes >= from || nowMinutes < to;
}

export function countryLabel(code: "NL" | "BE"): string {
  return code === "NL" ? "Nederland" : "België";
}

export function mapsUrl(lat: number, lng: number): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`;
}

export function geoUrl(lat: number, lng: number): string {
  return `geo:${lat},${lng}`;
}
