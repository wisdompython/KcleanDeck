import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";

import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-jakarta" });

export const metadata: Metadata = {
  title: {
    default: "Kleandeck — Commercial cleaning in Lagos",
    template: "%s · Kleandeck",
  },
  description:
    "Commercial cleaning for offices, shortlets, real estate and interior decor projects in Lagos. See your price upfront and pay securely online.",
};

// Public site chrome lives in app/(site)/layout.tsx; the team admin has its own in app/admin.
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-NG" className={`${inter.variable} ${jakarta.variable}`}>
      <body>{children}</body>
    </html>
  );
}
