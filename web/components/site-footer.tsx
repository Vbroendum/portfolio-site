import Link from "next/link";

import type { SocialLink } from "@/lib/api/types";

export function SiteFooter({
  email,
  location,
  links,
  showRss,
}: {
  email?: string;
  location?: string;
  links: SocialLink[];
  /** An empty feed is worse than no feed, so the link waits for a post. */
  showRss: boolean;
}) {
  return (
    <footer className="mt-24 border-t border-line">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-5 py-8 font-mono text-[13px] text-muted sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          {email ? (
            <a href={`mailto:${email}`} className="hover:text-fg">
              {email}
            </a>
          ) : null}
          {location ? <span className="text-faint">{location}</span> : null}
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          {links.map((link) => (
            <a
              key={link.url}
              href={link.url}
              target="_blank"
              rel="me noreferrer"
              className="hover:text-fg"
            >
              {link.label}
            </a>
          ))}
          {showRss ? (
            <Link href="/feed.xml" className="hover:text-fg">
              rss
            </Link>
          ) : null}
        </div>
      </div>
    </footer>
  );
}
