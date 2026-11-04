import type { Metadata } from "next";
import { Instrument_Sans, Inter } from "next/font/google";

import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const instrument = Instrument_Sans({ subsets: ["latin"], variable: "--font-instrument" });

export const metadata: Metadata = {
  title: {
    default: "Kleandeck — Commercial cleaning and facility support",
    template: "%s · Kleandeck",
  },
  description:
    "Reliable commercial cleaning, deep cleaning, post-construction cleaning and facility support for offices, gyms, interior projects and growing businesses.",
};

// Public site chrome lives in app/(site)/layout.tsx; the team admin has its own in app/admin.
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-NG" className={`${inter.variable} ${instrument.variable}`}>
      <body>{children}</body>
    </html>
  );
}
