"use client";

import { useEffect, useState } from "react";

import {
  Button,
  Field,
  ListInput,
  Select,
  StatusLine,
  TextArea,
  TextInput,
  Toggle,
} from "@/components/admin/fields";
import { LocaleTabs } from "@/components/admin/locale-tabs";
import { AdminHeader } from "@/components/admin/shell";
import {
  createCV,
  deleteCV,
  listCV,
  revalidate,
  updateCV,
} from "@/lib/api/admin";
import type {
  CVEntry,
  CVEntryInput,
  CVEntryTranslation,
  CVKind,
  Locale,
} from "@/lib/api/types";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { hasTranslation, translatable } from "@/lib/i18n/editing";

const KINDS: { value: CVKind; label: string }[] = [
  { value: "experience", label: "experience" },
  { value: "education", label: "education" },
  { value: "certification", label: "certification" },
  { value: "skill", label: "skill" },
  { value: "other", label: "other" },
];

const EMPTY: CVEntryInput = {
  kind: "experience",
  title: "",
  organization: "",
  location: "",
  start_date: null,
  end_date: null,
  is_current: false,
  description_markdown: "",
  highlights: [],
  sort_order: 0,
  translations: {},
};

const EMPTY_TRANSLATION: CVEntryTranslation = {
  title: "",
  organization: "",
  location: "",
  description_markdown: "",
  highlights: [],
};

/**
 * The CV is edited as a flat list with an inline form - there are rarely more
 * than a dozen entries, so a separate editor route would be overkill.
 */
export default function CVPage() {
  const [entries, setEntries] = useState<CVEntry[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<CVEntryInput>(EMPTY);
  const [status, setStatus] = useState<{
    kind: "idle" | "saving" | "saved" | "error";
    message?: string;
  }>({ kind: "idle" });
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);
  const t = translatable(form, setForm, locale, EMPTY_TRANSLATION);

  async function refresh() {
    const res = await listCV();
    setEntries(res.items);
  }

  useEffect(() => {
    let cancelled = false;
    listCV()
      .then((res) => {
        if (!cancelled) setEntries(res.items);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setStatus({
            kind: "error",
            message: err instanceof Error ? err.message : "could not load cv",
          });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function startNew() {
    setEditing("new");
    setForm(EMPTY);
  }

  function startEdit(entry: CVEntry) {
    setEditing(entry.id);
    setForm({
      kind: entry.kind,
      title: entry.title,
      organization: entry.organization,
      location: entry.location,
      start_date: entry.start_date ?? null,
      end_date: entry.end_date ?? null,
      is_current: entry.is_current,
      description_markdown: entry.description_markdown,
      highlights: entry.highlights,
      sort_order: entry.sort_order,
      translations: entry.translations ?? {},
    });
  }

  function set<K extends keyof CVEntryInput>(key: K, value: CVEntryInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    setStatus({ kind: "saving" });
    try {
      if (editing === "new") await createCV(form);
      else if (editing) await updateCV(editing, form);
      await revalidate(["cv"]);
      await refresh();
      setEditing(null);
      setStatus({ kind: "saved" });
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "could not save",
      });
    }
  }

  async function remove(entry: CVEntry) {
    if (!confirm(`Delete "${entry.title}"?`)) return;
    await deleteCV(entry.id);
    await revalidate(["cv"]);
    await refresh();
  }

  return (
    <>
      <AdminHeader title="CV">
        <StatusLine status={status} />
        <Button variant="primary" onClick={startNew}>
          new entry
        </Button>
      </AdminHeader>

      {editing ? (
        <div className="mb-8 space-y-4 rounded border border-accent-dim bg-accent-wash/40 p-4">
          <LocaleTabs
            value={locale}
            onChange={setLocale}
            filled={{ da: hasTranslation(form.translations.da) }}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="kind">
              <Select<CVKind>
                value={form.kind}
                onChange={(v) => set("kind", v)}
                options={KINDS}
              />
            </Field>
            <Field label="sort order" hint="Lower numbers come first.">
              <TextInput
                type="number"
                value={String(form.sort_order)}
                onChange={(v) => set("sort_order", Number(v) || 0)}
              />
            </Field>
            <Field
              label="title"
              hint="The role, degree, or - for skills - the skill itself."
            >
              <TextInput
                value={t.value("title")}
                onChange={(v) => t.set("title", v)}
                placeholder={t.fallback("title")}
                lang={locale}
              />
            </Field>
            <Field label="organization">
              <TextInput
                value={t.value("organization")}
                onChange={(v) => t.set("organization", v)}
                placeholder={t.fallback("organization")}
                lang={locale}
              />
            </Field>
            <Field label="location">
              <TextInput
                value={t.value("location")}
                onChange={(v) => t.set("location", v)}
                placeholder={t.fallback("location")}
                lang={locale}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="start">
                <TextInput
                  type="date"
                  value={form.start_date ?? ""}
                  onChange={(v) => set("start_date", v || null)}
                />
              </Field>
              <Field label="end">
                <TextInput
                  type="date"
                  value={form.end_date ?? ""}
                  onChange={(v) => set("end_date", v || null)}
                />
              </Field>
            </div>
          </div>

          <Toggle
            checked={form.is_current}
            onChange={(v) => set("is_current", v)}
            label="still here (shows as 'now')"
          />

          <Field label="description" hint="Markdown. Keep it to a sentence or two.">
            <TextArea
              value={t.value("description_markdown")}
              onChange={(v) => t.set("description_markdown", v)}
              placeholder={t.fallback("description_markdown")}
              rows={3}
              lang={locale}
            />
          </Field>

          <Field
            label="highlights"
            hint={
              locale === DEFAULT_LOCALE
                ? "Short bullets, one per entry."
                : "Short bullets. Leave empty to show all the English ones."
            }
          >
            <ListInput
              key={locale}
              values={t.value("highlights")}
              onChange={(v) => t.set("highlights", v)}
              placeholder={t.fallback("highlights")?.join(", ") || undefined}
            />
          </Field>

          <div className="flex gap-2">
            <Button variant="primary" onClick={() => void save()}>
              save entry
            </Button>
            <Button onClick={() => setEditing(null)}>cancel</Button>
          </div>
        </div>
      ) : null}

      {KINDS.map(({ value, label }) => {
        const group = entries.filter((e) => e.kind === value);
        if (group.length === 0) return null;
        return (
          <section key={value} className="mb-8">
            <h2 className="mb-2 border-b border-line pb-1 font-mono text-[12px] text-muted">
              {label}
            </h2>
            <ul className="divide-y divide-line">
              {group.map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-2.5"
                >
                  <span className="w-8 font-mono text-[12px] text-faint">
                    {entry.sort_order}
                  </span>
                  <button
                    type="button"
                    onClick={() => startEdit(entry)}
                    className="min-w-0 flex-1 truncate text-left hover:text-accent"
                  >
                    {entry.title}
                    {entry.organization ? (
                      <span className="text-muted"> · {entry.organization}</span>
                    ) : null}
                  </button>
                  <span className="font-mono text-[12px] text-faint">
                    {entry.start_date ?? ""}
                    {entry.is_current ? " → now" : entry.end_date ? ` → ${entry.end_date}` : ""}
                  </span>
                  <button
                    type="button"
                    onClick={() => void remove(entry)}
                    className="font-mono text-[12px] text-faint hover:text-danger"
                  >
                    delete
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {entries.length === 0 ? (
        <p className="font-mono text-[13px] text-faint">
          No entries yet. Add your current role first.
        </p>
      ) : null}
    </>
  );
}
