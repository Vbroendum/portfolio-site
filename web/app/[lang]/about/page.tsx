import type { Metadata } from "next";

import { Markdown } from "@/components/markdown";
import { EmptyState } from "@/components/ui";
import { FALLBACK_SETTINGS, getSettings } from "@/lib/api/server";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { alternatesFor, localeFromParams } from "@/lib/i18n/server";

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await localeFromParams(params);
  return {
    title: getDictionary(locale).about.title,
    alternates: await alternatesFor(locale, "/about"),
  };
}

export default async function AboutPage({ params }: Props) {
  const locale = await localeFromParams(params);
  const dict = getDictionary(locale);
  const settings = await getSettings(locale).catch(() => FALLBACK_SETTINGS);
  const about = settings.about ?? {};
  const socials = settings.socials?.links ?? [];

  return (
    <div className="mx-auto max-w-5xl px-5 py-14 sm:px-8">
      <h1 className="text-3xl">{about.heading || dict.about.title}</h1>

      <div className="mt-8">
        {about.body_markdown ? (
          <Markdown>{about.body_markdown}</Markdown>
        ) : (
          <EmptyState authoringHint="Write it in the CMS at /admin/settings.">
            {dict.about.empty}
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
