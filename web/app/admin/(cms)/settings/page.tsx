"use client";

import { useEffect, useState } from "react";

import {
  Button,
  Field,
  StatusLine,
  TextInput,
} from "@/components/admin/fields";
import { LocaleTabs } from "@/components/admin/locale-tabs";
import { MarkdownEditor } from "@/components/admin/markdown-editor";
import { AdminHeader } from "@/components/admin/shell";
import { getSettings, putSetting, revalidate } from "@/lib/api/admin";
import type {
  AboutSettingsText,
  Locale,
  SiteSettingsText,
  Settings,
  SocialLink,
  TranslatedLocale,
} from "@/lib/api/types";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { hasTranslation } from "@/lib/i18n/editing";

const EMPTY: Settings = { site: {}, about: {}, socials: {} };

/**
 * Site-wide copy: the header name, the home page headline, the about page and
 * the footer links. These are the strings that appear on every page, so they
 * live in settings rather than in content.
 *
 * The language tab switches the translatable strings (headline, description,
 * location, the about page). The name, email and footer links are the same in
 * every language. Danish strings are stored inside each blob under
 * `translations.da`, which the public API overlays onto the English ones.
 */
export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(EMPTY);
  const [status, setStatus] = useState<{
    kind: "idle" | "saving" | "saved" | "error";
    message?: string;
  }>({ kind: "idle" });
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);
  const isBase = locale === DEFAULT_LOCALE;
  const tl = locale as TranslatedLocale;

  /** A site string in the active locale; "" when untranslated. */
  function siteText(key: keyof SiteSettingsText): string {
    return (
      (isBase ? settings.site[key] : settings.site.translations?.[tl]?.[key]) ??
      ""
    );
  }

  function setSiteText(key: keyof SiteSettingsText, value: string) {
    setSettings((s) => ({
      ...s,
      site: isBase
        ? { ...s.site, [key]: value }
        : {
            ...s.site,
            translations: {
              ...s.site.translations,
              [tl]: { ...s.site.translations?.[tl], [key]: value },
            },
          },
    }));
  }

  function aboutText(key: keyof AboutSettingsText): string {
    return (
      (isBase
        ? settings.about[key]
        : settings.about.translations?.[tl]?.[key]) ?? ""
    );
  }

  function setAboutText(key: keyof AboutSettingsText, value: string) {
    setSettings((s) => ({
      ...s,
      about: isBase
        ? { ...s.about, [key]: value }
        : {
            ...s.about,
            translations: {
              ...s.about.translations,
              [tl]: { ...s.about.translations?.[tl], [key]: value },
            },
          },
    }));
  }

  /** The English text, shown greyed in an empty translated field. */
  const fallback = (value: string | undefined) => (isBase ? undefined : value);
  const shared = isBase ? undefined : "Same in every language.";

  useEffect(() => {
    getSettings()
      .then((s) =>
        setSettings({
          site: s.site ?? {},
          about: s.about ?? {},
          socials: { links: s.socials?.links ?? [] },
        }),
      )
      .catch((err: unknown) =>
        setStatus({
          kind: "error",
          message:
            err instanceof Error ? err.message : "could not load settings",
        }),
      );
  }, []);

  async function save() {
    setStatus({ kind: "saving" });
    try {
      await putSetting("site", settings.site);
      await putSetting("about", settings.about);
      await putSetting("socials", { links: settings.socials.links ?? [] });
      await revalidate(["settings"]);
      setStatus({ kind: "saved" });
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "could not save",
      });
    }
  }

  const links = settings.socials.links ?? [];

  function setLinks(next: SocialLink[]) {
    setSettings((s) => ({ ...s, socials: { links: next } }));
  }

  return (
    <>
      <AdminHeader title="Settings">
        <StatusLine status={status} />
        <Button variant="primary" onClick={() => void save()}>
          save
        </Button>
      </AdminHeader>

      <div className="max-w-2xl space-y-8">
        <LocaleTabs
          value={locale}
          onChange={setLocale}
          filled={{
            da:
              hasTranslation(settings.site.translations?.da) ||
              hasTranslation(settings.about.translations?.da),
          }}
        />

        <section className="space-y-4">
          <h2 className="border-b border-line pb-1 font-mono text-[12px] text-muted">
            site
          </h2>

          <Field
            label="name"
            hint={shared ?? "Appears in the header and browser tab."}
          >
            <TextInput
              value={settings.site.title ?? ""}
              onChange={(v) =>
                setSettings((s) => ({ ...s, site: { ...s.site, title: v } }))
              }
            />
          </Field>

          <Field
            label="headline"
            hint="The first line on the home page. Say what you build, plainly."
          >
            <TextInput
              value={siteText("tagline")}
              onChange={(v) => setSiteText("tagline", v)}
              placeholder={fallback(settings.site.tagline)}
              lang={locale}
            />
          </Field>

          <Field
            label="description"
            hint="One or two sentences under the headline. Also the default meta description."
          >
            <TextInput
              value={siteText("description")}
              onChange={(v) => setSiteText("description", v)}
              placeholder={fallback(settings.site.description)}
              lang={locale}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="email" hint={shared}>
              <TextInput
                value={settings.site.email ?? ""}
                onChange={(v) =>
                  setSettings((s) => ({ ...s, site: { ...s.site, email: v } }))
                }
              />
            </Field>
            <Field label="location">
              <TextInput
                value={siteText("location")}
                onChange={(v) => setSiteText("location", v)}
                placeholder={fallback(settings.site.location)}
                lang={locale}
              />
            </Field>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="border-b border-line pb-1 font-mono text-[12px] text-muted">
            about page
          </h2>

          <Field label="heading">
            <TextInput
              value={aboutText("heading")}
              onChange={(v) => setAboutText("heading", v)}
              placeholder={fallback(settings.about.heading)}
              lang={locale}
            />
          </Field>

          <div>
            <span className="mb-1 block font-mono text-[12px] text-muted">
              body
            </span>
            <MarkdownEditor
              key={locale}
              value={aboutText("body_markdown")}
              onChange={(v) => setAboutText("body_markdown", v)}
              placeholder={fallback(settings.about.body_markdown) || undefined}
              rows={12}
              lang={locale}
            />
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="border-b border-line pb-1 font-mono text-[12px] text-muted">
            footer links
          </h2>
          {shared ? (
            <p className="font-mono text-[11px] text-faint">{shared}</p>
          ) : null}

          <ul className="space-y-2">
            {links.map((link, i) => (
              <li key={i} className="flex gap-2">
                <input
                  value={link.label}
                  placeholder="label"
                  onChange={(e) =>
                    setLinks(
                      links.map((l, j) =>
                        j === i ? { ...l, label: e.target.value } : l,
                      ),
                    )
                  }
                  className="w-32 rounded border border-line bg-ink px-2 py-1.5 font-mono text-[13px] focus:border-accent-dim focus:outline-none"
                />
                <input
                  value={link.url}
                  placeholder="https://"
                  onChange={(e) =>
                    setLinks(
                      links.map((l, j) =>
                        j === i ? { ...l, url: e.target.value } : l,
                      ),
                    )
                  }
                  className="min-w-0 flex-1 rounded border border-line bg-ink px-2 py-1.5 font-mono text-[13px] focus:border-accent-dim focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setLinks(links.filter((_, j) => j !== i))}
                  className="px-1 font-mono text-[13px] text-faint hover:text-danger"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>

          <Button onClick={() => setLinks([...links, { label: "", url: "" }])}>
            add link
          </Button>
        </section>
      </div>
    </>
  );
}
