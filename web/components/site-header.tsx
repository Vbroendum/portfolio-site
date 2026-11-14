"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/projects", label: "work" },
  { href: "/blog", label: "writing" },
  { href: "/cv", label: "cv" },
  { href: "/about", label: "about" },
];

/**
 * The header is deliberately quiet: the name on the left, four lowercase
 * mono links on the right, one hairline underneath. The active section is
 * marked by the accent rule under its label, not by colour alone.
 */
export function SiteHeader({
  name,
  showBlog,
}: {
  name: string;
  /** False while no post is published - see the note in app/(site)/layout.tsx. */
  showBlog: boolean;
}) {
  const pathname = usePathname();
  const nav = showBlog ? NAV : NAV.filter((item) => item.href !== "/blog");

  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-5xl items-baseline justify-between gap-6 px-5 py-5 sm:px-8">
        <Link
          href="/"
          className="text-lg no-underline transition-colors hover:text-accent"
        >
          {name}
        </Link>

        <nav aria-label="Primary">
          <ul className="flex items-baseline gap-4 font-mono text-[13px] sm:gap-6">
            {nav.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`inline-block border-b-2 pb-0.5 no-underline transition-colors ${
                      active
                        ? "border-accent text-fg"
                        : "border-transparent text-muted hover:text-fg"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </header>
  );
}
