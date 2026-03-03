const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

function toUtcIsoFromGmt3(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
): string {
  const utcMillis = Date.UTC(year, month - 1, day, hour - 3, minute, second, 0);
  return new Date(utcMillis).toISOString();
}

function parseMonthName(value: string): number | null {
  const key = value.trim().toLowerCase();
  return MONTHS[key] ?? null;
}

function to24Hour(hour: number, meridiem: string | null): number {
  if (!meridiem) {
    return hour;
  }

  const upper = meridiem.toUpperCase();
  if (upper === "AM") {
    return hour === 12 ? 0 : hour;
  }

  if (upper === "PM") {
    return hour === 12 ? 12 : hour + 12;
  }

  return hour;
}

function toInt(value: string): number {
  return Number.parseInt(value, 10);
}

export function parseWarehouseDateToIso(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const raw = String(value).trim();
  if (!raw || raw.toLowerCase() === "na" || raw.toLowerCase() === "null") {
    return null;
  }

  // ISO-like values are accepted directly.
  if (/^\d{4}-\d{2}-\d{2}t/i.test(raw)) {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  // Example: Feb 7, 2026, 8:08:00 AM
  const monthFirst12h = raw.match(
    /^([A-Za-z]{3,9})\s+(\d{1,2}),\s*(\d{4}),?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i,
  );
  if (monthFirst12h) {
    const month = parseMonthName(monthFirst12h[1]);
    if (!month) return null;
    const day = toInt(monthFirst12h[2]);
    const year = toInt(monthFirst12h[3]);
    const hour = to24Hour(toInt(monthFirst12h[4]), monthFirst12h[7]);
    const minute = toInt(monthFirst12h[5]);
    const second = monthFirst12h[6] ? toInt(monthFirst12h[6]) : 0;
    return toUtcIsoFromGmt3(year, month, day, hour, minute, second);
  }

  // Example: 1 Feb, 2026 8:28:33
  const dayFirst24h = raw.match(
    /^(\d{1,2})\s+([A-Za-z]{3,9}),\s*(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/i,
  );
  if (dayFirst24h) {
    const month = parseMonthName(dayFirst24h[2]);
    if (!month) return null;
    const day = toInt(dayFirst24h[1]);
    const year = toInt(dayFirst24h[3]);
    const hour = toInt(dayFirst24h[4]);
    const minute = toInt(dayFirst24h[5]);
    const second = dayFirst24h[6] ? toInt(dayFirst24h[6]) : 0;
    return toUtcIsoFromGmt3(year, month, day, hour, minute, second);
  }

  // Example: 30/01/2026 07:22:22
  const slashFormat = raw.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/,
  );
  if (slashFormat) {
    const day = toInt(slashFormat[1]);
    const month = toInt(slashFormat[2]);
    const year = toInt(slashFormat[3]);
    const hour = toInt(slashFormat[4]);
    const minute = toInt(slashFormat[5]);
    const second = slashFormat[6] ? toInt(slashFormat[6]) : 0;
    return toUtcIsoFromGmt3(year, month, day, hour, minute, second);
  }

  // Example: 2025-10-11 12:00:00 AM
  const isoSpace = raw.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?$/i,
  );
  if (isoSpace) {
    const year = toInt(isoSpace[1]);
    const month = toInt(isoSpace[2]);
    const day = toInt(isoSpace[3]);
    const hour = to24Hour(toInt(isoSpace[4]), isoSpace[7] ?? null);
    const minute = toInt(isoSpace[5]);
    const second = isoSpace[6] ? toInt(isoSpace[6]) : 0;
    return toUtcIsoFromGmt3(year, month, day, hour, minute, second);
  }

  return null;
}

export function parseNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw || raw.toLowerCase() === "na" || raw === "-") return null;

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseNullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw || raw.toLowerCase() === "na") return null;
  return raw;
}
