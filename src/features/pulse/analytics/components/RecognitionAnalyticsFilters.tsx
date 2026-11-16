"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { Icon } from "@iconify/react";
import Select from "react-select";
import { cn } from "@/shared/lib/cn";

type DepartmentOption = { value: string; label: string };

export interface RecognitionAnalyticsFiltersProps {
  departments: string[];
  campaigns: { id: string; name: string }[];
}

const selectCls =
  "h-6 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0 text-sm text-[var(--text-hi)] outline-none focus:border-brand-500 transition-colors";

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

  const dept = searchParams.get("dept") ?? "";
  const campaign = searchParams.get("campaign") ?? "";
  const departmentOptions: DepartmentOption[] = [
    { value: "", label: "All departments" },
    ...departments.map((d) => ({ value: d, label: d })),
  ];

  return (
    <div className="flex flex-wrap items-center gap-3">
      {departments.length > 0 && (
        <div className="flex h-8 items-center">
          <Select<DepartmentOption, false>
            instanceId="department-filter"
            aria-label="Department filter"
            options={departmentOptions}
            value={
              departmentOptions.find((option) => option.value === dept) ??
              departmentOptions[0]
            }
            onChange={(option) => update("dept", option?.value ?? "")}
            isSearchable
            unstyled
            className="h-8 w-40"
            styles={{
              container: (base) => ({ ...base, height: 32, minHeight: 32 }),
              control: (base) => ({ ...base, height: 32, minHeight: 32 }),
            }}
            classNames={{
              control: ({ isFocused }) =>
                cn(
                  "flex h-full w-full cursor-pointer items-center rounded-lg border bg-[var(--surface)] px-3 text-sm font-medium text-[var(--text-hi)] transition-colors hover:border-brand-500/40",
                  isFocused ? "border-brand-500" : "border-[var(--border)]",
                ),
              valueContainer: () => "min-w-0 flex-1 py-0 px-0.5",
              singleValue: () => "truncate text-[var(--text-hi)]",
              input: () => "m-0 p-0 text-[var(--text-hi)]",
              placeholder: () => "text-[var(--text-lo)]",
              indicatorSeparator: () => "hidden",
              dropdownIndicator: () => "px-0.5 text-[var(--text-lo)]",
              menu: () =>
                "z-50 mt-1 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xl",
              menuList: () => "max-h-60 overflow-y-auto py-1",
              option: ({ isFocused, isSelected }) =>
                cn(
                  "cursor-pointer px-3 py-1.5 text-sm",
                  isSelected
                    ? "bg-brand-500 text-white"
                    : isFocused
                      ? "bg-[var(--surface-2)] text-[var(--text-hi)]"
                      : "text-[var(--text-hi)]",
                ),
              noOptionsMessage: () => "px-3 py-2 text-sm text-[var(--text-lo)]",
            }}
          />
        </div>
      )}

      {campaigns.length > 0 && (
        <div className="flex h-8 items-center gap-2">
          <Icon
            icon="solar:flag-2-broken"
            className="h-4 w-4 shrink-0 text-[var(--text-lo)]"
          />
          <label className="text-xs font-semibold text-[var(--text-lo)]">
            Campaign
          </label>
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
