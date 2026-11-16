"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  LOCALES,
  localePath,
  stripLocale,
  type Locale,
} from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";

const NAV = [
  { path: "/projects", key: "work" },
  { path: "/blog", key: "writing" },
  { path: "/cv", key: "cv" },
  { path: "/about", key: "about" },
] as const;

/**
 * The header is deliberately quiet: the name on the left, four lowercase
 * mono links on the right, one hairline underneath. The active section is
 * marked by the accent rule under its label, not by colour alone.
 *
 * The language switch sits after the nav, quieter still, and keeps the
 * visitor on the same page in the other language.
 */
export function SiteHeader({
  locale,
  name,
  showBlog,
  labels,
}: {
  locale: Locale;
  name: string;
  /** False while no post is published - see the note in app/[lang]/layout.tsx. */
  showBlog: boolean;
  labels: Dictionary["nav"];
}) {
  const pathname = usePathname();
  const current = stripLocale(pathname);
  const nav = showBlog ? NAV : NAV.filter((item) => item.path !== "/blog");
  const other = LOCALES.find((l) => l !== locale) ?? locale;

  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-5xl flex-wrap items-baseline justify-between gap-x-6 gap-y-3 px-5 py-5 sm:px-8">
        <Link
          href={localePath(locale)}
          className="text-lg no-underline transition-colors hover:text-accent"
        >
          {name}
        </Link>

        <div className="flex items-baseline gap-4 font-mono text-[13px] sm:gap-6">
          <nav aria-label={labels.label}>
            <ul className="flex items-baseline gap-4 sm:gap-6">
              {nav.map((item) => {
                const active =
                  current === item.path ||
                  current.startsWith(`${item.path}/`);
                return (
                  <li key={item.path}>
                    <Link
                      href={localePath(locale, item.path)}
                      aria-current={active ? "page" : undefined}
                      className={`inline-block border-b-2 pb-0.5 no-underline transition-colors ${
                        active
                          ? "border-accent text-fg"
                          : "border-transparent text-muted hover:text-fg"
                      }`}
                    >
                      {labels[item.key]}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <Link
            href={localePath(other, current)}
            hrefLang={other}
            lang={other}
            aria-label={labels.switchLanguageLabel}
            className="border-l border-line pl-4 text-faint no-underline transition-colors hover:text-fg sm:pl-6"
          >
            {labels.switchLanguage}
          </Link>
        </div>
      </div>
    </header>
  );
}
