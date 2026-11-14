import type { Metadata } from "next";

import { Markdown } from "@/components/markdown";
import { EmptyState } from "@/components/ui";
import { FALLBACK_SETTINGS, getSettings } from "@/lib/api/server";

export const metadata: Metadata = { title: "About" };

export default async function AboutPage() {
  const settings = await getSettings().catch(() => FALLBACK_SETTINGS);
  const about = settings.about ?? {};
  const socials = settings.socials?.links ?? [];

  return (
    <div className="mx-auto max-w-5xl px-5 py-14 sm:px-8">
      <h1 className="text-3xl">{about.heading || "About"}</h1>

      <div className="mt-8">
        {about.body_markdown ? (
          <Markdown>{about.body_markdown}</Markdown>
        ) : (
          <EmptyState hint="Write it in the CMS at /admin/settings.">
            Nothing here yet.
          </EmptyState>
        )}
      </div>

      {socials.length > 0 ? (
        <ul className="mt-12 flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-6 font-mono text-[13px]">
          {socials.map((link) => (
            <li key={link.url}>
              <a
                href={link.url}
                target="_blank"
                rel="me noreferrer"
                className="text-muted no-underline hover:text-accent"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
