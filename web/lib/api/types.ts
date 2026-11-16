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

/** models.Locale. "en" is the default and lives in the base fields. */
export type Locale = "en" | "da";

/** The locales stored in a record's `translations`, i.e. all but the default. */
export type TranslatedLocale = Exclude<Locale, "en">;

export type Translations<T> = Partial<Record<TranslatedLocale, T>>;

/** Empty fields fall back to the English base field on the public site. */
export interface PostTranslation {
  title: string;
  summary: string;
  body_markdown: string;
}

export interface ProjectTranslation {
  title: string;
  tagline: string;
  body_markdown: string;
}

/** An empty highlights list falls back as a whole, not bullet by bullet. */
export interface CVEntryTranslation {
  title: string;
  organization: string;
  location: string;
  description_markdown: string;
  highlights: string[];
}

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
  /** Admin reads only. Public reads are already localized. */
  translations?: Translations<PostTranslation>;
  /**
   * Public reads only: the language the body was served in. Differs from the
   * requested locale when the body is untranslated and fell back to English.
   */
  locale?: Locale;
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
  /** Same contract as Post.translations and Post.locale. */
  translations?: Translations<ProjectTranslation>;
  locale?: Locale;
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
  /** Admin reads only. Public reads are already localized. */
  translations?: Translations<CVEntryTranslation>;
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

export interface SiteSettingsText {
  tagline?: string;
  description?: string;
  location?: string;
}

export interface AboutSettingsText {
  heading?: string;
  body_markdown?: string;
}

/**
 * The three settings blobs, as returned by GET /api/v1/settings.
 *
 * `translations` only appears on the admin read; the public read has already
 * overlaid the requested locale's strings onto the base fields.
 */
export interface Settings {
  site: SiteSettingsText & {
    title?: string;
    email?: string;
    translations?: Translations<SiteSettingsText>;
  };
  about: AboutSettingsText & {
    avatar_media_id?: string | null;
    avatar_url?: string | null;
    translations?: Translations<AboutSettingsText>;
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
  translations: Translations<PostTranslation>;
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
  translations: Translations<ProjectTranslation>;
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
  translations: Translations<CVEntryTranslation>;
}
