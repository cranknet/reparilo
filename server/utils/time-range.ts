import type { Prisma } from "@prisma/client";

export interface DateRange {
  end: Date;
  start: Date;
}

function zonedParts(tz: string, d: Date) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(d).map((p) => [p.type, p.value])
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: parts.hour === "24" ? 0 : Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/**
 * Convert a zoned (year, month, day) at midnight to a UTC Date.
 * Uses the offset at UTC noon on the same date to handle DST correctly.
 */
function utcFromZonedYmd(tz: string, y: number, m: number, d: number): Date {
  // Reference point: UTC noon of the target date (always on the correct
  // local day for offsets within ±12h, and close enough for ±14h).
  const ref = Date.UTC(y, m - 1, d, 12, 0, 0);
  const {
    year: zY,
    month: zM,
    day: zD,
    hour: zH,
    minute: zMin,
    second: zS,
  } = zonedParts(tz, new Date(ref));

  // Treat the zoned wall-clock reading as if it were UTC to compute offset
  const zonedEpoch = Date.UTC(zY, zM - 1, zD, zH, zMin, zS);
  const offsetMs = ref - zonedEpoch;

  // Apply the same offset to midnight of the target date
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0) + offsetMs);
}

export function todayRange(tz: string, now: Date = new Date()): DateRange {
  const { year, month, day } = zonedParts(tz, now);
  const start = utcFromZonedYmd(tz, year, month, day);

  const tomorrow = new Date(Date.UTC(year, month - 1, day + 1));
  const end = utcFromZonedYmd(
    tz,
    tomorrow.getUTCFullYear(),
    tomorrow.getUTCMonth() + 1,
    tomorrow.getUTCDate()
  );

  return { start, end };
}

export function monthRange(tz: string, now: Date = new Date()): DateRange {
  const { year, month } = zonedParts(tz, now);
  const start = utcFromZonedYmd(tz, year, month, 1);
  const nextY = month === 12 ? year + 1 : year;
  const nextM = month === 12 ? 1 : month + 1;
  const end = utcFromZonedYmd(tz, nextY, nextM, 1);
  return { start, end };
}

export function toMoney(d: Prisma.Decimal | number | null | undefined): number {
  if (d === null || d === undefined) {
    return 0;
  }
  const n = typeof d === "number" ? d : Number(d.toString());
  return Math.round(n * 100) / 100;
}
