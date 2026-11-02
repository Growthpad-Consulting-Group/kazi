import type { MetadataRoute } from "next";

/**
 * Crawling is allowed so link unfurlers (Facebook, Slack, WhatsApp) can read
 * the Open Graph tags. Kazi is kept out of search results by the `noindex`
 * robots meta tag set in the root layout and by its login wall.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
  };
}
