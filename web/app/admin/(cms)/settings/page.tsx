"use client";

import { useEffect, useState } from "react";

import {
  Button,
  Field,
  StatusLine,
  TextInput,
} from "@/components/admin/fields";
import { MarkdownEditor } from "@/components/admin/markdown-editor";
import { AdminHeader } from "@/components/admin/shell";
import { getSettings, putSetting, revalidate } from "@/lib/api/admin";
import type { Settings, SocialLink } from "@/lib/api/types";

const EMPTY: Settings = { site: {}, about: {}, socials: {} };

/**
 * Site-wide copy: the header name, the home page headline, the about page and
 * the footer links. These are the strings that appear on every page, so they
 * live in settings rather than in content.
 */
export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(EMPTY);
  const [status, setStatus] = useState<{
    kind: "idle" | "saving" | "saved" | "error";
    message?: string;
  }>({ kind: "idle" });

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
        <section className="space-y-4">
          <h2 className="border-b border-line pb-1 font-mono text-[12px] text-muted">
            site
          </h2>

          <Field label="name" hint="Appears in the header and browser tab.">
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
              value={settings.site.tagline ?? ""}
              onChange={(v) =>
                setSettings((s) => ({ ...s, site: { ...s.site, tagline: v } }))
              }
            />
          </Field>

          <Field
            label="description"
            hint="One or two sentences under the headline. Also the default meta description."
          >
            <TextInput
              value={settings.site.description ?? ""}
              onChange={(v) =>
                setSettings((s) => ({
                  ...s,
                  site: { ...s.site, description: v },
                }))
              }
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="email">
              <TextInput
                value={settings.site.email ?? ""}
                onChange={(v) =>
                  setSettings((s) => ({ ...s, site: { ...s.site, email: v } }))
                }
              />
            </Field>
            <Field label="location">
              <TextInput
                value={settings.site.location ?? ""}
                onChange={(v) =>
                  setSettings((s) => ({
                    ...s,
                    site: { ...s.site, location: v },
                  }))
                }
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
              value={settings.about.heading ?? ""}
              onChange={(v) =>
                setSettings((s) => ({ ...s, about: { ...s.about, heading: v } }))
              }
            />
          </Field>

          <div>
            <span className="mb-1 block font-mono text-[12px] text-muted">
              body
            </span>
            <MarkdownEditor
              value={settings.about.body_markdown ?? ""}
              onChange={(v) =>
                setSettings((s) => ({
                  ...s,
                  about: { ...s.about, body_markdown: v },
                }))
              }
              rows={12}
            />
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="border-b border-line pb-1 font-mono text-[12px] text-muted">
            footer links
          </h2>

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
