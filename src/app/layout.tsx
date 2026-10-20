import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { Toaster } from "react-hot-toast";

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  display: "swap",
});

const cloverDisplay = localFont({
  src: [
    { path: "../../public/assets/fonts/CloverDisplay-SemiBold.woff2", weight: "600", style: "normal" },
    { path: "../../public/assets/fonts/CloverDisplay-Bold.woff2",     weight: "700", style: "normal" },
  ],
  variable: "--font-clover-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Kazi — Growthpad",
  description: "AI-assisted recruitment and performance management",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${figtree.variable} ${cloverDisplay.variable} h-full antialiased`}>
      <body className="min-h-full">
        <SessionProvider>{children}</SessionProvider>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
