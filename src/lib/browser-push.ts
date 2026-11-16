/** Shared browser push helpers for the client. Server-side push lives in web-push.ts. */

export type PushSupport =
  | "unsupported"
  | "ios-needs-home-screen"
  | "blocked"
  | "on"
  | "off";

/** Converts the VAPID public key from base64url to the bytes the browser expects. */
export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalised = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalised);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export function isIosDevice() {
  return (
    typeof navigator !== "undefined" &&
    /iPad|iPhone|iPod/.test(navigator.userAgent)
  );
}

function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** Works out what this device can do right now. Safe to call in the browser only. */
export async function getPushSupport(publicKey?: string): Promise<PushSupport> {
  if (
    !publicKey ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  )
    return isIosDevice() && !isStandalone()
      ? "ios-needs-home-screen"
      : "unsupported";
  if (Notification.permission === "denied") return "blocked";
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  return subscription && Notification.permission === "granted" ? "on" : "off";
}

/**
 * Asks for permission and subscribes this device. Must be called from a click
 * handler, because Safari and Firefox ignore permission prompts without a gesture.
 * Throws with a readable message when the user declines or saving fails.
 */
export async function subscribeThisDevice(publicKey: string) {
  const permission = await Notification.requestPermission();
  if (permission !== "granted")
    throw new Error("Browser notifications were not allowed.");
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
}
