"use client";

import { ReactNode } from "react";
import KaziSidebar from "./KaziSidebar";
import KaziHeader from "./KaziHeader";
import useSidebar from "@/shared/hooks/useSidebar";
import { PageHeaderProvider } from "@/shared/contexts/PageHeaderContext";
import { ThemeProvider } from "@/shared/contexts/ThemeContext";

export default function AppShell({ children }: { children: ReactNode }) {
  const { isSidebarOpen, toggleSidebar } = useSidebar();

  return (
    <ThemeProvider>
      <PageHeaderProvider>
        <div className="flex h-screen flex-col overflow-hidden bg-[var(--canvas)]">
          <div className="flex min-h-0 flex-1">
            <KaziSidebar isOpen={!!isSidebarOpen} toggleSidebar={toggleSidebar} />
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <KaziHeader isSidebarOpen={!!isSidebarOpen} toggleSidebar={toggleSidebar} />
              <main className="flex-1 overflow-y-auto p-6 md:p-8 transition-all duration-300">
                {children}
              </main>
            </div>
          </div>
        </div>
      </PageHeaderProvider>
    </ThemeProvider>
  );
}
