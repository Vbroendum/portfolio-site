/**
 * Server-side API access, used by Server Components.
 *
 * Two base URLs exist on purpose:
 *   API_INTERNAL_URL  - reachable from the Next.js container ("http://api:8080")
 *   NEXT_PUBLIC_API_URL - reachable from the browser ("http://localhost:8080")
 *
 * In docker-compose they differ; on a laptop they are usually the same.
 *
 * Caching: public reads are tagged so the CMS can revalidate exactly what it
 * changed (see app/api/revalidate/route.ts).
 */
import "server-only";

import type {
  CVEntry,
  ListEnvelope,
  Post,
  Project,
  Settings,
  TagCount,
} from "./types";

const INTERNAL =
  process.env.API_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8080";

export const CACHE_TAGS = {
  posts: "posts",
  projects: "projects",
  cv: "cv",
  settings: "settings",
} as const;

type FetchOptions = {
  tags?: string[];
  /** Seconds. 0 disables caching (used for anything behind auth). */
  revalidate?: number;
};

/**
 * How long a cached public response may be served before Next.js refetches.
 *
 * Kept short because pages are prerendered during `next build`, when the API is
 * usually not reachable - a fresh container would otherwise serve empty pages
 * until the first revalidation. Edits made in the CMS do not wait for this:
 * they purge their tags through /api/revalidate immediately.
 */
const DEFAULT_REVALIDATE = 60;

/**
 * How long to wait for the API before giving up.
 *
 * Without a bound, an API that accepts the connection but never answers - a
 * proxy in front of a service that is not up yet, say - hangs the caller. At
 * build time that means `next build` stalls for a minute per page and then
 * fails, which is how this was found: the production API hostname resolved
 * through Cloudflare but had nothing behind it. Failing fast lets the page
 * fall back to its empty state instead.
 */
const FETCH_TIMEOUT_MS = 5_000;

async function get<T>(path: string, opts: FetchOptions = {}): Promise<T> {
  const res = await fetch(`${INTERNAL}${path}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    next: {
      tags: opts.tags,
      revalidate: opts.revalidate ?? DEFAULT_REVALIDATE,
    },
  });
  if (!res.ok) {
    throw new ApiError(res.status, await safeMessage(res), path);
  }
  return (await res.json()) as T;
}

/** Returns null on 404 instead of throwing, for `notFound()` call sites. */
async function getOrNull<T>(
  path: string,
  opts: FetchOptions = {},
): Promise<T | null> {
  try {
    return await get<T>(path, opts);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly path: string,
  ) {
    super(`${status} on ${path}: ${message}`);
    this.name = "ApiError";
  }
}

async function safeMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: { message?: string } };
    return body.error?.message ?? res.statusText;
  } catch {
    return res.statusText;
  }
}

// ---------------------------------------------------------------------------
// Public reads
// ---------------------------------------------------------------------------

export function getPosts(params: {
  tag?: string;
  limit?: number;
  offset?: number;
} = {}) {
  const q = new URLSearchParams();
  if (params.tag) q.set("tag", params.tag);
  if (params.limit) q.set("limit", String(params.limit));
  if (params.offset) q.set("offset", String(params.offset));
  const qs = q.toString();
  return get<ListEnvelope<Post>>(`/api/v1/posts${qs ? `?${qs}` : ""}`, {
    tags: [CACHE_TAGS.posts],
  });
}

export function getPost(slug: string) {
  return getOrNull<Post>(`/api/v1/posts/${encodeURIComponent(slug)}`, {
    tags: [CACHE_TAGS.posts, `post:${slug}`],
  });
}

export function getTags() {
  return get<{ items: TagCount[] }>("/api/v1/tags", {
    tags: [CACHE_TAGS.posts],
  });
}

export function getProjects(params: { featured?: boolean; tech?: string } = {}) {
  const q = new URLSearchParams();
  if (params.featured) q.set("featured", "true");
  if (params.tech) q.set("tech", params.tech);
  const qs = q.toString();
  return get<ListEnvelope<Project>>(`/api/v1/projects${qs ? `?${qs}` : ""}`, {
    tags: [CACHE_TAGS.projects],
  });
}

export function getProject(slug: string) {
  return getOrNull<Project>(`/api/v1/projects/${encodeURIComponent(slug)}`, {
    tags: [CACHE_TAGS.projects, `project:${slug}`],
  });
}

export function getCV() {
  return get<{ items: CVEntry[] }>("/api/v1/cv", { tags: [CACHE_TAGS.cv] });
}

/**
 * Empty collection, used as a fallback when the API is unreachable.
 *
 * The public pages degrade to "nothing published yet" instead of throwing,
 * which also means `next build` succeeds without a running API.
 */
export const emptyList = <T,>(): ListEnvelope<T> => ({
  items: [],
  total: 0,
  limit: 0,
  offset: 0,
});

/** Neutral settings used when the API is unreachable during a render. */
export const FALLBACK_SETTINGS: Settings = { site: {}, about: {}, socials: {} };

export function getSettings() {
  return get<Settings>("/api/v1/settings", { tags: [CACHE_TAGS.settings] });
}
