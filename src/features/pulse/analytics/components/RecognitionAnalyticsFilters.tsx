"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { Icon } from "@iconify/react";

export interface RecognitionAnalyticsFiltersProps {
  departments: string[];
  campaigns: { id: string; name: string }[];
}

const selectCls =
  "rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-hi)] outline-none focus:border-brand-500 transition-colors";

export function RecognitionAnalyticsFilters({
  departments,
  campaigns,
}: RecognitionAnalyticsFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const update = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams],
  );

  const range = searchParams.get("range") ?? "30d";
  const dept = searchParams.get("dept") ?? "";
  const campaign = searchParams.get("campaign") ?? "";

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 shadow-sm">
        <Icon icon="solar:calendar-broken" className="h-4 w-4 shrink-0 text-brand-500" />
        <label className="text-xs font-semibold text-[var(--text-lo)]">Period</label>
        <select
          value={range}
          onChange={(e) => update("range", e.target.value)}
          className={selectCls}
          aria-label="Date range"
        >
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
          <option value="all">All time</option>
        </select>
      </div>

      {departments.length > 0 && (
        <div className="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 shadow-sm">
          <Icon icon="solar:buildings-broken" className="h-4 w-4 shrink-0 text-[var(--text-lo)]" />
          <label className="text-xs font-semibold text-[var(--text-lo)]">Department</label>
          <select
            value={dept}
            onChange={(e) => update("dept", e.target.value)}
            className={selectCls}
            aria-label="Department filter"
          >
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      )}

      {campaigns.length > 0 && (
        <div className="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 shadow-sm">
          <Icon icon="solar:flag-2-broken" className="h-4 w-4 shrink-0 text-[var(--text-lo)]" />
          <label className="text-xs font-semibold text-[var(--text-lo)]">Campaign</label>
          <select
            value={campaign}
            onChange={(e) => update("campaign", e.target.value)}
            className={selectCls}
            aria-label="Campaign filter"
          >
            <option value="">All campaigns</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
