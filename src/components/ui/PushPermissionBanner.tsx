"use client";

import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import GlassPanel from "@/components/layout/GlassPanel";
import { useTheme } from "@/shared/contexts/ThemeContext";
import {
  getPushSupport,
  subscribeThisDevice,
} from "@/lib/browser-push";

const DISMISS_KEY = "kazi-push-banner-dismissed";

function readDismissed() {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function writeDismissed() {
  try {
    window.localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    // Storage can be blocked; the banner will simply reappear next visit.
  }
}

/**
 * Soft prompt for browser notifications. It only explains the value; the browser's
 * permission dialog opens after the user clicks "Turn on", which browsers require.
 */
export default function PushPermissionBanner() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const { resolvedMode: mode } = useTheme();

  useEffect(() => {
    let cancelled = false;
    if (readDismissed()) return;
    getPushSupport(publicKey)
      .then((support) => {
        if (!cancelled && support === "off") setVisible(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [publicKey]);

  if (!visible || !publicKey) return null;

  function dismiss() {
    writeDismissed();
    setVisible(false);
  }

  async function turnOn() {
    setBusy(true);
    try {
      await subscribeThisDevice(publicKey as string);
      toast.success("Browser notifications turned on for this device");
      setVisible(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not turn on browser notifications",
      );
      // A decline is a decision, so do not nag again on this device.
      writeDismissed();
      setVisible(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="region"
      aria-label="Browser notifications"
      className="fixed bottom-4 right-3 z-[9999] w-[calc(100%-1.5rem)] max-w-sm sm:right-6 sm:w-full"
    >
      <GlassPanel
        mode={mode}
        className="w-full overflow-hidden rounded-2xl bg-[var(--surface)]/80 shadow-2xl"
        contentClassName="p-4"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white shadow-sm">
            <Icon icon="solar:bell-bing-broken" className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[var(--text-hi)]">
              Turn on notifications
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-[var(--text-lo)]">
              Get alerted on this device when something needs you.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={turnOn}
                disabled={busy}
                className="flex-1 rounded-lg bg-brand-500 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-brand-600 active:scale-95 disabled:cursor-wait disabled:opacity-60"
              >
                {busy ? "Turning on…" : "Turn on"}
              </button>
              <button
                type="button"
                onClick={dismiss}
                disabled={busy}
                className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-xs font-medium text-[var(--text-lo)] transition-all hover:text-[var(--text-hi)] active:scale-95 disabled:opacity-50"
              >
                Later
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={dismiss}
            disabled={busy}
            aria-label="Dismiss"
            className="-mr-1 -mt-1 rounded-full p-1 text-[var(--text-lo)] transition-colors hover:text-[var(--text-hi)] disabled:opacity-50"
          >
            <Icon icon="solar:close-circle-broken" className="h-5 w-5" />
          </button>
        </div>
      </GlassPanel>
    </div>
  );
}
