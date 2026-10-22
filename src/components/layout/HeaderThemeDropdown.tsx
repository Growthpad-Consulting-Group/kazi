"use client";

import { useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@iconify/react";
import { useTheme } from "@/shared/contexts/ThemeContext";
import GlassPanel from "./GlassPanel";

const OPTIONS = [
  { value: "light",  icon: "solar:sun-2-broken",   label: "Light"  },
  { value: "system", icon: "solar:monitor-broken",  label: "System" },
  { value: "dark",   icon: "solar:moon-broken",     label: "Dark"   },
] as const;

export default function HeaderThemeDropdown() {
  const { mode, resolvedMode, setMode } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) setIsOpen(false);
    };
    if (isOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  const handleOpen = () => {
    if (buttonRef.current) setRect(buttonRef.current.getBoundingClientRect());
    setIsOpen((o) => !o);
  };

  return (
    <div className="relative shrink-0">
      <button
        ref={buttonRef}
        onClick={handleOpen}
        title={`Theme: ${mode}`}
        className="group p-2 rounded-full transition-all active:scale-95 hover:bg-black/5 dark:hover:bg-white/10"
      >
        <Icon
          icon={mode === "light" ? "solar:sun-2-broken" : mode === "dark" ? "solar:moon-broken" : "solar:monitor-broken"}
          className={`h-5 w-5 text-gray-700 dark:text-gray-100 transition-all duration-500 ${isOpen ? "rotate-12 scale-110" : "group-hover:scale-110"}`}
        />
      </button>

      {isOpen && rect && typeof document !== "undefined" &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{ position: "fixed", top: rect.bottom + 8, right: window.innerWidth - rect.right, zIndex: 9999 }}
          >
            <GlassPanel mode={resolvedMode} className="p-2 rounded-2xl">
              <div className="flex gap-1 rounded-xl border border-white/20 bg-white/10 p-1 dark:bg-white/5 backdrop-blur-sm">
                {OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => { setMode(opt.value); setTimeout(() => setIsOpen(false), 150); }}
                    title={opt.label}
                    className={`flex h-10 w-10 items-center justify-center rounded-lg transition-all ${
                      mode === opt.value
                        ? "bg-white/40 dark:bg-white/20 text-brand-500 shadow-md ring-1 ring-inset ring-white/30"
                        : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-white/20 dark:hover:bg-white/10"
                    }`}
                  >
                    <Icon icon={opt.icon} className="h-5 w-5" />
                  </button>
                ))}
              </div>
            </GlassPanel>
          </div>,
          document.body
        )}
    </div>
  );
}
