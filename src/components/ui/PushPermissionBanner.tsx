"use client";

import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
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
      className="mb-4 flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
          <Icon icon="solar:bell-bing-broken" className="h-4 w-4" />
        </span>
        <p className="text-sm text-[var(--text-lo)]">
          <span className="font-semibold text-[var(--text-hi)]">
            Get notified on this device.
          </span>{" "}
          Know when something needs your attention, even when Kazi is closed.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={dismiss}
          disabled={busy}
          className="rounded-xl px-3 py-1.5 text-xs font-medium text-[var(--text-lo)] hover:bg-[var(--surface-2)] disabled:opacity-60"
        >
          Not now
        </button>
        <button
          type="button"
          onClick={turnOn}
          disabled={busy}
          className="rounded-xl bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-brand-600 disabled:cursor-wait disabled:opacity-60"
        >
          {busy ? "Turning on…" : "Turn on"}
        </button>
      </div>
    </div>
  );
}
