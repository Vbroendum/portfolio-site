"use client";

/**
 * Browser-side API access for the CMS at /admin.
 *
 * Every call sends the session cookie (`credentials: "include"`), so the API
 * and the site must be same-site: localhost:3000 -> localhost:8080 in dev, and
 * yourdomain.com -> api.yourdomain.com in production. If you ever host the API
 * on an unrelated domain, set COOKIE_DOMAIN and SameSite=None on the API side.
 */

import type {
  CVEntry,
  CVEntryInput,
  ListEnvelope,
  Media,
  Post,
  PostInput,
  Project,
  ProjectInput,
  Settings,
  User,
} from "./types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export class AdminApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "AdminApiError";
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return undefined as T;
  if (!res.ok) {
    let message = res.statusText;
    try {
      const parsed = (await res.json()) as { error?: { message?: string } };
      if (parsed.error?.message) message = parsed.error.message;
    } catch {
      // keep statusText
    }
    throw new AdminApiError(res.status, message);
  }
  return (await res.json()) as T;
}

// ---- auth -----------------------------------------------------------------

export const login = (email: string, password: string) =>
  request<User>("POST", "/api/v1/auth/login", { email, password });

export const logout = () => request<void>("POST", "/api/v1/auth/logout");

export const me = () => request<User>("GET", "/api/v1/auth/me");

// ---- posts ----------------------------------------------------------------

export const listPosts = (limit = 100) =>
  request<ListEnvelope<Post>>("GET", `/api/v1/admin/posts?limit=${limit}`);

export const getPost = (id: string) =>
  request<Post>("GET", `/api/v1/admin/posts/${id}`);

export const createPost = (input: PostInput) =>
  request<Post>("POST", "/api/v1/admin/posts", input);

export const updatePost = (id: string, input: PostInput) =>
  request<Post>("PUT", `/api/v1/admin/posts/${id}`, input);

export const deletePost = (id: string) =>
  request<void>("DELETE", `/api/v1/admin/posts/${id}`);

// ---- projects -------------------------------------------------------------

export const listProjects = () =>
  request<ListEnvelope<Project>>("GET", "/api/v1/admin/projects?limit=100");

export const getProject = (id: string) =>
  request<Project>("GET", `/api/v1/admin/projects/${id}`);

export const createProject = (input: ProjectInput) =>
  request<Project>("POST", "/api/v1/admin/projects", input);

export const updateProject = (id: string, input: ProjectInput) =>
  request<Project>("PUT", `/api/v1/admin/projects/${id}`, input);

export const deleteProject = (id: string) =>
  request<void>("DELETE", `/api/v1/admin/projects/${id}`);

// ---- cv -------------------------------------------------------------------

export const listCV = () =>
  request<{ items: CVEntry[] }>("GET", "/api/v1/admin/cv");

export const createCV = (input: CVEntryInput) =>
  request<CVEntry>("POST", "/api/v1/admin/cv", input);

export const updateCV = (id: string, input: CVEntryInput) =>
  request<CVEntry>("PUT", `/api/v1/admin/cv/${id}`, input);

export const deleteCV = (id: string) =>
  request<void>("DELETE", `/api/v1/admin/cv/${id}`);

export const reorderCV = (ids: string[]) =>
  request<void>("PUT", "/api/v1/admin/cv/reorder", { ids });

// ---- media ----------------------------------------------------------------

export const listMedia = (limit = 100) =>
  request<ListEnvelope<Media>>("GET", `/api/v1/admin/media?limit=${limit}`);

export async function uploadMedia(file: File, alt = ""): Promise<Media> {
  const form = new FormData();
  form.append("file", file);
  form.append("alt", alt);

  const res = await fetch(`${BASE}/api/v1/admin/media`, {
    method: "POST",
    credentials: "include",
    body: form, // no Content-Type: the browser sets the multipart boundary
  });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const parsed = (await res.json()) as { error?: { message?: string } };
      if (parsed.error?.message) message = parsed.error.message;
    } catch {
      // keep statusText
    }
    throw new AdminApiError(res.status, message);
  }
  return (await res.json()) as Media;
}

export const updateMediaAlt = (id: string, alt_text: string) =>
  request<Media>("PATCH", `/api/v1/admin/media/${id}`, { alt_text });

export const deleteMedia = (id: string) =>
  request<void>("DELETE", `/api/v1/admin/media/${id}`);

// ---- settings -------------------------------------------------------------

export const getSettings = () =>
  request<Settings>("GET", "/api/v1/admin/settings");

export const putSetting = (key: keyof Settings, value: unknown) =>
  request<unknown>("PUT", `/api/v1/admin/settings/${key}`, value);

/**
 * Tells Next.js to drop its cached copy of the public pages after an edit.
 * Without this the published site can lag by up to the 5 minute revalidate.
 */
export async function revalidate(tags: string[]): Promise<void> {
  await fetch("/api/revalidate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tags }),
  });
}
