import { parseNullableString, parseWarehouseDateToIso } from "@/lib/ingest/dates";
import { getField } from "@/lib/ingest/normalizers/helpers";
import type {
  CsvRow,
  IngestError,
  NormalizedDeliveryTimingRuleRow,
} from "@/lib/ingest/types";

type SlaParseResult =
  | { sla_mode: "SAME_DAY"; sla_hours: null }
  | { sla_mode: "FIXED_HOURS"; sla_hours: number };

function toTimeStringFromSeconds(totalSeconds: number): string {
  const normalizedSeconds = ((Math.round(totalSeconds) % 86400) + 86400) % 86400;
  const hours = Math.floor(normalizedSeconds / 3600);
  const minutes = Math.floor((normalizedSeconds % 3600) / 60);
  const seconds = normalizedSeconds % 60;

  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

function parseTimeLike(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;

  const numeric = Number(raw);
  if (Number.isFinite(numeric)) {
    if (numeric >= 0 && numeric < 1) {
      return toTimeStringFromSeconds(numeric * 24 * 60 * 60);
    }

    if (numeric >= 0 && numeric <= 24) {
      return toTimeStringFromSeconds(numeric * 60 * 60);
    }
  }

  const timeMatch = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?$/i);
  if (timeMatch) {
    let hours = Number.parseInt(timeMatch[1], 10);
    const minutes = Number.parseInt(timeMatch[2], 10);
    const seconds = Number.parseInt(timeMatch[3] || "0", 10);
    const meridiem = timeMatch[4]?.toUpperCase();

    if (meridiem === "AM") {
      hours = hours === 12 ? 0 : hours;
    } else if (meridiem === "PM") {
      hours = hours === 12 ? 12 : hours + 12;
    }

    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59 && seconds >= 0 && seconds <= 59) {
      return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
    }
  }

  const maybeIso = parseWarehouseDateToIso(raw);
  if (!maybeIso) return null;

  return maybeIso.slice(11, 19);
}

function parseSla(value: string): SlaParseResult | null {
  const raw = value.trim();
  if (!raw) return null;

  if (raw.toLowerCase() === "same day") {
    return { sla_mode: "SAME_DAY", sla_hours: null };
  }

  const numeric = Number(raw);
  if (Number.isFinite(numeric) && numeric > 0) {
    const hours = numeric <= 1 ? numeric * 24 : numeric;
    if (hours > 0 && hours <= 72) {
      return {
        sla_mode: "FIXED_HOURS",
        sla_hours: Number(hours.toFixed(3)),
      };
    }
  }

  const timeLike = parseTimeLike(raw);
  if (timeLike) {
    const [hours, minutes, seconds] = timeLike.split(":").map((part) => Number.parseInt(part, 10));
    const totalHours = hours + minutes / 60 + seconds / 3600;
    if (totalHours > 0 && totalHours <= 72) {
      return {
        sla_mode: "FIXED_HOURS",
        sla_hours: Number(totalHours.toFixed(3)),
      };
    }
  }

  return null;
}

export function normalizeDeliveryTimingRulesRows(rows: CsvRow[]): {
  validRows: NormalizedDeliveryTimingRuleRow[];
  errors: IngestError[];
} {
  const validRows: NormalizedDeliveryTimingRuleRow[] = [];
  const errors: IngestError[] = [];

  rows.forEach((row, index) => {
    const city = parseNullableString(getField(row, ["city", "City"]));
    const cutoffRaw = parseNullableString(getField(row, ["cutoff time", "Cutoff Time"]));
    const startRaw = parseNullableString(getField(row, ["start time", "Start Time"]));
    const slaRaw = parseNullableString(
      getField(row, ["delivery sla hours", "Delivery SLA Hours", "delivery_sla_hours", "Delivery SLA"]),
    );

    if (!city) {
      errors.push({ row: index + 2, message: "Missing city" });
      return;
    }

    if (!slaRaw) {
      errors.push({ row: index + 2, message: "Missing delivery SLA value" });
      return;
    }

    const sla = parseSla(slaRaw);
    if (!sla) {
      errors.push({ row: index + 2, message: "Invalid delivery SLA value" });
      return;
    }

    validRows.push({
      city,
      city_normalized: city.trim().toLowerCase(),
      cutoff_time: cutoffRaw ? parseTimeLike(cutoffRaw) : null,
      start_time: startRaw ? parseTimeLike(startRaw) : null,
      sla_mode: sla.sla_mode,
      sla_hours: sla.sla_hours,
    });
  });

  return { validRows, errors };
}
