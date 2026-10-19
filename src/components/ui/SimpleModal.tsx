"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@iconify/react";
import GlassPanel from "@/components/layout/GlassPanel";
import { useTheme } from "@/shared/contexts/ThemeContext";

interface SimpleModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  icon?: string;
  children: React.ReactNode;
  maxWidth?: string;
}

export function SimpleModal({ open, onClose, title, icon, children, maxWidth = "max-w-lg" }: SimpleModalProps) {
  const { resolvedMode: mode } = useTheme();
  const [mounted, setMounted] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (open) document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          ref={overlayRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onMouseDown={(e) => { if (e.target === overlayRef.current) onClose(); }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={`w-full ${maxWidth}`}
          >
            <GlassPanel mode={mode} className="rounded-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--border)] bg-gradient-to-r from-[#f05d23]/10 to-transparent">
                {icon && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#f05d23]/15">
                    <Icon icon={icon} className="h-4 w-4 text-[#f05d23]" />
                  </div>
                )}
                <h2 className="flex-1 text-sm font-semibold text-[var(--text-hi)]">{title}</h2>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-[var(--text-lo)] hover:text-[var(--text-hi)] hover:bg-[var(--surface-2)] transition-all"
                >
                  <Icon icon="solar:close-circle-broken" className="h-4 w-4" />
                </button>
              </div>
              {/* Body */}
              <div className="px-5 py-4">{children}</div>
            </GlassPanel>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
