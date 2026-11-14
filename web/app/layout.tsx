import type { Metadata } from "next";
import { JetBrains_Mono, Newsreader } from "next/font/google";

import "./globals.css";
import { getPosts, getSettings } from "@/lib/api/server";

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
 * Titles and descriptions come from the CMS "site" settings blob, so the owner
 * can change them without a deploy. If the API is down during build we fall
 * back to neutral defaults rather than failing the render.
 */
export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  try {
    const settings = await getSettings();
    const title = settings.site?.title || "Portfolio";
    const description = settings.site?.description || "";
    // Only advertise the feed once it has something in it; /feed.xml 404s
    // while the blog is empty.
    const hasPosts = await getPosts({ limit: 1 })
      .then((r) => r.total > 0)
      .catch(() => false);
    return {
      metadataBase: new URL(siteUrl),
      title: { default: title, template: `%s · ${title}` },
      description,
      openGraph: { title, description, type: "website", url: siteUrl },
      ...(hasPosts
        ? { alternates: { types: { "application/rss+xml": "/feed.xml" } } }
        : {}),
    };
  } catch {
    return { metadataBase: new URL(siteUrl), title: "Portfolio" };
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${newsreader.variable} ${jetbrains.variable}`}>
      <body className="min-h-dvh bg-ink text-fg">{children}</body>
    </html>
  );
}
