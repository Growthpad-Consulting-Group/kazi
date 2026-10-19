"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Icon } from "@iconify/react";

export interface TabDef {
  id: string;
  label: string;
  icon: string;
  paramName?: string; // which searchParam key drives this tab (default: "tab")
}

interface TabBarProps {
  tabs: TabDef[];
  paramName?: string;
}

export default function TabBar({ tabs, paramName = "tab" }: TabBarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get(paramName) ?? tabs[0]?.id;

  return (
    <div className="mb-6 flex items-center gap-1 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-1.5">
      {tabs.map((tab) => {
        const isActive = current === tab.id;
        const params = new URLSearchParams(searchParams.toString());
        if (tab.id === tabs[0]?.id) params.delete(paramName);
        else params.set(paramName, tab.id);
        const href = params.toString() ? `${pathname}?${params}` : pathname;

        return (
          <Link
            key={tab.id}
            href={href}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
              isActive
                ? "bg-[#f05d23] text-white shadow-sm"
                : "text-[var(--text-lo)] hover:bg-[var(--surface-2)] hover:text-[var(--text-hi)]"
            }`}
          >
            <Icon icon={tab.icon} className="h-4 w-4 shrink-0" />
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
