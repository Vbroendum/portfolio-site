import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Markdown } from "@/components/markdown";
import { ProjectDemo } from "@/components/project-demo";
import { Chip, ExternalLink } from "@/components/ui";
import { getProject } from "@/lib/api/server";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const project = await getProject(slug);
  if (!project) return {};
  return {
    title: project.title,
    description: project.tagline,
    openGraph: {
      title: project.title,
      description: project.tagline,
      images: project.cover ? [project.cover.url] : undefined,
    },
  };
}

export default async function ProjectPage({ params }: Params) {
  const { slug } = await params;
  const project = await getProject(slug);
  if (!project) notFound();

  return (
    <article className="mx-auto max-w-5xl px-5 py-14 sm:px-8">
      <Link
        href="/projects"
        className="font-mono text-[13px] text-faint no-underline hover:text-fg"
      >
        ← work
      </Link>

      <header className="mt-6">
        <h1 className="text-3xl sm:text-4xl">{project.title}</h1>
        <p className="mt-2 max-w-[62ch] text-muted">{project.tagline}</p>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
          {project.repo_url ? (
            <ExternalLink href={project.repo_url}>source</ExternalLink>
          ) : null}
          {project.live_url ? (
            <ExternalLink href={project.live_url}>live site</ExternalLink>
          ) : null}
          <div className="flex flex-wrap gap-1.5">
            {project.tech.map((t) => (
              <Chip key={t}>{t}</Chip>
            ))}
          </div>
        </div>
      </header>

      {project.demo_type !== "none" ? (
        <div className="mt-10">
          <ProjectDemo project={project} />
        </div>
      ) : null}

      {project.body_markdown ? (
        <div className="mt-12">
          <Markdown>{project.body_markdown}</Markdown>
        </div>
      ) : null}
    </article>
  );
}
