import type { MetadataRoute } from "next";

import { getPosts, getProjects } from "@/lib/api/server";
import { DEFAULT_LOCALE, LOCALES, localePath } from "@/lib/i18n/config";

// Same reasoning as the feed: a build without a reachable API must not bake
// an empty sitemap into the image.
export const dynamic = "force-dynamic";

/**
 * Built from the API, so a newly published post appears in the sitemap as soon
 * as the cache for "posts" is revalidated.
 *
 * Every page is listed once per locale, and each entry names its siblings in
 * the other languages, which is how search engines learn the /en and /da
 * versions are the same page rather than duplicates.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const entries = (path: string, lastModified = new Date()) => {
    const languages: Record<string, string> = {};
    for (const l of LOCALES) languages[l] = `${site}${localePath(l, path)}`;
    languages["x-default"] = `${site}${localePath(DEFAULT_LOCALE, path)}`;
    return LOCALES.map((l) => ({
      url: `${site}${localePath(l, path)}`,
      lastModified,
      alternates: { languages },
    }));
  };

  // /blog is added below, only if a post exists - see app/[lang]/layout.tsx.
  const staticRoutes = ["/", "/projects", "/cv", "/about"].flatMap((p) =>
    entries(p),
  );

  try {
    // Slugs are shared by every locale, so one fetch lists them all.
    const [posts, projects] = await Promise.all([
      getPosts({ locale: DEFAULT_LOCALE, limit: 100 }),
      getProjects({ locale: DEFAULT_LOCALE }),
    ]);
    return [
      ...staticRoutes,
      ...(posts.items.length > 0 ? entries("/blog") : []),
      ...posts.items.flatMap((p) =>
        entries(`/blog/${p.slug}`, new Date(p.updated_at)),
      ),
      ...projects.items.flatMap((p) =>
        entries(`/projects/${p.slug}`, new Date(p.updated_at)),
      ),
    ];
  } catch {
    return staticRoutes;
  }
}
