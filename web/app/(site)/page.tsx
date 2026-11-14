import Link from "next/link";

import { Markdown } from "@/components/markdown";
import { ProjectDemo } from "@/components/project-demo";
import { Chip, FormattedDate, SectionHead } from "@/components/ui";
import {
  FALLBACK_SETTINGS,
  getPosts,
  getProjects,
  getSettings,
} from "@/lib/api/server";
import type { Post, Project } from "@/lib/api/types";

/**
 * The home page leads with work that is actually running: the first featured
 * project's demo sits in the hero, under one line of plain text. No stat
 * counters, no "hi, I'm X who does Y and Z" paragraph.
 */
export default async function HomePage() {
  const [settings, projects, posts] = await Promise.all([
    getSettings().catch(() => FALLBACK_SETTINGS),
    getProjects().catch(() => ({ items: [] as Project[], total: 0, limit: 0, offset: 0 })),
    getPosts({ limit: 4 }).catch(() => ({ items: [] as Post[], total: 0, limit: 0, offset: 0 })),
  ]);

  const featured = projects.items.find((p) => p.featured) ?? projects.items[0];
  const rest = projects.items.filter((p) => p.id !== featured?.id).slice(0, 4);

  return (
    <div className="mx-auto max-w-5xl px-5 sm:px-8">
      {/* ---- hero ---- */}
      <section className="rise py-14 sm:py-20">
        <h1 className="max-w-[20ch] text-4xl sm:text-5xl">
          {settings.site?.tagline || "I build things, mostly small and sharp."}
        </h1>
        {settings.site?.description ? (
          <p className="mt-4 max-w-[58ch] text-muted">
            {settings.site.description}
          </p>
        ) : null}

        {featured ? (
          <div className="mt-10">
            <ProjectDemo project={featured} />
            <div className="mt-3 flex flex-wrap items-baseline justify-between gap-3">
              <p className="text-muted">
                <Link href={`/projects/${featured.slug}`} className="text-fg">
                  {featured.title}
                </Link>
                {featured.tagline ? ` - ${featured.tagline}` : null}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {featured.tech.map((t) => (
                  <Chip key={t}>{t}</Chip>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </section>

      {/* ---- other work ---- */}
      {rest.length > 0 ? (
        <section className="py-10">
          <SectionHead
            title="Other work"
            action={
              <Link href="/projects" className="text-muted hover:text-fg">
                all projects
              </Link>
            }
          />
          <ul className="divide-y divide-line">
            {rest.map((project) => (
              <li key={project.id}>
                <Link
                  href={`/projects/${project.slug}`}
                  className="group flex flex-col gap-1 py-4 no-underline sm:flex-row sm:items-baseline sm:justify-between sm:gap-8"
                >
                  <span className="shrink-0 group-hover:text-accent">
                    {project.title}
                  </span>
                  <span className="text-muted sm:text-right">
                    {project.tagline}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ---- recent writing ---- */}
      {posts.items.length > 0 ? (
        <section className="py-10">
          <SectionHead
            title="Recent writing"
            action={
              <Link href="/blog" className="text-muted hover:text-fg">
                all posts
              </Link>
            }
          />
          <ul className="divide-y divide-line">
            {posts.items.map((post) => (
              <li key={post.id}>
                <Link
                  href={`/blog/${post.slug}`}
                  className="group flex flex-col gap-1 py-4 no-underline sm:flex-row sm:items-baseline sm:justify-between sm:gap-8"
                >
                  <span className="group-hover:text-accent">{post.title}</span>
                  <FormattedDate value={post.published_at} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ---- about teaser ---- */}
      {settings.about?.body_markdown ? (
        <section className="py-10">
          <SectionHead
            title={settings.about.heading || "About"}
            action={
              <Link href="/about" className="text-muted hover:text-fg">
                more
              </Link>
            }
          />
          <Markdown>
            {settings.about.body_markdown.split("\n\n").slice(0, 2).join("\n\n")}
          </Markdown>
        </section>
      ) : null}
    </div>
  );
}
