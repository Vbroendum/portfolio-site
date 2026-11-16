/**
 * Locale helpers for Server Components, metadata and route handlers.
 */
import "server-only";

import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { getPosts } from "@/lib/api/server";

import {
  DEFAULT_LOCALE,
  LOCALE_HEADER,
  LOCALES,
  isLocale,
  localePath,
  type Locale,
} from "./config";

/**
 * Resolves the [lang] segment, or 404s. The proxy only lets valid locales
 * through, so this only fires if it is bypassed.
 */
export async function localeFromParams(
  params: Promise<{ lang: string }>,
): Promise<Locale> {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return lang;
}

/**
 * For code that cannot see [lang]: the root layout and not-found pages.
 * Falls back to the default outside the public site (the CMS, say).
 */
export async function requestLocale(): Promise<Locale> {
  const value = (await headers()).get(LOCALE_HEADER);
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/**
 * `alternates` metadata for one page: its canonical URL, the same page in
 * every other locale (hreflang), and the feed once there is one.
 *
 * Every page sets this itself because Next.js replaces `alternates` wholesale
 * rather than merging it with the layout's.
 */
export async function alternatesFor(
  locale: Locale,
  path: string,
): Promise<Metadata["alternates"]> {
  const languages: Record<string, string> = {};
  for (const l of LOCALES) languages[l] = localePath(l, path);
  languages["x-default"] = localePath(DEFAULT_LOCALE, path);

  // Only advertise the feed once it has something in it; it 404s while the
  // blog is empty. The count rides the cached "posts" tag.
  const hasPosts = await getPosts({ limit: 1, locale })
    .then((r) => r.total > 0)
    .catch(() => false);

  return {
    canonical: localePath(locale, path),
    languages,
    ...(hasPosts
      ? { types: { "application/rss+xml": localePath(locale, "/feed.xml") } }
      : {}),
  };
}
