import { NextResponse, type NextRequest } from "next/server";

import {
  LOCALE_COOKIE,
  LOCALE_HEADER,
  isLocale,
  localePath,
  negotiateLocale,
} from "@/lib/i18n/config";

/**
 * Locale routing for the public site.
 *
 *   /da/...   served as is, with the locale passed on as a request header for
 *             the root layout's <html lang>, and remembered in a cookie.
 *   /blog/x   redirected to /<locale>/blog/x, where the locale is the cookie
 *             if the visitor has been here before, else Accept-Language, else
 *             English.
 *
 * The CMS and the Next.js route handlers have no locale and are left alone.
 * So are files: the matcher skips any path with a dot in it (feed.xml,
 * sitemap.xml, robots.txt, icon.svg, everything in public/). Slugs never
 * contain dots, so no page is skipped by accident.
 */
const UNLOCALIZED = /^\/(admin|api)(\/|$)/;

const ONE_YEAR = 60 * 60 * 24 * 365;

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (UNLOCALIZED.test(pathname)) return NextResponse.next();

  const first = pathname.split("/")[1];
  if (isLocale(first)) {
    const headers = new Headers(request.headers);
    headers.set(LOCALE_HEADER, first);
    const response = NextResponse.next({ request: { headers } });
    if (request.cookies.get(LOCALE_COOKIE)?.value !== first) {
      response.cookies.set(LOCALE_COOKIE, first, {
        path: "/",
        maxAge: ONE_YEAR,
        sameSite: "lax",
      });
    }
    return response;
  }

  const remembered = request.cookies.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(remembered)
    ? remembered
    : negotiateLocale(request.headers.get("accept-language"));

  const target = new URL(localePath(locale, pathname) + search, request.url);
  const response = NextResponse.redirect(target, 307);
  // The target depends on the cookie and Accept-Language, so no shared cache
  // may hand one visitor's redirect to another.
  response.headers.set("Vary", "Accept-Language, Cookie");
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/((?!_next/|.*\\..*).*)"],
};
