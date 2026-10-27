"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import SetPageHeader from "@/components/ui/SetPageHeader";
import DateRangePicker, { type DateRangeValue } from "@/components/ui/DateRangePicker";
import { toSearchParams, type ResolvedRange, toPickerValue } from "./DashboardRange";

interface Props {
  range: ResolvedRange;
  description: string;
}

/** Dashboard page header with a date-range picker that refetches via URL params. */
export default function DashboardHeader({ range, description }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleChange(value: DateRangeValue) {
    const params = new URLSearchParams(toSearchParams(value));
    startTransition(() => {
      router.replace(`/dashboard?${params.toString()}`, { scroll: false });
    });
  }

  return (
    <div className={isPending ? "opacity-70 transition-opacity" : "transition-opacity"}>
      <SetPageHeader
        title="Dashboard"
        description={description}
        icon="solar:widget-2-broken"
        actions={[{ label: "Post Job", icon: "solar:add-circle-broken", href: "/hire/jobs/new", variant: "primary", write: true }]}
        trailing={<DateRangePicker value={toPickerValue(range)} onChange={handleChange} />}
        trailingIsFilter
      />
    </div>
  );
}
