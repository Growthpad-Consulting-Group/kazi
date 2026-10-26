"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "@iconify/react";

function todayLocal() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function DailyLogReminder() {
  const [unlogged, setUnlogged] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/pulse/daily-log?date=${todayLocal()}`)
      .then((res) => res.json())
      .then((json: { entries?: unknown[] }) => {
        if (!cancelled) setUnlogged((json.entries ?? []).length === 0);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (!unlogged) return null;

  return (
    <Link
      href="/pulse/checkins?tab=daily"
      className="flex items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-4 transition-colors hover:bg-amber-500/15"
    >
      <span className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 text-amber-600">
          <Icon icon="solar:notebook-broken" className="h-4 w-4" />
        </span>
        <span>
          <span className="block text-sm font-semibold text-[var(--text-hi)]">Log today&apos;s activity</span>
          <span className="block text-xs text-[var(--text-lo)]">Note what you worked on and how long it took before you finish for the day.</span>
        </span>
      </span>
      <Icon icon="solar:arrow-right-broken" className="h-4 w-4 shrink-0 text-amber-600" />
    </Link>
  );
}
