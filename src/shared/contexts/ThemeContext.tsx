"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type ThemeMode = "light" | "dark" | "system";
type ResolvedMode = "light" | "dark";

interface ThemeContextValue {
  mode: ThemeMode;
  resolvedMode: ResolvedMode;
  setMode: (m: ThemeMode) => void;
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: "system",
  resolvedMode: "light",
  setMode: () => {},
  toggleMode: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [resolvedMode, setResolvedMode] = useState<ResolvedMode>("light");

  useEffect(() => {
    const saved = localStorage.getItem("kaziTheme") as ThemeMode | null;
    if (saved) setModeState(saved);
  }, []);

  useEffect(() => {
    const apply = (m: ThemeMode) => {
      const isDark =
        m === "dark" || (m === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      document.documentElement.classList.toggle("dark", isDark);
      setResolvedMode(isDark ? "dark" : "light");
    };
    apply(mode);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => { if (mode === "system") apply("system"); };
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, [mode]);

  const setMode = (m: ThemeMode) => {
    setModeState(m);
    localStorage.setItem("kaziTheme", m);
  };

  const toggleMode = () => {
    const next: ThemeMode = mode === "light" ? "dark" : mode === "dark" ? "system" : "light";
    setMode(next);
  };

  return (
    <ThemeContext.Provider value={{ mode, resolvedMode, setMode, toggleMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
