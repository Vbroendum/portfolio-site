import { ImageResponse } from "next/og";

import { FALLBACK_SETTINGS, getSettings } from "@/lib/api/server";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/config";

/**
 * The link preview card, used by LinkedIn, Slack, iMessage, Mastodon and the
 * rest whenever someone shares the site.
 *
 * It is generated rather than drawn so it always matches what the CMS says.
 * Pages that have their own image (a post or project with a cover) override it
 * through `openGraph.images` in their own metadata.
 *
 * Keep it to the site's tokens: ink ground, hairline, one lilac accent.
 */
// Rendered on demand: prerendering it would bake the build-time fallback
// ("Portfolio", no headline) into the card, and a scraper that fetched it in
// that window could cache the wrong image for a long time.
export const dynamic = "force-dynamic";

export const alt = "Victor Brøndum";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** One card per locale, so a Danish link previews with the Danish headline. */
export default async function OpengraphImage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale = isLocale(lang) ? lang : DEFAULT_LOCALE;
  const settings = await getSettings(locale).catch(() => FALLBACK_SETTINGS);
  const name = settings.site?.title || "Portfolio";
  const headline = settings.site?.tagline || "";
  const location = settings.site?.location || "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0e1013",
          padding: "72px 80px",
          border: "1px solid #262b31",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 3,
              background: "#b3a4ff",
            }}
          />
          <div style={{ fontSize: 30, color: "#9aa1aa" }}>{name}</div>
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 68,
            lineHeight: 1.15,
            color: "#e9e6e0",
            maxWidth: 900,
          }}
        >
          {headline}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 26,
            color: "#6b727c",
          }}
        >
          <div style={{ display: "flex" }}>{location}</div>
          <div style={{ display: "flex" }}>
            {(process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(
              /^https?:\/\//,
              "",
            )}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
