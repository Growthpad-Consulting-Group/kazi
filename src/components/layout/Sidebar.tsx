"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserRole } from "@/types/database";
import { hasRole } from "@/lib/rbac";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  requiredRole: UserRole;
}

const NAV: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: <GridIcon />,
    requiredRole: "employee",
  },
  {
    label: "Jobs",
    href: "/hire/jobs",
    icon: <BriefcaseIcon />,
    requiredRole: "interviewer",
  },
  {
    label: "Candidates",
    href: "/hire/candidates",
    icon: <UsersIcon />,
    requiredRole: "interviewer",
  },
  {
    label: "Pipeline",
    href: "/hire/pipeline",
    icon: <KanbanIcon />,
    requiredRole: "interviewer",
  },
  {
    label: "Team",
    href: "/people",
    icon: <OrgIcon />,
    requiredRole: "manager",
  },
  {
    label: "Settings",
    href: "/settings",
    icon: <SettingsIcon />,
    requiredRole: "admin",
  },
];

export function Sidebar({ role }: { role: UserRole }) {
  const pathname = usePathname();

  const visible = NAV.filter((item) => hasRole(role, item.requiredRole));

  return (
    <aside className="w-56 flex-shrink-0 flex flex-col bg-slate-900 text-slate-400">
      {/* Wordmark */}
      <div className="h-14 flex items-center px-5 border-b border-slate-800">
        <span className="text-white font-bold text-lg tracking-tight">Kazi</span>
        <span className="ml-2 text-xs text-slate-500 font-medium">by Growthpad</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 space-y-0.5 px-2">
        <p className="px-3 mb-2 text-xs font-semibold text-slate-600 uppercase tracking-widest">
          Kazi Hire
        </p>
        {visible.map((item) => {
          const active =
            item.href === "/dashboard"
              ? pathname === item.href
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-slate-800 text-white"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <span className="w-4 h-4 flex-shrink-0">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="p-4 border-t border-slate-800 text-xs text-slate-600">
        <span className="capitalize">{role.replace("_", " ")}</span>
      </div>
    </aside>
  );
}

function GridIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1" y="1" width="6" height="6" rx="1" />
      <rect x="9" y="1" width="6" height="6" rx="1" />
      <rect x="1" y="9" width="6" height="6" rx="1" />
      <rect x="9" y="9" width="6" height="6" rx="1" />
    </svg>
  );
}

function BriefcaseIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1" y="5" width="14" height="9" rx="1.5" />
      <path d="M5 5V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1" />
      <line x1="1" y1="9" x2="15" y2="9" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="6" cy="5" r="2.5" />
      <path d="M1 14c0-2.76 2.24-5 5-5s5 2.24 5 5" />
      <path d="M11 7c1.38 0 2.5 1.12 2.5 2.5" strokeOpacity=".5" />
      <path d="M13.5 14c0-1.93-.93-3.63-2.35-4.66" strokeOpacity=".5" />
    </svg>
  );
}

function KanbanIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1" y="2" width="4" height="8" rx="1" />
      <rect x="6" y="2" width="4" height="5" rx="1" />
      <rect x="11" y="2" width="4" height="11" rx="1" />
    </svg>
  );
}

function OrgIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="5.5" y="1" width="5" height="3.5" rx="1" />
      <rect x="1" y="11.5" width="4.5" height="3.5" rx="1" />
      <rect x="10.5" y="11.5" width="4.5" height="3.5" rx="1" />
      <path d="M8 4.5v3M3.25 11.5V9.5H12.75V11.5" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="2" />
      <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.05 3.05l1.06 1.06M11.89 11.89l1.06 1.06M3.05 12.95l1.06-1.06M11.89 4.11l1.06-1.06" />
    </svg>
  );
}
