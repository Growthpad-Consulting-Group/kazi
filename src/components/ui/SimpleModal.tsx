"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (open) document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    const previousOverflow = document.body.style.overflow;
    const previousPadding = document.body.style.paddingRight;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;
    return () => { document.body.style.overflow = previousOverflow; document.body.style.paddingRight = previousPadding; };
  }, [open]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
            className="fixed inset-0"
            style={{ filter: "url(#glass-distortion)", backdropFilter: "blur(4px) saturate(140%)" }}
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/25"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={`relative w-full ${maxWidth} max-h-[90vh]`}
            onClick={(event) => event.stopPropagation()}
          >
            <GlassPanel mode={mode} className="rounded-2xl overflow-hidden bg-[var(--surface)]">
              {/* Header */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--border)] bg-gradient-to-r from-[#f05d23]/10 to-transparent">
                {icon && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#f05d23]/15">
                    <Icon icon={icon} className="h-4 w-4 text-[#f05d23]" />
                  </div>
                )}
                <h2 className="flex-1 text-md font-semibold text-[var(--text-hi)]">{title}</h2>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-[var(--text-lo)] hover:text-[var(--text-hi)] hover:bg-[var(--surface-2)] transition-all"
                >
                  <Icon icon="solar:close-circle-broken" className="h-4 w-4" />
                </button>
              </div>
              {/* Body */}
              <div className="max-h-[calc(60vh-65px)] overflow-y-auto px-5 py-4">{children}</div>
            </GlassPanel>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
