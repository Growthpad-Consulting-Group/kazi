const KAZI_TIMER_EXTENSION_ID = "dffnikiadlobakbogmmfjkobjieehcbc";

type ExtensionRuntime = {
  sendMessage: (
    extensionId: string,
    message: unknown,
    callback?: () => void,
  ) => void;
  lastError?: unknown;
};

/**
 * Lets an installed Kazi Timer immediately reconcile after Kazi changes the
 * shared timer. Browsers deliberately do not let a web page open an extension
 * popup, so the extension updates its badge and popup state instead.
 */
export function notifyKaziTimerExtension(timer: SharedActiveTimer | null) {
  if (typeof window === "undefined") return;
  const runtime = (
    window as typeof window & {
      chrome?: { runtime?: ExtensionRuntime };
    }
  ).chrome?.runtime;
  if (!runtime?.sendMessage) return;

  try {
    runtime.sendMessage(
      KAZI_TIMER_EXTENSION_ID,
      { type: "kazi-timer-state-changed", timer },
      // Accessing lastError acknowledges an unavailable or older extension.
      // Neither case should affect saving a timer in Kazi.
      () => void runtime.lastError,
    );
  } catch {
    // The extension is optional, and Chrome throws if it is not installed.
  }
}
import type { SharedActiveTimer } from "@/features/pulse/daily-log/shared-timer";

