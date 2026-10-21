/**
 * Builds a tracked-click URL for a signature template — clicking it hits
 * /api/templates/[id]/click, which logs the click (template, staff, label) then redirects to
 * `destination`. `{{id}}` resolves per-recipient at send time via renderSignatureHtml (see
 * mergeTags.ts) — same mechanism campaign banners already use for their own click tracking.
 */
// Deliberately hardcoded, ignoring both NEXT_PUBLIC_APP_URL and window.location.origin — this
// URL gets baked permanently into stored template HTML the moment it's inserted, and that
// content ships to production regardless of which environment authored it. NEXT_PUBLIC_APP_URL
// is *correctly* localhost during local dev for other purposes (redirects, etc.), but using it
// here means editing locally silently bakes a dead localhost link into content real recipients
// will click. This one link always needs the real deployed URL, never "wherever this happens
// to be running right now". Exported so any other baked-in-at-save-time asset URL (self-hosted
// icon images, etc.) uses the same one instead of reinventing this with process.env — see
// blockSerializer.ts's SOCIAL_ICON/CONTACT_ICON, which used to get this wrong.
export const PRODUCTION_APP_URL = "https://signoff.growthpad.co.ke";

export function buildTrackedLinkHref(templateId: string, destination: string, label: string): string {
  const base = PRODUCTION_APP_URL;
  const params = `to=${encodeURIComponent(destination)}&staff={{id}}${label.trim() ? `&label=${encodeURIComponent(label.trim())}` : ""}`;
  return `${base}/api/templates/${templateId}/click?${params}`;
}

const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/**
 * Throws if `url` isn't a valid absolute URL once normalized; returns the normalized string
 * otherwise. Bare domains/paths ("growthpad.co.ke") get "https://" prepended automatically —
 * every Link URL field in the app (image/button blocks, the RTE's tracked-link prompt) shares
 * this, so nobody has to remember to type the scheme.
 */
export function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  const withScheme = HAS_SCHEME.test(trimmed) ? trimmed : `https://${trimmed}`;
  return new URL(withScheme).toString();
}

