import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Markdown } from "@/components/markdown";
import { Chip, FormattedDate, UntranslatedNote } from "@/components/ui";
import { getPost } from "@/lib/api/server";
import { OG_LOCALE, localePath } from "@/lib/i18n/config";
import { format, getDictionary } from "@/lib/i18n/dictionaries";
import { alternatesFor, localeFromParams } from "@/lib/i18n/server";

type Params = { params: Promise<{ lang: string; slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const locale = await localeFromParams(params);
  const { slug } = await params;
  const post = await getPost(slug, locale).catch(() => null);
  if (!post) return {};
  return {
    title: post.title,
    description: post.summary,
    alternates: await alternatesFor(locale, `/blog/${slug}`),
    openGraph: {
      title: post.title,
      description: post.summary,
      type: "article",
      locale: OG_LOCALE[locale],
      publishedTime: post.published_at ?? undefined,
      images: post.cover ? [post.cover.url] : undefined,
    },
  };
}

export default async function PostPage({ params }: Params) {
  const locale = await localeFromParams(params);
  const { slug } = await params;
  const dict = getDictionary(locale);
  const post = await getPost(slug, locale);
  if (!post) notFound();

  // The API reports which language the body is actually in; on a Danish page
  // an untranslated body is English, and is marked up as such.
  const bodyLocale = post.locale ?? locale;

  return (
    <article className="mx-auto max-w-5xl px-5 py-14 sm:px-8">
      <Link
        href={localePath(locale, "/blog")}
        className="font-mono text-[13px] text-faint no-underline hover:text-fg"
      >
        {dict.blog.back}
      </Link>

      <header className="mt-6 max-w-[var(--measure)]">
        <h1 className="text-3xl sm:text-4xl">{post.title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <FormattedDate value={post.published_at} locale={locale} />
          <span className="font-mono text-[13px] text-faint">
            {format(dict.blog.minRead, { n: post.reading_minutes })}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {post.tags.map((t) => (
              <Chip key={t}>{t}</Chip>
            ))}
          </div>
        </div>
      </header>

      {post.cover ? (
        <div className="relative mt-8 aspect-[2/1] w-full max-w-[var(--measure)] overflow-hidden rounded-md border border-line">
          <Image
            src={post.cover.url}
            alt={post.cover.alt_text || ""}
            fill
            sizes="(max-width: 768px) 100vw, 768px"
            className="object-cover"
            priority
          />
        </div>
      ) : null}

      <div className="mt-10">
        {bodyLocale !== locale ? (
          <UntranslatedNote>{dict.blog.untranslated}</UntranslatedNote>
        ) : null}
        <div lang={bodyLocale}>
          <Markdown>{post.body_markdown}</Markdown>
        </div>
      </div>
    </article>
  );
}
