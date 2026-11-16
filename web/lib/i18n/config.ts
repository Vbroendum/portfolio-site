/**
 * Locale configuration shared by the proxy, server components and client
 * components. Nothing here may import server-only code.
 *
 * Mirrors models.Locale in the Go API: adding a locale means adding it there,
 * to LOCALES below, and to the dictionaries.
 */
import type { Locale } from "@/lib/api/types";

export type { Locale } from "@/lib/api/types";

export const LOCALES = ["en", "da"] as const satisfies readonly Locale[];

/**
 * The locale whose text lives in the base fields of every record. Danish is
 * stored as a translation on top of it, and falls back to it field by field.
 */
export const DEFAULT_LOCALE: Locale = "en";

/** Remembers the visitor's last locale so "/" sends them back to it. */
export const LOCALE_COOKIE = "locale";

/**
 * Set by proxy.ts on every locale-prefixed request. The root layout reads it
 * for <html lang>, since it sits above the [lang] segment and cannot see it.
 */
export const LOCALE_HEADER = "x-site-locale";

/** BCP 47 tags for Intl date formatting. */
export const INTL_LOCALE: Record<Locale, string> = {
  en: "en-GB",
  da: "da-DK",
};

/** Open Graph wants language_TERRITORY. */
export const OG_LOCALE: Record<Locale, string> = {
  en: "en_GB",
  da: "da_DK",
};

export function isLocale(value: unknown): value is Locale {
  return (LOCALES as readonly unknown[]).includes(value);
}

/** "/blog/x" -> "/da/blog/x"; "/" -> "/da". */
export function localePath(locale: Locale, path = "/"): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return clean === "/" ? `/${locale}` : `/${locale}${clean}`;
}

/** "/da/blog/x" -> "/blog/x"; "/da" -> "/". Unprefixed paths pass through. */
export function stripLocale(pathname: string): string {
  const [, first, ...rest] = pathname.split("/");
  if (!isLocale(first)) return pathname;
  return `/${rest.join("/")}`;
}

/**
 * Picks the best supported locale from an Accept-Language header. Quality
 * values are honoured; region subtags are ignored ("da-DK" counts as "da").
 * Anything unsupported (Swedish and Norwegian included) gets the default.
 */
export function negotiateLocale(header: string | null | undefined): Locale {
  if (!header) return DEFAULT_LOCALE;
  const ranked = header
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params
        .map((p) => p.trim())
        .find((p) => p.startsWith("q="));
      return {
        lang: tag.trim().toLowerCase().split("-")[0],
        q: q ? Number(q.slice(2)) || 0 : 1,
        index,
      };
    })
    .filter((entry) => entry.lang && entry.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index);

  for (const { lang } of ranked) {
    if (isLocale(lang)) return lang;
  }
  return DEFAULT_LOCALE;
}
