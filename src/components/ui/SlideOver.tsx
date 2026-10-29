"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@iconify/react";

interface SlideOverProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: string;
  leading?: ReactNode;
  children: ReactNode;
}

export function SlideOver({
  open,
  onClose,
  title,
  subtitle,
  icon,
  leading,
  children,
}: SlideOverProps) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    setMounted(true);
    let inner = 0;
    const outer = window.requestAnimationFrame(() => {
      inner = window.requestAnimationFrame(() => setVisible(true));
    });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      window.cancelAnimationFrame(outer);
      window.cancelAnimationFrame(inner);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) return;
    setVisible(false);
    const timeout = window.setTimeout(() => setMounted(false), 300);
    return () => window.clearTimeout(timeout);
  }, [open]);

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[9998]">
      <div
        className={`absolute inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-label={title}
        className={`absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-[var(--border)] bg-[var(--surface)] shadow-2xl transition-transform duration-300 ease-out ${visible ? "translate-x-0" : "translate-x-full"}`}
      >
        <header className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
          <div className="flex min-w-0 items-start gap-3">
            {leading ??
              (icon && (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
                  <Icon icon={icon} className="h-4 w-4" />
                </span>
              ))}
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-[var(--text-hi)]">
                {title}
              </h2>
              {subtitle && (
                <p className="mt-0.5 truncate text-[11px] text-[var(--text-lo)]">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-[var(--text-lo)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text-hi)]"
          >
            <Icon icon="solar:close-circle-broken" className="h-5 w-5" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
      </aside>
    </div>,
    document.body,
  );
}
