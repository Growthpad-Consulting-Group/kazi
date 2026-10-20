import {
  startOfMonth,
  endOfMonth,
  subDays,
  subMonths,
  startOfYear,
  startOfWeek,
  endOfWeek,
} from 'date-fns';

/**
 * Date-range preset names and the date math behind them.
 *
 * This module is deliberately free of "use client" directives and browser-only
 * imports so it can be used from both client components and server components
 * / server actions. Do not import DateRangePicker here.
 */

export const PRESETS: readonly string[] = [
  'Today',
  'Yesterday',
  'Last 7 Days',
  'Last 30 Days',
  'Last 90 Days',
  'This Week',
  'Last Week',
  'This Month',
  'Last Month',
  'This Year',
  'All Time',
  'Custom Range',
] as const;

export function sod(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}
export function eod(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

export function computePresetRange(label: string): { startDate: Date | null; endDate: Date | null } {
  const now = new Date();
  switch (label) {
    case 'Today': return { startDate: sod(now), endDate: eod(now) };
    case 'Yesterday': { const y = subDays(now, 1); return { startDate: sod(y), endDate: eod(y) }; }
    case 'Last 7 Days': return { startDate: sod(subDays(now, 6)), endDate: eod(now) };
    case 'Last 30 Days': return { startDate: sod(subDays(now, 29)), endDate: eod(now) };
    case 'Last 90 Days': return { startDate: sod(subDays(now, 89)), endDate: eod(now) };
    case 'This Week': return { startDate: startOfWeek(now, { weekStartsOn: 1 }), endDate: eod(now) };
    case 'Last Week': {
      const lws = startOfWeek(subDays(now, 7), { weekStartsOn: 1 });
      const lwe = endOfWeek(subDays(now, 7), { weekStartsOn: 1 });
      return { startDate: lws, endDate: lwe };
    }
    case 'This Month': return { startDate: startOfMonth(now), endDate: eod(now) };
    case 'Last Month': { const lm = subMonths(now, 1); return { startDate: startOfMonth(lm), endDate: endOfMonth(lm) }; }
    case 'This Year': return { startDate: startOfYear(now), endDate: eod(now) };
    case 'All Time': return { startDate: new Date(2020, 0, 1), endDate: eod(now) };
    default: return { startDate: null, endDate: null };
  }
}
