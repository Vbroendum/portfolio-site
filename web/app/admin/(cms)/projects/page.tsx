"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AdminHeader } from "@/components/admin/shell";
import { deleteProject, listProjects, revalidate } from "@/lib/api/admin";
import type { Project } from "@/lib/api/types";

export default function ProjectsListPage() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      const res = await listProjects();
      setProjects(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not load projects");
    }
  }

  // See the note in the posts list: state updates happen in a callback.
  useEffect(() => {
    let cancelled = false;
    listProjects()
      .then((res) => {
        if (!cancelled) setProjects(res.items);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : "could not load projects",
          );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function remove(project: Project) {
    if (!confirm(`Delete "${project.title}"? This cannot be undone.`)) return;
    await deleteProject(project.id);
    await revalidate(["projects"]);
    await refresh();
  }

  return (
    <>
      <AdminHeader title="Projects">
        <Link
          href="/admin/projects/new"
          className="rounded border border-accent-dim bg-accent-wash px-3 py-1.5 font-mono text-[13px] no-underline hover:border-accent"
        >
          new project
        </Link>
      </AdminHeader>

      {error ? (
        <p className="font-mono text-[13px] text-danger">{error}</p>
      ) : null}

      <p className="mb-4 font-mono text-[12px] text-faint">
        Order on the public page: featured first, then by sort order (lowest
        first), then newest.
      </p>

      <ul className="divide-y divide-line">
        {projects?.map((project) => (
          <li
            key={project.id}
            className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3"
          >
            <span className="w-8 font-mono text-[12px] text-faint">
              {project.sort_order}
            </span>

            <Link
              href={`/admin/projects/${project.id}`}
              className="min-w-0 flex-1 truncate no-underline hover:text-accent"
            >
              {project.title}
            </Link>

            {project.featured ? (
              <span className="font-mono text-[12px] text-accent-dim">
                featured
              </span>
            ) : null}

            <span className="font-mono text-[12px] text-faint">
              {project.demo_type}
            </span>

            <span
              className={`font-mono text-[12px] ${
                project.status === "published" ? "text-ok" : "text-warn"
              }`}
            >
              {project.status}
            </span>

            <button
              type="button"
              onClick={() => void remove(project)}
              className="font-mono text-[12px] text-faint hover:text-danger"
            >
              delete
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
