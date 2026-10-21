"use client";

import { useState, useRef, useEffect } from "react";
import { Icon } from "@iconify/react";
import GlassPanel from "./GlassPanel";
import { useTheme } from "@/shared/contexts/ThemeContext";
import { usePageHeaderValue } from "@/shared/contexts/PageHeaderContext";
import { useCommandPalette } from "@/shared/contexts/CommandPaletteContext";
import { useNotifications } from "@/shared/contexts/NotificationsContext";
import HeaderThemeDropdown from "./HeaderThemeDropdown";
import HeaderProfileDropdown from "./HeaderProfileDropdown";
import Notifications from "@/components/ui/Notifications";
import TooltipIconButton from "@/components/ui/TooltipIconButton";

export default function KaziHeader({
  isSidebarOpen,
  toggleSidebar,
}: {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
}) {
  const { resolvedMode: mode } = useTheme();
  const pageHeader = usePageHeaderValue();
  const { open: openCommandPalette } = useCommandPalette();
  const { notifications, isLoading, markNotificationAsRead, clearAllNotifications } = useNotifications();
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notificationsRef.current && !notificationsRef.current.contains(e.target as Node)) {
        setIsNotificationsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-40 mb-1 flex items-stretch gap-3 bg-transparent animate-header-slide-in md:mx-8 md:mb-4 transition-all duration-300">

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

          {/* Search / Command Palette */}
          <TooltipIconButton
            icon="solar:magnifer-broken"
            label="Search (⌘K)"
            onClick={openCommandPalette}
            mode={mode}
            className="text-gray-600 dark:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10 transition-all active:scale-95"
            iconClassName="h-5 w-5"
            position="bottom"
          />

          {/* Notifications */}
          <div className="relative" ref={notificationsRef}>
            <TooltipIconButton
              label="Notifications"
              onClick={() => setIsNotificationsOpen((o) => !o)}
              mode={mode}
              className="text-gray-600 dark:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10 transition-all active:scale-95"
              iconClassName="h-5 w-5"
              position="bottom"
            >
              <div className="relative">
                <Icon icon="solar:bell-bing-broken" className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full h-4 w-4 flex items-center justify-center font-medium border border-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </div>
            </TooltipIconButton>
            {isNotificationsOpen && (
              <div className="absolute top-12 right-0 w-96 z-50" onClick={(e) => e.stopPropagation()}>
                <GlassPanel mode={mode} className={`rounded-2xl ${mode === "dark" ? "bg-gray-900/90 text-white" : "bg-white/90 text-[var(--text-hi)]"}`}>
                  <Notifications
                    notifications={notifications}
                    mode={mode}
                    isLoading={isLoading}
                    onMarkAsRead={markNotificationAsRead}
                    onClearAll={clearAllNotifications}
                    onNavigate={() => setIsNotificationsOpen(false)}
                  />
                </GlassPanel>
              </div>
            )}
          </div>

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
