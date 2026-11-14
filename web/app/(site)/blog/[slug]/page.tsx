import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Markdown } from "@/components/markdown";
import { Chip, FormattedDate } from "@/components/ui";
import { getPost } from "@/lib/api/server";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.summary,
    openGraph: {
      title: post.title,
      description: post.summary,
      type: "article",
      publishedTime: post.published_at ?? undefined,
      images: post.cover ? [post.cover.url] : undefined,
    },
  };
}

export default async function PostPage({ params }: Params) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  return (
    <article className="mx-auto max-w-5xl px-5 py-14 sm:px-8">
      <Link
        href="/blog"
        className="font-mono text-[13px] text-faint no-underline hover:text-fg"
      >
        ← writing
      </Link>

      <header className="mt-6 max-w-[var(--measure)]">
        <h1 className="text-3xl sm:text-4xl">{post.title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <FormattedDate value={post.published_at} />
          <span className="font-mono text-[13px] text-faint">
            {post.reading_minutes} min read
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
        <Markdown>{post.body_markdown}</Markdown>
      </div>
    </article>
  );
}
