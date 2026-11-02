export function normalizeApplicationUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const input = value.trim();
    const url = new URL(
      /^https?:\/\//i.test(input) ? input : `https://${input}`,
    );
    if (!["https:", "http:"].includes(url.protocol)) return null;
    url.pathname = url.pathname
      .split("/")
      .map((part) => encodeURIComponent(decodeURIComponent(part).trim()))
      .join("/");
    return url.toString();
  } catch {
    return null;
  }
}

export function normalizeLinkedInProfile(value: unknown): string | null {
  const url = normalizeApplicationUrl(value);
  if (!url) return null;
  const parsed = new URL(url);
  if (
    (parsed.hostname !== "linkedin.com" &&
      !parsed.hostname.endsWith(".linkedin.com")) ||
    !parsed.pathname.startsWith("/in/") ||
    parsed.pathname === "/in/"
  )
    return null;
  return url;
}
