"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@iconify/react";
import { cn } from "@/shared/lib/cn";

export interface SettingsNavItem {
  id: string;
  label: string;
  icon: string;
  href: string;
}

export interface SettingsNavGroup {
  title: string;
  items: SettingsNavItem[];
}

/** Section nav shown in the settings sidebar — grouped like bflowpos. */
export const SETTINGS_NAV: SettingsNavGroup[] = [
  {
    title: "Personal",
    items: [
      { id: "profile",  label: "Profile",  icon: "solar:user-broken",           href: "/settings/profile" },
      { id: "security", label: "Security", icon: "solar:shield-keyhole-broken", href: "/settings/security" },
    ],
  },
  {
    title: "Organization",
    items: [
      { id: "overview",    label: "Company & System", icon: "solar:shop-2-broken",                 href: "/settings/overview" },
      { id: "departments", label: "Departments",     icon: "solar:users-group-two-rounded-broken", href: "/settings/departments" },
    ],
  },
  {
    title: "Data",
    items: [
      { id: "exports",        label: "Data Exports",   icon: "solar:download-minimalistic-broken",   href: "/settings/exports" },
      { id: "data-retention", label: "Data Retention", icon: "solar:trash-bin-minimalistic-broken", href: "/settings/data-retention" },
    ],
  },
];

const isActive = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

export default function SettingsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isExpanded, setIsExpanded] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Persist the collapsed state; read after mount to avoid SSR/client mismatch
  useEffect(() => {
    const saved = localStorage.getItem("kaziSettingsSidebarExpanded");
    if (saved !== null) setIsExpanded(saved === "true");
  }, []);

  const toggleExpanded = () => {
    setIsExpanded((prev) => {
      localStorage.setItem("kaziSettingsSidebarExpanded", String(!prev));
      return !prev;
    });
  };

  const collapsed = !isExpanded;

  const renderItems = (groups: SettingsNavGroup[]) =>
    groups.map((group, gi) => (
      <div key={group.title}>
        {gi > 0 && <div className="mx-4 mb-4 border-t border-[var(--border)]" />}
        <p className="mb-3 px-4 text-[11px] font-bold uppercase tracking-widest text-[var(--text-lo)]">
          {group.title}
        </p>
        <div className="space-y-1">
          {group.items.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.id}
                href={item.href}
                title={item.label}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200",
                  active
                    ? "bg-gradient-to-r from-[#f05d23] to-[#d94f1e] text-white shadow-lg shadow-[#f05d23]/20"
                    : "text-[var(--text-lo)] hover:bg-[var(--surface-2)] hover:text-[var(--text-hi)]"
                )}
              >
                <Icon icon={item.icon} className="h-5 w-5 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    ));

  const allItems = SETTINGS_NAV.flatMap((g) => g.items);


  return (
    <div className="relative flex w-full flex-col self-start">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:gap-6">

        {/* ── Desktop sidebar ── */}
        <aside
          className={cn(
            "sticky top-8 z-20 hidden h-fit max-h-[calc(100vh-200px)] shrink-0 overflow-y-auto overflow-x-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2 shadow-xl shadow-slate-200/50 hover:shadow-2xl backdrop-blur-xl dark:shadow-black/20 transition-shadow duration-200 md:block",
            collapsed ? "w-[72px] min-w-[72px] px-1.5 py-2" : "w-64"
          )}
        >
          {collapsed ? (
            <div className="flex flex-col items-stretch gap-1">
              <button
                type="button"
                onClick={toggleExpanded}
                title="Expand sidebar"
                className="flex items-center justify-center rounded-xl p-2 text-[var(--text-lo)] transition-colors hover:bg-[var(--surface-2)]"
              >
                <Icon icon="solar:double-alt-arrow-right-broken" className="h-6 w-6" />
              </button>
              <div className="mx-1 my-0.5 h-px bg-[var(--border)]" />
              {allItems.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  title={item.label}
                  className={cn(
                    "flex items-center justify-center rounded-xl p-2.5 transition-all duration-200",
                    isActive(pathname, item.href)
                      ? "bg-gradient-to-r from-[#f05d23] to-[#d94f1e] text-white shadow-lg shadow-[#f05d23]/20"
                      : "text-[var(--text-lo)] hover:bg-[var(--surface-2)]"
                  )}
                >
                  <Icon icon={item.icon} className="h-5 w-5 shrink-0" />
                </Link>
              ))}
            </div>
          ) : (
            <>
              <div className="mb-2 flex justify-end px-0.5">
                <button
                  type="button"
                  onClick={toggleExpanded}
                  title="Collapse sidebar"
                  className="rounded-lg p-1.5 text-[var(--text-lo)] transition-colors hover:bg-[var(--surface-2)]"
                >
                  <Icon icon="solar:double-alt-arrow-left-broken" className="h-6 w-6" />
                </button>
              </div>
              <div className="space-y-4">{renderItems(SETTINGS_NAV)}</div>
            </>
          )}
        </aside>

        {/* ── Mobile sidebar ── */}
        {mobileOpen && (
          <aside className="sticky top-8 z-30 w-full shrink-0 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2 shadow-xl shadow-slate-200/50 hover:shadow-2xl md:hidden transition-shadow duration-200">
            <div className="space-y-4">{renderItems(SETTINGS_NAV)}</div>
          </aside>
        )}

        {/* ── Content ── */}
        <div className="w-full min-w-0 flex-1 overflow-hidden">{children}</div>
      </div>

      {/* Mobile FAB toggle */}
      <button
        type="button"
        onClick={() => setMobileOpen((prev) => !prev)}
        aria-label={mobileOpen ? "Close settings navigation" : "Open settings navigation"}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-[#f05d23] to-[#d94f1e] text-white shadow-2xl transition-all hover:scale-110 active:scale-95 md:hidden"
      >
        <Icon
          icon={mobileOpen ? "solar:close-circle-broken" : "solar:hamburger-menu-broken"}
          className="h-6 w-6"
        />
      </button>
    </div>
  );
}
