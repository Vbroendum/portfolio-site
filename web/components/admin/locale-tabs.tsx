"use client";

import type { Locale } from "@/lib/api/types";
import { DEFAULT_LOCALE, LOCALES } from "@/lib/i18n/config";

const NAMES: Record<Locale, string> = { en: "english", da: "dansk" };

/**
 * The language switch above an editor's translatable fields. Fields that are
 * the same in every language (slug, tags, dates, media) sit outside it.
 *
 * A dot marks a language that has any text yet, so an untranslated record is
 * visible at a glance.
 */
export function LocaleTabs({
  value,
  onChange,
  filled,
}: {
  value: Locale;
  onChange: (locale: Locale) => void;
  /** Which locales have content. The default locale always counts. */
  filled?: Partial<Record<Locale, boolean>>;
}) {
  return (
    <div className="space-y-1.5">
      <div
        role="tablist"
        aria-label="Content language"
        className="inline-flex gap-1 rounded border border-line p-0.5"
      >
        {LOCALES.map((locale) => {
          const active = locale === value;
          const hasText = locale === DEFAULT_LOCALE || filled?.[locale];
          return (
            <button
              key={locale}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(locale)}
              className={`flex items-center gap-1.5 rounded px-2.5 py-1 font-mono text-[12px] transition-colors ${
                active ? "bg-raised text-fg" : "text-muted hover:text-fg"
              }`}
            >
              {NAMES[locale]}
              <span
                aria-hidden
                className={`h-1.5 w-1.5 rounded-full ${hasText ? "bg-accent" : "bg-line"}`}
              />
            </button>
          );
        })}
      </div>
      {value !== DEFAULT_LOCALE ? (
        <p className="font-mono text-[11px] text-faint">
          Leave a field empty to show the English text on /{value}. The grey
          text in an empty field is what visitors will see.
        </p>
      ) : null}
    </div>
  );
}
