import type { MetadataRoute } from "next";

/** Kazi is an authenticated workspace and should never be indexed. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: "/",
    },
  };
}
