"use client";

import { ReactNode } from "react";
import KaziSidebar from "./KaziSidebar";
import KaziHeader from "./KaziHeader";
import AppFooter from "./AppFooter";
import useSidebar from "@/shared/hooks/useSidebar";
import { PageHeaderProvider } from "@/shared/contexts/PageHeaderContext";
import { ThemeProvider } from "@/shared/contexts/ThemeContext";
import { CommandPaletteProvider } from "@/shared/contexts/CommandPaletteContext";
import { NotificationsProvider } from "@/shared/contexts/NotificationsContext";
import CommandPalette from "./CommandPalette";

export default function AppShell({ children }: { children: ReactNode }) {
  const { isSidebarOpen, toggleSidebar } = useSidebar();

  return (
    <ThemeProvider>
      <CommandPaletteProvider>
      <NotificationsProvider>
      <PageHeaderProvider>
        <div className="fixed inset-0 flex flex-col overflow-hidden bg-[var(--canvas)] p-1 md:p-4">
          <div className="flex min-h-0 flex-1 gap-1">
            <KaziSidebar isOpen={!!isSidebarOpen} toggleSidebar={toggleSidebar} />
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <KaziHeader isSidebarOpen={!!isSidebarOpen} toggleSidebar={toggleSidebar} />
              <main className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain transition-all duration-300">
                <div className="p-6 md:p-8">
                  {children}
                </div>
                <AppFooter />
              </main>
            </div>
          </div>
        </div>
        <CommandPalette />
      </PageHeaderProvider>
      </NotificationsProvider>
      </CommandPaletteProvider>
    </ThemeProvider>
  );
}
