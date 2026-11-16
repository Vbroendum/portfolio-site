import type { Metadata } from "next";
import { JetBrains_Mono, Newsreader } from "next/font/google";

import "./globals.css";
import { requestLocale } from "@/lib/i18n/server";

/**
 * Two families, split by role: a serif for words a human wrote, a mono for
 * anything the machine owns (paths, tech, dates, code).
 */
const newsreader = Newsreader({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-newsreader",
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains",
  weight: ["400", "500"],
});

/**
 * Only what holds for every route, the CMS included. The site's titles,
 * descriptions and feed links are per locale, so they live in
 * app/[lang]/layout.tsx.
 */
export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
  title: "Portfolio",
};

/**
 * The root layout sits above [lang], so it learns the locale from the header
 * proxy.ts sets. Routes outside the public site (the CMS) get the default.
 */
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const lang = await requestLocale();
  return (
    <html lang={lang} className={`${newsreader.variable} ${jetbrains.variable}`}>
      <body className="min-h-dvh bg-ink text-fg">{children}</body>
    </html>
  );
}
