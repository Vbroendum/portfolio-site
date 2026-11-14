"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AdminHeader } from "@/components/admin/shell";
import { listCV, listMedia, listPosts, listProjects } from "@/lib/api/admin";

type Counts = {
  posts: number;
  drafts: number;
  projects: number;
  cv: number;
  media: number;
};

/**
 * Overview: counts plus the two things you actually came here to do - write a
 * post or add a project.
 */
export default function AdminHome() {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listPosts(), listProjects(), listCV(), listMedia()])
      .then(([posts, projects, cv, media]) =>
        setCounts({
          posts: posts.total,
          drafts: posts.items.filter((p) => p.status === "draft").length,
          projects: projects.total,
          cv: cv.items.length,
          media: media.total,
        }),
      )
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "could not load counts"),
      );
  }, []);

  return (
    <>
      <AdminHeader title="Overview">
        <Link
          href="/admin/posts/new"
          className="rounded border border-accent-dim bg-accent-wash px-3 py-1.5 font-mono text-[13px] no-underline hover:border-accent"
        >
          new post
        </Link>
        <Link
          href="/admin/projects/new"
          className="rounded border border-line px-3 py-1.5 font-mono text-[13px] text-muted no-underline hover:border-line-strong hover:text-fg"
        >
          new project
        </Link>
      </AdminHeader>

      {error ? (
        <p className="font-mono text-[13px] text-danger">{error}</p>
      ) : null}

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded border border-line bg-line sm:grid-cols-5">
        <Stat label="posts" value={counts?.posts} />
        <Stat label="drafts" value={counts?.drafts} />
        <Stat label="projects" value={counts?.projects} />
        <Stat label="cv entries" value={counts?.cv} />
        <Stat label="media" value={counts?.media} />
      </dl>

      <section className="mt-10 max-w-[60ch]">
        <h2 className="text-lg">How publishing works</h2>
        <p className="mt-2 text-muted">
          Content is a draft until you set it to published. Saving a published
          item clears the public cache for that section immediately, so changes
          appear on the site on the next page load.
        </p>
      </section>
    </>
  );
}

function Stat({ label, value }: { label: string; value?: number }) {
  return (
    <div className="bg-ink px-4 py-5">
      <dd className="text-2xl">{value ?? "-"}</dd>
      <dt className="mt-0.5 font-mono text-[12px] text-faint">{label}</dt>
    </div>
  );
}
