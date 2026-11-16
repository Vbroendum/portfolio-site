import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ChipLink, EmptyState, FormattedDate } from "@/components/ui";
import { emptyList, getPosts, getTags } from "@/lib/api/server";
import type { Post, TagCount } from "@/lib/api/types";
import { localePath } from "@/lib/i18n/config";
import { format, getDictionary } from "@/lib/i18n/dictionaries";
import { alternatesFor, localeFromParams } from "@/lib/i18n/server";

type Props = {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ tag?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await localeFromParams(params);
  const dict = getDictionary(locale);
  return {
    title: dict.blog.title,
    description: dict.blog.description,
    alternates: await alternatesFor(locale, "/blog"),
  };
}

export default async function BlogPage({ params, searchParams }: Props) {
  const locale = await localeFromParams(params);
  const dict = getDictionary(locale);
  const { tag } = await searchParams;
  const [posts, tags] = await Promise.all([
    getPosts({ locale, tag, limit: 50 }).catch(emptyList<Post>),
    getTags().catch(() => ({ items: [] as TagCount[] })),
  ]);

  // With nothing published, the blog does not exist rather than existing and
  // being empty: a visitor who guesses the URL gets a 404, matching the hidden
  // nav link. A tag that happens to match nothing still renders the page, so
  // the filter chips keep working.
  if (!tag && posts.total === 0) notFound();

  const blogPath = localePath(locale, "/blog");

  return (
    <div className="mx-auto max-w-5xl px-5 py-14 sm:px-8">
      <h1 className="text-3xl">{dict.blog.title}</h1>

      {tags.items.length > 0 ? (
        <nav
          aria-label={dict.blog.filterLabel}
          className="mt-5 flex flex-wrap gap-1.5"
        >
          <ChipLink href={blogPath} active={!tag}>
            {dict.blog.allTags}
          </ChipLink>
          {tags.items.map((t) => (
            <ChipLink
              key={t.tag}
              href={`${blogPath}?tag=${encodeURIComponent(t.tag)}`}
              active={tag === t.tag}
            >
              {t.tag} {t.count}
            </ChipLink>
          ))}
        </nav>
      ) : null}

      {posts.items.length === 0 ? (
        <div className="mt-10">
          <EmptyState authoringHint="Write one in the CMS at /admin/posts.">
            {format(dict.blog.noneTagged, { tag: tag ?? "" })}
          </EmptyState>
        </div>
      ) : (
        <ul className="mt-10 divide-y divide-line border-t border-line">
          {posts.items.map((post) => (
            <li key={post.id}>
              <Link
                href={localePath(locale, `/blog/${post.slug}`)}
                className="group block py-6 no-underline"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                  <h2 className="text-xl transition-colors group-hover:text-accent">
                    {post.title}
                  </h2>
                  <FormattedDate value={post.published_at} locale={locale} />
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
