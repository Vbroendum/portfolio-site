"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAuth } from "./auth-guard";

const NAV = [
  { href: "/admin", label: "overview", exact: true },
  { href: "/admin/posts", label: "posts" },
  { href: "/admin/projects", label: "projects" },
  { href: "/admin/cv", label: "cv" },
  { href: "/admin/media", label: "media" },
  { href: "/admin/settings", label: "settings" },
];

/** Sidebar + content frame for every CMS page. */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-8 px-5 py-6 sm:px-8 md:flex-row md:gap-10">
      <aside className="md:w-44 md:shrink-0">
        <div className="flex items-baseline justify-between gap-4 md:block">
          <Link
            href="/"
            className="font-mono text-[13px] text-muted no-underline hover:text-accent"
          >
            ← view site
          </Link>
        </div>

        <nav aria-label="CMS sections" className="mt-5">
          <ul className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[13px] md:block md:space-y-1">
            {NAV.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`no-underline transition-colors ${
                      active ? "text-accent" : "text-muted hover:text-fg"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="mt-8 border-t border-line pt-4 font-mono text-[12px] text-faint">
          <p className="truncate">{user?.email}</p>
          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-1 text-muted hover:text-danger"
          >
            sign out
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 pb-16">{children}</main>
    </div>
  );
}

/** Page header used across the CMS: title left, actions right. */
export function AdminHeader({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
      <h1 className="text-2xl">{title}</h1>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}
