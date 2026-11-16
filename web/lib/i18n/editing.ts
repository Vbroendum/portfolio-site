/**
 * Helpers for CMS editors that edit one record in several languages.
 *
 * English is the record's base fields; every other locale lives in
 * `translations[locale]`. An editor holds one form plus an "active locale",
 * and reads and writes every translatable field through `translatable()`, so
 * switching the language tab swaps which copy of the text the inputs show.
 */
import type { Dispatch, SetStateAction } from "react";

import type { Locale, TranslatedLocale, Translations } from "@/lib/api/types";

import { DEFAULT_LOCALE } from "./config";

export type EditableLocale = Locale;

export function translatable<
  T extends object,
  F extends T & { translations: Translations<T> },
>(
  form: F,
  setForm: Dispatch<SetStateAction<F>>,
  locale: EditableLocale,
  empty: T,
) {
  const isBase = locale === DEFAULT_LOCALE;
  const target = locale as TranslatedLocale;
  const base: T = form;
  const current: T = { ...empty, ...(isBase ? {} : form.translations[target]) };

  return {
    /** The field in the active locale. */
    value<K extends keyof T>(key: K): T[K] {
      return isBase ? base[key] : current[key];
    },

    /**
     * What the public site shows when the active locale's field is empty: the
     * English text. Undefined while editing English itself.
     */
    fallback<K extends keyof T>(key: K): T[K] | undefined {
      return isBase ? undefined : base[key];
    },

    set<K extends keyof T>(key: K, value: T[K]) {
      setForm((f) =>
        isBase
          ? { ...f, [key]: value }
          : {
              ...f,
              translations: {
                ...f.translations,
                [target]: { ...empty, ...f.translations[target], [key]: value },
              },
            },
      );
    },
  };
}

/** True when a translation has any text in it, for the tab's "has content" mark. */
export function hasTranslation(value: object | undefined): boolean {
  if (!value) return false;
  return Object.values(value).some((v) =>
    Array.isArray(v) ? v.length > 0 : typeof v === "string" && v.trim() !== "",
  );
}
