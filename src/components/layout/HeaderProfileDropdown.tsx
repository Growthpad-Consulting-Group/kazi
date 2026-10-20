"use client";

import { useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@iconify/react";
import { signOut, useSession } from "next-auth/react";
import GlassPanel from "./GlassPanel";
import { useTheme } from "@/shared/contexts/ThemeContext";

export default function HeaderProfileDropdown() {
  const { resolvedMode: mode } = useTheme();
  const { data: session } = useSession();
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

  const initials = session?.user?.name
    ?.split(" ").map((n) => n[0]).slice(0, 2).join("") ?? "U";

  return (
    <div className="relative flex items-center">
      <button
        ref={buttonRef}
        onClick={handleOpen}
        title="Profile"
        className="group flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#f05d23]/30 to-violet-500/20 text-xs font-bold text-[var(--text-hi)] ring-2 ring-[var(--border)] transition-all active:scale-95 hover:ring-[#f05d23]/40"
      >
        {initials}
      </button>

      {isOpen && rect && typeof document !== "undefined" &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{ position: "fixed", top: rect.bottom + 8, right: window.innerWidth - rect.right, zIndex: 9999, width: 280 }}
          >
            <GlassPanel mode={mode} className="rounded-2xl overflow-hidden">
              {/* User info */}
              <div className="flex items-center gap-3 p-4 border-b border-[var(--border)]">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#f05d23]/30 to-violet-500/20 text-sm font-bold text-[var(--text-hi)]">
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="text-md font-semibold text-[var(--text-hi)] truncate">{session?.user?.name ?? "—"}</p>
                  <p className="text-xs text-[var(--text-lo)] truncate">{session?.user?.email ?? ""}</p>
                  <p className="text-[10px] text-[#f05d23] capitalize font-medium mt-0.5">{session?.user?.role?.replace("_", " ") ?? ""}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="p-2">
                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-red-500 transition-all hover:bg-red-500/10 active:scale-95"
                >
                  <Icon icon="solar:logout-broken" className="h-4 w-4" />
                  Sign Out
                </button>
              </div>
            </GlassPanel>
          </div>,
          document.body
        )}
    </div>
  );
}
