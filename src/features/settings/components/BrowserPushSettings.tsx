"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";

type Status = "checking" | "unsupported" | "blocked" | "off" | "on";

/** Converts the VAPID public key from base64url to the bytes the browser expects. */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalised = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalised);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/** Opt-in control for browser push notifications on this device. */
export default function BrowserPushSettings() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const [status, setStatus] = useState<Status>("checking");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window) ||
        !publicKey
      ) {
        if (!cancelled) setStatus("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        if (!cancelled) setStatus("blocked");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (!cancelled)
        setStatus(
          subscription && Notification.permission === "granted" ? "on" : "off",
        );
    }
    check().catch(() => {
      if (!cancelled) setStatus("unsupported");
    });
    return () => {
      cancelled = true;
    };
  }, [publicKey]);

  async function enable() {
    if (!publicKey) return;
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "blocked" : "off");
        toast.error("Browser notifications were not allowed.");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const json = subscription.toJSON();
      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
      if (!response.ok) {
        await subscription.unsubscribe();
        throw new Error("Could not save this device.");
      }
      setStatus("on");
      toast.success("Browser notifications turned on for this device");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not turn on browser notifications",
      );
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const response = await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        if (!response.ok) throw new Error("Could not turn off this device.");
        await subscription.unsubscribe();
      }
      setStatus("off");
      toast.success("Browser notifications turned off for this device");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not turn off browser notifications",
      );
    } finally {
      setBusy(false);
    }
  }

  const isIos =
    typeof navigator !== "undefined" &&
    /iPad|iPhone|iPod/.test(navigator.userAgent);

  let message = "";
  if (status === "unsupported") {
    message = isIos
      ? "On iPhone or iPad, add Kazi to your Home Screen, then open it from there to turn these on."
      : "This browser does not support push notifications for Kazi.";
  } else if (status === "blocked") {
    message =
      "Notifications are blocked for Kazi. Allow them in your browser's site settings, then reload this page.";
  } else if (status === "on") {
    message =
      "You will get a browser notification on this device when something needs your attention.";
  } else if (status === "off") {
    message =
      "Get notified on this device even when Kazi is closed. This applies to this browser only.";
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm leading-6 text-[var(--text-lo)]">
        {status === "checking" ? "Checking this browser…" : message}
      </p>
      {(status === "on" || status === "off") && (
        <button
          type="button"
          disabled={busy}
          onClick={status === "on" ? disable : enable}
          className={`shrink-0 rounded-xl px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-wait disabled:opacity-60 ${
            status === "on"
              ? "bg-[var(--surface-2)] text-[var(--text-hi)] hover:bg-[var(--surface)]"
              : "bg-brand-500 text-white hover:bg-brand-600"
          }`}
        >
          {status === "on" ? "Turn off on this device" : "Turn on"}
        </button>
      )}
    </div>
  );
}
