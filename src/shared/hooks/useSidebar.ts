"use client";

import { useState, useEffect } from "react";

export default function useSidebar() {
  const [isSidebarOpen, setSidebarOpen] = useState<boolean | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("kaziSidebarOpen");
    setSidebarOpen(saved !== null ? JSON.parse(saved) : window.innerWidth > 768);
  }, []);

  useEffect(() => {
    if (isSidebarOpen !== null) {
      localStorage.setItem("kaziSidebarOpen", JSON.stringify(isSidebarOpen));
    }
  }, [isSidebarOpen]);

  return {
    isSidebarOpen,
    toggleSidebar: () => setSidebarOpen((p) => !p),
  };
}
