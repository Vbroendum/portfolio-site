import type { Metadata } from "next";
import Link from "next/link";

import { Chip, EmptyState } from "@/components/ui";
import { emptyList, getProjects } from "@/lib/api/server";
import type { Project } from "@/lib/api/types";

export const metadata: Metadata = {
  title: "Work",
  description: "Projects, with demos you can actually run.",
};

/**
 * A list, not a card grid: every project gets the same horizontal band, so the
 * eye compares titles and taglines instead of thumbnails.
 */
export default async function ProjectsPage() {
  const projects = await getProjects().catch(emptyList<Project>);

  return (
    <div className="mx-auto max-w-5xl px-5 py-14 sm:px-8">
      <h1 className="text-3xl">Work</h1>
      <p className="mt-2 max-w-[58ch] text-muted">
        Things I have built. Most have a demo you can poke at on the project
        page.
      </p>

      {projects.items.length === 0 ? (
        <div className="mt-10">
          <EmptyState hint="Add one in the CMS at /admin/projects.">
            No projects published yet.
          </EmptyState>
        </div>
      ) : (
        <ul className="mt-10 divide-y divide-line border-t border-line">
          {projects.items.map((project) => (
            <li key={project.id}>
              <Link
                href={`/projects/${project.slug}`}
                className="group block py-6 no-underline"
              >
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h2 className="text-xl transition-colors group-hover:text-accent">
                    {project.title}
                  </h2>
                  {project.featured ? (
                    <span className="font-mono text-[11px] text-accent-dim">
                      featured
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 max-w-[62ch] text-muted">
                  {project.tagline}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {project.tech.map((t) => (
                    <Chip key={t}>{t}</Chip>
                  ))}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
