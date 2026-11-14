"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import SetPageHeader from "@/components/ui/SetPageHeader";
import DateRangePicker, {
  type DateRangeValue,
} from "@/components/ui/DateRangePicker";
import {
  toSearchParams,
  type ResolvedRange,
  toPickerValue,
} from "./DashboardRange";
import HireWorkspaceSwitcher from "@/features/hire/components/HireWorkspaceSwitcher";
import type { HireCompanyAccess } from "@/lib/hire-company-access";
import { ALL_HIRE_WORKSPACES } from "@/lib/hire-workspace-constants";

interface Props {
  range: ResolvedRange;
  description: string;
  hireWorkspace?: {
    companies: HireCompanyAccess[];
    activeSlug: string;
  };
}

/** Dashboard page header with a date-range picker that refetches via URL params. */
export default function DashboardHeader({
  range,
  description,
  hireWorkspace,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleChange(value: DateRangeValue) {
    const params = new URLSearchParams(toSearchParams(value));
    if (hireWorkspace) params.set("company", hireWorkspace.activeSlug);
    startTransition(() => {
      router.replace(`/dashboard?${params.toString()}`, { scroll: false });
    });
  }

  return (
    <div
      className={
        isPending ? "opacity-70 transition-opacity" : "transition-opacity"
      }
    >
      <SetPageHeader
        title="Dashboard"
        description={description}
        icon="solar:widget-2-broken"
        actions={
          hireWorkspace?.activeSlug === ALL_HIRE_WORKSPACES
            ? []
            : [
                {
                  label: "Post Job",
                  icon: "solar:add-circle-broken",
                  href: hireWorkspace
                    ? `/hire/jobs/new?company=${encodeURIComponent(hireWorkspace.activeSlug)}`
                    : "/hire/jobs/new",
                  variant: "primary" as const,
                  write: true,
                },
              ]
        }
        trailing={
          <div className="flex flex-wrap items-center justify-end gap-2">
            {hireWorkspace && (
              <HireWorkspaceSwitcher
                companies={hireWorkspace.companies}
                activeSlug={hireWorkspace.activeSlug}
              />
            )}
            <DateRangePicker
              value={toPickerValue(range)}
              onChange={handleChange}
              className="[&_button]:h-9 [&_button]:py-0"
            />
          </div>
        }
        trailingIsFilter
      />
    </div>
  );
}
