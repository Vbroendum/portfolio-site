"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AdminHeader } from "@/components/admin/shell";
import { deletePost, listPosts, revalidate } from "@/lib/api/admin";
import type { Post } from "@/lib/api/types";

export default function PostsListPage() {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      const res = await listPosts();
      setPosts(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not load posts");
    }
  }

  // Loading through a callback (rather than awaiting in the effect body)
  // keeps the state update out of the synchronous render path.
  useEffect(() => {
    let cancelled = false;
    listPosts()
      .then((res) => {
        if (!cancelled) setPosts(res.items);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "could not load posts");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function remove(post: Post) {
    if (!confirm(`Delete "${post.title}"? This cannot be undone.`)) return;
    await deletePost(post.id);
    await revalidate(["posts"]);
    await refresh();
  }

  return (
    <>
      <AdminHeader title="Posts">
        <Link
          href="/admin/posts/new"
          className="rounded border border-accent-dim bg-accent-wash px-3 py-1.5 font-mono text-[13px] no-underline hover:border-accent"
        >
          new post
        </Link>
      </AdminHeader>

      {error ? (
        <p className="font-mono text-[13px] text-danger">{error}</p>
      ) : null}

      {posts && posts.length === 0 ? (
        <p className="font-mono text-[13px] text-faint">
          No posts yet. Write the first one.
        </p>
      ) : null}

      <ul className="divide-y divide-line">
        {posts?.map((post) => (
          <li
            key={post.id}
            className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3"
          >
            <Link
              href={`/admin/posts/${post.id}`}
              className="min-w-0 flex-1 truncate no-underline hover:text-accent"
            >
              {post.title}
            </Link>

            <span
              className={`font-mono text-[12px] ${
                post.status === "published" ? "text-ok" : "text-warn"
              }`}
            >
              {post.status}
            </span>

            <span className="font-mono text-[12px] text-faint">
              /{post.slug}
            </span>

            <button
              type="button"
              onClick={() => void remove(post)}
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
