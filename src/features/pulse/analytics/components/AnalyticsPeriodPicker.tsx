"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import DateRangePicker, {
  type DateRangeValue,
} from "@/components/ui/DateRangePicker";
import {
  toPickerValue,
  toSearchParams,
  type ResolvedRange,
} from "@/features/dashboard/components/DashboardRange";

export function AnalyticsPeriodPicker({ range }: { range: ResolvedRange }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function handleChange(value: DateRangeValue) {
    const params = new URLSearchParams(searchParams.toString());
    for (const key of ["range", "from", "to", "preset"]) params.delete(key);
    for (const [key, val] of Object.entries(toSearchParams(value)))
      params.set(key, val);
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  return (
    <div
      className={
        isPending ? "opacity-70 transition-opacity" : "transition-opacity"
      }
    >
      <DateRangePicker value={toPickerValue(range)} onChange={handleChange} />
    </div>
  );
}
