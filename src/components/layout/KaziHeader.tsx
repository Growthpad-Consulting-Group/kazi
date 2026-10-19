"use client";

import { Icon } from "@iconify/react";
import GlassPanel from "./GlassPanel";
import { useTheme } from "@/shared/contexts/ThemeContext";
import { usePageHeaderValue } from "@/shared/contexts/PageHeaderContext";
import HeaderThemeDropdown from "./HeaderThemeDropdown";
import HeaderProfileDropdown from "./HeaderProfileDropdown";

export default function KaziHeader({
  isSidebarOpen,
  toggleSidebar,
}: {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
}) {
  const { resolvedMode: mode } = useTheme();
  const pageHeader = usePageHeaderValue();

  return (
    <header className="sticky top-0 z-40 flex items-stretch gap-3 animate-header-slide-in m-1 md:mx-8 md:mt-4 transition-all duration-300">

      {/* Left — sidebar toggle + page title + actions */}
      <GlassPanel mode={mode} className="flex-1 min-w-0 rounded-2xl">
        <div className="flex h-full items-center gap-2 px-2 py-1.5">
          <button
            onClick={toggleSidebar}
            className="group p-2 rounded-full text-gray-500 dark:text-gray-100 shrink-0 transition-all active:scale-95 hover:bg-black/5 dark:hover:bg-white/10"
            title={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            <Icon
              icon={isSidebarOpen ? "solar:double-alt-arrow-left-broken" : "solar:double-alt-arrow-right-broken"}
              className="w-5 h-5 transition-transform duration-300 group-hover:scale-110"
            />
          </button>

          {pageHeader && (
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="h-4 w-px bg-[var(--border)] shrink-0" />

              {pageHeader.icon && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#f05d23] to-[#d94f1e] shadow-sm">
                  <Icon icon={pageHeader.icon} className="h-3.5 w-3.5 text-white" />
                </div>
              )}

              <div className="min-w-0">
                <h1 className="text-sm font-semibold leading-tight text-[var(--text-hi)] truncate">{pageHeader.title}</h1>
                {pageHeader.description && (
                  <p className="hidden sm:block text-xs text-[var(--text-lo)] truncate">{pageHeader.description}</p>
                )}
              </div>

              {(pageHeader.content || pageHeader.actions?.length) && (
                <div className="ml-auto flex items-center gap-2 shrink-0">
                  {pageHeader.content}
                  {pageHeader.actions?.map((action, i) => (
                    <button
                      key={i}
                      onClick={action.onClick}
                      disabled={action.disabled}
                      title={action.title}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                        action.variant === "primary"
                          ? "bg-[#f05d23] text-white hover:bg-[#d94f1e] shadow-sm"
                          : mode === "dark"
                            ? "text-gray-300 hover:bg-white/10"
                            : "text-gray-600 hover:bg-black/5"
                      }`}
                    >
                      {action.icon && <Icon icon={action.icon} className="h-3.5 w-3.5" />}
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </GlassPanel>

      {/* Right — search, notifications, theme, profile */}
      <GlassPanel mode={mode} className="shrink-0 rounded-2xl">
        <div className="flex h-full items-center gap-0.5 px-2 py-1.5">
          <button
            title="Search (⌘K)"
            className="group flex items-center justify-center p-2 rounded-full transition-all active:scale-95 hover:bg-black/5 dark:hover:bg-white/10 text-gray-600 dark:text-gray-200"
          >
            <Icon icon="solar:magnifer-broken" className="h-5 w-5 transition-transform duration-300 group-hover:scale-110" />
          </button>

          <button
            title="Notifications"
            className="group relative flex items-center justify-center p-2 rounded-full transition-all active:scale-95 hover:bg-black/5 dark:hover:bg-white/10 text-gray-600 dark:text-gray-200"
          >
            <Icon icon="solar:bell-bing-broken" className="h-5 w-5 transition-transform duration-300 group-hover:scale-110" />
          </button>

          <div className="mx-0.5 h-5 w-px bg-[var(--border)] hidden md:block" />

          <div className="hidden md:block">
            <HeaderThemeDropdown />
          </div>
          <HeaderProfileDropdown />
        </div>
      </GlassPanel>
    </header>
  );
}
