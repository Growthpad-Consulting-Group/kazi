import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { Toaster } from "react-hot-toast";
import ServiceWorkerRegister from "@/components/providers/ServiceWorkerRegister";

const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://kazi.growthpad.africa";

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  display: "swap",
});

const cloverDisplay = localFont({
  src: [
    {
      path: "../../public/assets/fonts/CloverDisplay-SemiBold.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "../../public/assets/fonts/CloverDisplay-Bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-clover-display",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Kazi | Growthpad",
    template: "%s | Kazi",
  },
  description: "Growthpad's recruitment and staff-performance workspace.",
  applicationName: "Kazi",
  manifest: "/manifest.webmanifest",
  alternates: { canonical: "/" },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.png", sizes: "376x376", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Kazi",
  },
  openGraph: {
    title: "Kazi | Growthpad",
    description: "Growthpad's recruitment and staff-performance workspace.",
    siteName: "Kazi",
    type: "website",
    locale: "en_KE",
  },
  twitter: {
    card: "summary",
    title: "Kazi | Growthpad",
    description: "Growthpad's recruitment and staff-performance workspace.",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#f05d23",
  colorScheme: "light dark",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${figtree.variable} ${cloverDisplay.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <SessionProvider>{children}</SessionProvider>
        <ServiceWorkerRegister />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "rgb(255 255 255 / 0.90)",
              borderRadius: "16px",
            },
          }}
        />
      </body>
    </html>
  );
}
