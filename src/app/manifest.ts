import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kazi by Growthpad",
    short_name: "Kazi",
    description: "Growthpad's recruitment and staff-performance workspace.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#fffaf7",
    theme_color: "#f05d23",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
