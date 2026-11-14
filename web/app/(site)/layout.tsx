import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { FALLBACK_SETTINGS, getPosts, getSettings } from "@/lib/api/server";

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

/**
 * Wraps every public page. The admin UI lives outside this group so it does
 * not inherit the site chrome.
 */
export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // A missing API should degrade to an unstyled-but-working shell rather than
  // a 500 on every page.
  let settings = FALLBACK_SETTINGS;
  try {
    settings = await getSettings();
  } catch {
    // keep fallback
  }

  // The blog hides itself until there is something in it: no nav link, no RSS
  // link, no sitemap entry, and /blog itself 404s. Publishing the first post
  // brings all of it back with no setting to remember. The count rides the
  // "posts" cache tag, so this costs nothing per visitor.
  let hasPosts = false;
  try {
    hasPosts = (await getPosts({ limit: 1 })).total > 0;
  } catch {
    // keep false
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader name={settings.site?.title || "Portfolio"} showBlog={hasPosts} />
      <main className="flex-1">{children}</main>
      <SiteFooter
        email={settings.site?.email}
        location={settings.site?.location}
        links={settings.socials?.links ?? []}
        showRss={hasPosts}
      />
    </div>
  );
}
