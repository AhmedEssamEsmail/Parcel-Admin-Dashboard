const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

type DateParts = {
  year: number;
  month: number;
  day: number;
};

type DateTimeParts = DateParts & {
  hour: number;
  minute: number;
  second: number;
};

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function isValidDateParts(parts: DateParts): boolean {
  if (parts.month < 1 || parts.month > 12) return false;
  if (parts.day < 1 || parts.day > 31) return false;

  const candidate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  return (
    candidate.getUTCFullYear() === parts.year &&
    candidate.getUTCMonth() + 1 === parts.month &&
    candidate.getUTCDate() === parts.day
  );
}

function parseDateFromString(raw: string): DateParts | null {
  const match = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s].*)/);
  if (!match) return null;

  const parts: DateParts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };

  return isValidDateParts(parts) ? parts : null;
}

function parseDateTimeFromString(raw: string): DateTimeParts | null {
  const match = raw
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!match) return null;

  const base: DateParts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
  if (!isValidDateParts(base)) return null;

  const hour = match[4] ? Number(match[4]) : 0;
  const minute = match[5] ? Number(match[5]) : 0;
  const second = match[6] ? Number(match[6]) : 0;

  if (
    Number.isNaN(hour) ||
    Number.isNaN(minute) ||
    Number.isNaN(second) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 59
  ) {
    return null;
  }

  return {
    ...base,
    hour,
    minute,
    second,
  };
}

function formatMmmDdFromParts(parts: DateParts): string {
  return `${MONTHS_SHORT[parts.month - 1]}-${pad2(parts.day)}`;
}

export function formatDateMmmDd(value: string | Date | null | undefined): string {
  if (value === null || value === undefined) return "-";

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "-";
    return formatMmmDdFromParts({
      year: value.getFullYear(),
      month: value.getMonth() + 1,
      day: value.getDate(),
    });
  }

  const parts = parseDateFromString(value);
  if (parts) return formatMmmDdFromParts(parts);

  return value;
}

export function formatDateTimeMmmDdHhMmSs(value: string | Date | null | undefined): string {
  if (value === null || value === undefined) return "-";

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "-";
    return `${formatMmmDdFromParts({
      year: value.getFullYear(),
      month: value.getMonth() + 1,
      day: value.getDate(),
    })} ${pad2(value.getHours())}:${pad2(value.getMinutes())}:${pad2(value.getSeconds())}`;
  }

  const parts = parseDateTimeFromString(value);
  if (parts) {
    return `${formatMmmDdFromParts(parts)} ${pad2(parts.hour)}:${pad2(parts.minute)}:${pad2(parts.second)}`;
  }

  return value;
}

export function formatMinutesToHHMM(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";

  const rounded = Math.round(value);
  const sign = rounded < 0 ? "-" : "";
  const absolute = Math.abs(rounded);
  const hours = Math.floor(absolute / 60);
  const minutes = absolute % 60;

  return `${sign}${pad2(hours)}:${pad2(minutes)}`;
}
