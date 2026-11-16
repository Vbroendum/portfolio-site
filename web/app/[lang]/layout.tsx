import type { Metadata } from "next";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { FALLBACK_SETTINGS, getPosts, getSettings } from "@/lib/api/server";
import { OG_LOCALE, localePath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { alternatesFor, localeFromParams } from "@/lib/i18n/server";

/**
 * Rendering strategy for the whole public site.
 *
 * Pages render on each request, but the API responses behind them are cached
 * by tag in lib/api/server.ts. That combination means:
 *   - a freshly deployed container serves real content immediately, instead of
 *     the empty pages that would be prerendered during `next build` (when the
 *     API is not reachable);
 *   - repeat traffic still costs one cached fetch per tag, not one per visitor;
 *   - a CMS save purges its tag and shows up at once.
 */
export const dynamic = "force-dynamic";

type Props = {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
};

/**
 * Titles and descriptions come from the CMS "site" settings blob, in the
 * page's locale, so the owner can change them without a deploy. If the API is
 * down during build we fall back to neutral defaults rather than failing the
 * render.
 */
export async function generateMetadata({
  params,
}: Omit<Props, "children">): Promise<Metadata> {
  const locale = await localeFromParams(params);
  const dict = getDictionary(locale);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  try {
    const settings = await getSettings(locale);
    const title = settings.site?.title || dict.meta.fallbackTitle;
    const description = settings.site?.description || "";
    return {
      title: { default: title, template: `%s · ${title}` },
      description,
      openGraph: {
        title,
        description,
        type: "website",
        url: `${siteUrl}${localePath(locale)}`,
        locale: OG_LOCALE[locale],
      },
      alternates: await alternatesFor(locale, "/"),
    };
  } catch {
    return { title: dict.meta.fallbackTitle };
  }
}

/**
 * Wraps every public page. The admin UI lives outside [lang] so it does not
 * inherit the site chrome or a locale.
 */
export default async function SiteLayout({ children, params }: Props) {
  const locale = await localeFromParams(params);
  const dict = getDictionary(locale);

  // A missing API should degrade to an unstyled-but-working shell rather than
  // a 500 on every page.
  let settings = FALLBACK_SETTINGS;
  try {
    settings = await getSettings(locale);
  } catch {
    // keep fallback
  }

  // The blog hides itself until there is something in it: no nav link, no RSS
  // link, no sitemap entry, and /blog itself 404s. Publishing the first post
  // brings all of it back with no setting to remember. The count rides the
  // "posts" cache tag, so this costs nothing per visitor.
  let hasPosts = false;
  try {
    hasPosts = (await getPosts({ locale, limit: 1 })).total > 0;
  } catch {
    // keep false
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader
        locale={locale}
        name={settings.site?.title || dict.meta.fallbackTitle}
        showBlog={hasPosts}
        labels={dict.nav}
      />
      <main className="flex-1">{children}</main>
      <SiteFooter
        locale={locale}
        email={settings.site?.email}
        location={settings.site?.location}
        links={settings.socials?.links ?? []}
        showRss={hasPosts}
        rssLabel={dict.footer.rss}
      />
    </div>
  );
}
