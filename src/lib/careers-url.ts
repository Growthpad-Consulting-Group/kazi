const CAREERS_SITE_URL = process.env.NEXT_PUBLIC_CAREERS_SITE_URL ?? "https://growthpad.africa";

export function publicJobUrl(slug: string) {
  return `${CAREERS_SITE_URL.replace(/\/$/, "")}/careers/${encodeURIComponent(slug)}`;
}
