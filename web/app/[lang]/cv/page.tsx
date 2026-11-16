import type { Metadata } from "next";

import { Markdown } from "@/components/markdown";
import { Chip, EmptyState, SectionHead } from "@/components/ui";
import { FALLBACK_SETTINGS, getCV, getSettings } from "@/lib/api/server";
import type { CVEntry, CVKind } from "@/lib/api/types";
import { INTL_LOCALE, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { alternatesFor, localeFromParams } from "@/lib/i18n/server";

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await localeFromParams(params);
  const dict = getDictionary(locale);
  return {
    title: dict.cv.title,
    description: dict.cv.description,
    alternates: await alternatesFor(locale, "/cv"),
  };
}

/**
 * Section order on the page; the labels come from the dictionary. Entries of
 * other kinds are not shown.
 */
const SECTIONS: CVKind[] = [
  "experience",
  "education",
  "certification",
  "skill",
  "other",
];

export default async function CVPage({ params }: Props) {
  const locale = await localeFromParams(params);
  const dict = getDictionary(locale);
  const [cv, settings] = await Promise.all([
    getCV(locale).catch(() => ({ items: [] as CVEntry[] })),
    getSettings(locale).catch(() => FALLBACK_SETTINGS),
  ]);

  const byKind = new Map<CVKind, CVEntry[]>();
  for (const entry of cv.items) {
    byKind.set(entry.kind, [...(byKind.get(entry.kind) ?? []), entry]);
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-14 sm:px-8">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="text-3xl">{dict.cv.title}</h1>
        {settings.site?.email ? (
          <a
            href={`mailto:${settings.site.email}`}
            className="font-mono text-[13px] text-muted no-underline hover:text-accent"
          >
            {settings.site.email}
          </a>
        ) : null}
      </div>

      {cv.items.length === 0 ? (
        <div className="mt-10">
          <EmptyState authoringHint="Add entries in the CMS at /admin/cv.">
            {dict.cv.empty}
          </EmptyState>
        </div>
      ) : null}

      <div className="mt-12 space-y-14">
        {SECTIONS.map((kind) => {
          const entries = byKind.get(kind);
          if (!entries || entries.length === 0) return null;

          return (
            <section key={kind}>
              <SectionHead title={dict.cv[kind]} />
              {kind === "skill" ? (
                <SkillGroups entries={entries} />
              ) : (
                <ul className="space-y-8">
                  {entries.map((entry) => (
                    <li key={entry.id}>
                      <Entry entry={entry} locale={locale} now={dict.cv.now} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Skills are chips, optionally bucketed: a skill entry's `organization` field
 * doubles as its group label ("Core stack", "Tools", "Languages"). Leave the
 * field empty in the CMS and the chips render as one ungrouped row.
 *
 * Groups appear in the order their first entry does, which is `sort_order`, so
 * reordering a group means renumbering its entries.
 */
function SkillGroups({ entries }: { entries: CVEntry[] }) {
  const groups: { label: string; items: CVEntry[] }[] = [];
  for (const entry of entries) {
    const label = entry.organization;
    const last = groups.at(-1);
    if (last && last.label === label) last.items.push(entry);
    else groups.push({ label, items: [entry] });
  }

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <div
          key={group.label || "ungrouped"}
          className="grid gap-2 sm:grid-cols-[10rem_1fr] sm:gap-6"
        >
          {group.label ? (
            <p className="font-mono text-[13px] text-faint sm:pt-0.5">
              {group.label}
            </p>
          ) : (
            <span className="hidden sm:block" />
          )}
          <div className="flex flex-wrap gap-1.5">
            {group.items.map((entry) => (
              <Chip key={entry.id}>{entry.title}</Chip>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Dates sit in a fixed left column on wide screens so roles line up into a
 * readable timeline; on mobile they stack above the title.
 */
function Entry({
  entry,
  locale,
  now,
}: {
  entry: CVEntry;
  locale: Locale;
  now: string;
}) {
  return (
    <div className="grid gap-1 sm:grid-cols-[10rem_1fr] sm:gap-6">
      <p className="font-mono text-[13px] text-faint sm:pt-1">
        {formatRange(entry, locale, now)}
      </p>

      <div>
        <h3 className="text-lg">
          {entry.title}
          {entry.organization ? (
            <span className="text-muted"> · {entry.organization}</span>
          ) : null}
        </h3>
        {entry.location ? (
          <p className="font-mono text-[12px] text-faint">{entry.location}</p>
        ) : null}

        {entry.description_markdown ? (
          <div className="mt-2">
            <Markdown>{entry.description_markdown}</Markdown>
          </div>
        ) : null}

        {entry.highlights.length > 0 ? (
          <ul className="mt-2 space-y-1 text-muted">
            {entry.highlights.map((h) => (
              <li key={h} className="before:mr-2 before:text-faint before:content-['-']">
                {h}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

function formatRange(entry: CVEntry, locale: Locale, now: string): string {
  const start = formatMonth(entry.start_date, locale);
  const end = entry.is_current ? now : formatMonth(entry.end_date, locale);
  if (!start && !end) return "";
  if (!end) return start;
  return `${start} - ${end}`;
}

function formatMonth(value: string | null | undefined, locale: Locale): string {
  if (!value) return "";
  return new Date(value).toLocaleDateString(INTL_LOCALE[locale], {
    month: "short",
    year: "numeric",
  });
}
