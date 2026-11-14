const DEFAULT_CAREERS_SITE_URL =
  process.env.NEXT_PUBLIC_CAREERS_SITE_URL ?? "https://growthpad.africa";

const COMPANY_CAREERS_URLS: Record<string, string | undefined> = {
  growthpad: DEFAULT_CAREERS_SITE_URL,
  ccsa:
    process.env.NEXT_PUBLIC_CCSA_CAREERS_SITE_URL ??
    "https://callcentersolutionsafrica.com",
};

function careersSiteUrl(companySlug = "growthpad") {
  return (
    COMPANY_CAREERS_URLS[companySlug.toLowerCase()] ?? DEFAULT_CAREERS_SITE_URL
  ).replace(/\/$/, "");
}

export function publicJobUrl(slug: string, companySlug?: string) {
  return `${careersSiteUrl(companySlug)}/careers/${encodeURIComponent(slug)}`;
}

export function careersPageUrl(companySlug?: string) {
  return `${careersSiteUrl(companySlug)}/careers`;
}
