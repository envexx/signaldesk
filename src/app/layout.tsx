import type { Metadata } from "next";
import { Manrope, Newsreader } from "next/font/google";

import { ApiStoreProvider } from "@/components/providers/api-store";

import "@xyflow/react/dist/style.css";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "SignalDesk - Lead Intelligence",
    template: "%s | SignalDesk",
  },
  description:
    "Evidence-backed B2B lead enrichment and human-approved inbound nurturing.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${newsreader.variable}`}
      data-scroll-behavior="smooth"
    >
      <body>
        <ApiStoreProvider>{children}</ApiStoreProvider>
      </body>
    </html>
  );
}
