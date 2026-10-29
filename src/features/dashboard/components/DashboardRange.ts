import { computePresetRange, sod, eod } from "@/components/ui/dateRangePresets";
import type { DateRangeValue } from "@/components/ui/DateRangePicker";

export interface ResolvedRange {
  startDate: Date;
  endDate: Date;
  label: string;
}

const ALL_TIME_FROM = new Date(2020, 0, 1);

/**
 * Resolves a range from the `from`, `to` and `preset` URL params.
 * Falls back to "Today" when nothing is provided.
 */
export function resolveRange(params: {
  from?: string;
  to?: string;
  preset?: string;
}): ResolvedRange {
  const start = params.from ? new Date(params.from) : null;
  const end = params.to ? new Date(params.to) : null;

  if (start && end && !isNaN(start.getTime()) && !isNaN(end.getTime())) {
    return {
      startDate: sod(start),
      endDate: eod(end),
      label: params.preset || "Custom Range",
    };
  }
  if (params.preset === "All Time") {
    return {
      startDate: sod(ALL_TIME_FROM),
      endDate: eod(new Date()),
      label: "All Time",
    };
  }
  const preset = computePresetRange(params.preset || "Today");
  return {
    startDate: preset.startDate ?? sod(new Date()),
    endDate: preset.endDate ?? eod(new Date()),
    label: params.preset || "Today",
  };
}

/** The value passed to the client-side DateRangePicker. */
export function toPickerValue(range: ResolvedRange): DateRangeValue {
  return {
    startDate: range.startDate,
    endDate: range.endDate,
    label: range.label,
  };
}

/** Serialises a picker value into URL params. */
export function toSearchParams(value: DateRangeValue): Record<string, string> {
  const label =
    value.label === "Custom Range" || !value.label
      ? "Custom Range"
      : value.label;
  if (!value.startDate || !value.endDate) return { preset: label };
  return {
    preset: label,
    from: value.startDate.toISOString(),
    to: value.endDate.toISOString(),
  };
}
