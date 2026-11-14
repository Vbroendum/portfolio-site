import type { MetadataRoute } from "next";

import { getPosts, getProjects } from "@/lib/api/server";

// Same reasoning as the feed: a build without a reachable API must not bake
// an empty sitemap into the image.
export const dynamic = "force-dynamic";

/**
 * Built from the API, so a newly published post appears in the sitemap as soon
 * as the cache for "posts" is revalidated.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const route = (path: string) => ({
    url: `${site}${path}`,
    lastModified: new Date(),
  });

  // /blog is added below, only if a post exists - see app/(site)/layout.tsx.
  const staticRoutes = ["", "/projects", "/cv", "/about"].map(route);

  try {
    const [posts, projects] = await Promise.all([
      getPosts({ limit: 100 }),
      getProjects(),
    ]);
    return [
      ...staticRoutes,
      ...(posts.items.length > 0 ? [route("/blog")] : []),
      ...posts.items.map((p) => ({
        url: `${site}/blog/${p.slug}`,
        lastModified: new Date(p.updated_at),
      })),
      ...projects.items.map((p) => ({
        url: `${site}/projects/${p.slug}`,
        lastModified: new Date(p.updated_at),
      })),
    ];
  } catch {
    return staticRoutes;
  }
}
