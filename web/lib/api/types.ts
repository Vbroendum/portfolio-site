/**
 * Mirrors the Go structs in api/internal/models. When you change a field there,
 * change it here too - nothing enforces this at build time.
 */

export type Status = "draft" | "published";
export type DemoType = "none" | "iframe" | "video" | "asciinema" | "gallery";
export type CVKind =
  | "experience"
  | "education"
  | "skill"
  | "certification"
  | "other";

export interface Media {
  id: string;
  url: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  width?: number;
  height?: number;
  alt_text: string;
  created_at: string;
}

export interface Post {
  id: string;
  slug: string;
  title: string;
  summary: string;
  body_markdown: string;
  cover_media_id?: string | null;
  cover?: Media | null;
  tags: string[];
  status: Status;
  reading_minutes: number;
  published_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  body_markdown: string;
  tech: string[];
  repo_url: string;
  live_url: string;
  demo_type: DemoType;
  demo_url: string;
  cover_media_id?: string | null;
  cover?: Media | null;
  gallery: Media[];
  featured: boolean;
  status: Status;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CVEntry {
  id: string;
  kind: CVKind;
  title: string;
  organization: string;
  location: string;
  start_date?: string | null;
  end_date?: string | null;
  is_current: boolean;
  description_markdown: string;
  highlights: string[];
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  created_at: string;
}

export interface TagCount {
  tag: string;
  count: number;
}

export interface ListEnvelope<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface SocialLink {
  label: string;
  url: string;
}

/** The three settings blobs, as returned by GET /api/v1/settings. */
export interface Settings {
  site: {
    title?: string;
    tagline?: string;
    description?: string;
    email?: string;
    location?: string;
  };
  about: {
    heading?: string;
    body_markdown?: string;
    avatar_media_id?: string | null;
    avatar_url?: string | null;
  };
  socials: {
    links?: SocialLink[];
  };
}

/** Request bodies for the admin endpoints. */
export interface PostInput {
  slug: string;
  title: string;
  summary: string;
  body_markdown: string;
  cover_media_id: string | null;
  tags: string[];
  status: Status;
  published_at: string | null;
}

export interface ProjectInput {
  slug: string;
  title: string;
  tagline: string;
  body_markdown: string;
  tech: string[];
  repo_url: string;
  live_url: string;
  demo_type: DemoType;
  demo_url: string;
  cover_media_id: string | null;
  gallery_media_ids: string[];
  featured: boolean;
  status: Status;
  sort_order: number;
}

export interface CVEntryInput {
  kind: CVKind;
  title: string;
  organization: string;
  location: string;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  description_markdown: string;
  highlights: string[];
  sort_order: number;
}
