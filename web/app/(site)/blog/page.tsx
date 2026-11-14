import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ChipLink, EmptyState, FormattedDate } from "@/components/ui";
import { emptyList, getPosts, getTags } from "@/lib/api/server";
import type { Post, TagCount } from "@/lib/api/types";

export const metadata: Metadata = {
  title: "Writing",
  description: "Notes on things I build.",
};

type Props = { searchParams: Promise<{ tag?: string }> };

export default async function BlogPage({ searchParams }: Props) {
  const { tag } = await searchParams;
  const [posts, tags] = await Promise.all([
    getPosts({ tag, limit: 50 }).catch(emptyList<Post>),
    getTags().catch(() => ({ items: [] as TagCount[] })),
  ]);

  // With nothing published, the blog does not exist rather than existing and
  // being empty: a visitor who guesses the URL gets a 404, matching the hidden
  // nav link. A tag that happens to match nothing still renders the page, so
  // the filter chips keep working.
  if (!tag && posts.total === 0) notFound();

  return (
    <div className="mx-auto max-w-5xl px-5 py-14 sm:px-8">
      <h1 className="text-3xl">Writing</h1>

      {tags.items.length > 0 ? (
        <nav aria-label="Filter by tag" className="mt-5 flex flex-wrap gap-1.5">
          <ChipLink href="/blog" active={!tag}>
            all
          </ChipLink>
          {tags.items.map((t) => (
            <ChipLink
              key={t.tag}
              href={`/blog?tag=${encodeURIComponent(t.tag)}`}
              active={tag === t.tag}
            >
              {t.tag} {t.count}
            </ChipLink>
          ))}
        </nav>
      ) : null}

      {posts.items.length === 0 ? (
        <div className="mt-10">
          <EmptyState hint="Write one in the CMS at /admin/posts.">
            {`Nothing tagged "${tag}" yet.`}
          </EmptyState>
        </div>
      ) : (
        <ul className="mt-10 divide-y divide-line border-t border-line">
          {posts.items.map((post) => (
            <li key={post.id}>
              <Link
                href={`/blog/${post.slug}`}
                className="group block py-6 no-underline"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                  <h2 className="text-xl transition-colors group-hover:text-accent">
                    {post.title}
                  </h2>
                  <FormattedDate value={post.published_at} />
                </div>
                <p className="mt-1 max-w-[62ch] text-muted">{post.summary}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
