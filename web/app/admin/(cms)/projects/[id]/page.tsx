"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
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
import { MarkdownEditor } from "@/components/admin/markdown-editor";
import { MediaPicker } from "@/components/admin/media-picker";
import { AdminHeader } from "@/components/admin/shell";
import {
  createProject,
  getProject,
  revalidate,
  updateProject,
} from "@/lib/api/admin";
import type { DemoType, ProjectInput, Status } from "@/lib/api/types";

const EMPTY: ProjectInput = {
  slug: "",
  title: "",
  tagline: "",
  body_markdown: "",
  tech: [],
  repo_url: "",
  live_url: "",
  demo_type: "none",
  demo_url: "",
  cover_media_id: null,
  gallery_media_ids: [],
  featured: false,
  status: "draft",
  sort_order: 0,
};

/** What demo_url means for each demo type, shown under the field. */
const DEMO_HINTS: Record<DemoType, string> = {
  none: "No demo block is rendered.",
  iframe: "URL of the live site. It loads on click, inside a sandboxed frame.",
  video: "Direct URL to an .mp4 or .webm. Upload it under media first.",
  asciinema: "An asciinema.org URL, or just the cast id.",
  gallery: "Not used - the gallery images below are shown instead.",
};

export default function ProjectEditor() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const isNew = params.id === "new";

  const [form, setForm] = useState<ProjectInput>(EMPTY);
  const [status, setStatus] = useState<{
    kind: "idle" | "saving" | "saved" | "error";
    message?: string;
  }>({ kind: "idle" });
  const [loaded, setLoaded] = useState(isNew);

  useEffect(() => {
    if (isNew) return;
    getProject(params.id)
      .then((p) =>
        setForm({
          slug: p.slug,
          title: p.title,
          tagline: p.tagline,
          body_markdown: p.body_markdown,
          tech: p.tech,
          repo_url: p.repo_url,
          live_url: p.live_url,
          demo_type: p.demo_type,
          demo_url: p.demo_url,
          cover_media_id: p.cover_media_id ?? null,
          gallery_media_ids: p.gallery.map((m) => m.id),
          featured: p.featured,
          status: p.status,
          sort_order: p.sort_order,
        }),
      )
      .catch((err: unknown) =>
        setStatus({
          kind: "error",
          message:
            err instanceof Error ? err.message : "could not load project",
        }),
      )
      .finally(() => setLoaded(true));
  }, [isNew, params.id]);

  function set<K extends keyof ProjectInput>(key: K, value: ProjectInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    setStatus({ kind: "saving" });
    try {
      const saved = isNew
        ? await createProject(form)
        : await updateProject(params.id, form);
      await revalidate(["projects"]);
      setStatus({ kind: "saved" });
      if (isNew) router.replace(`/admin/projects/${saved.id}`);
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "could not save",
      });
    }
  }

  if (!loaded) {
    return <p className="font-mono text-[13px] text-faint">Loading…</p>;
  }

  return (
    <>
      <AdminHeader title={isNew ? "New project" : "Edit project"}>
        {!isNew && form.status === "published" ? (
          <Link
            href={`/projects/${form.slug}`}
            target="_blank"
            className="font-mono text-[13px] text-muted no-underline hover:text-accent"
          >
            view live
          </Link>
        ) : null}
        <StatusLine status={status} />
        <Button variant="primary" onClick={() => void save()}>
          save
        </Button>
      </AdminHeader>

      <div className="grid gap-5 lg:grid-cols-[1fr_17rem]">
        <div className="space-y-4">
          <Field label="title">
            <TextInput value={form.title} onChange={(v) => set("title", v)} />
          </Field>

          <Field
            label="tagline"
            hint="One line. It carries the project in every list."
          >
            <TextArea
              value={form.tagline}
              onChange={(v) => set("tagline", v)}
              rows={2}
            />
          </Field>

          <div>
            <span className="mb-1 block font-mono text-[12px] text-muted">
              case study
            </span>
            <MarkdownEditor
              value={form.body_markdown}
              onChange={(v) => set("body_markdown", v)}
              rows={16}
            />
          </div>

          <fieldset className="space-y-3 rounded border border-line p-3">
            <legend className="px-1 font-mono text-[12px] text-muted">
              demo
            </legend>

            <Field label="type">
              <Select<DemoType>
                value={form.demo_type}
                onChange={(v) => set("demo_type", v)}
                options={[
                  { value: "none", label: "none" },
                  { value: "iframe", label: "iframe - live site" },
                  { value: "video", label: "video - screen recording" },
                  { value: "asciinema", label: "asciinema - terminal" },
                  { value: "gallery", label: "gallery - screenshots" },
                ]}
              />
            </Field>

            {form.demo_type !== "none" && form.demo_type !== "gallery" ? (
              <Field label="demo url" hint={DEMO_HINTS[form.demo_type]}>
                <TextInput
                  value={form.demo_url}
                  onChange={(v) => set("demo_url", v)}
                />
              </Field>
            ) : (
              <p className="font-mono text-[11px] text-faint">
                {DEMO_HINTS[form.demo_type]}
              </p>
            )}

            <MediaPicker
              label="gallery images"
              multiple
              selected={form.gallery_media_ids}
              onChange={(ids) => set("gallery_media_ids", ids)}
            />
          </fieldset>
        </div>

        <aside className="space-y-4 lg:border-l lg:border-line lg:pl-5">
          <Field label="status">
            <Select<Status>
              value={form.status}
              onChange={(v) => set("status", v)}
              options={[
                { value: "draft", label: "draft" },
                { value: "published", label: "published" },
              ]}
            />
          </Field>

          <Toggle
            checked={form.featured}
            onChange={(v) => set("featured", v)}
            label="featured on the home page"
          />

          <Field label="sort order" hint="Lower numbers come first.">
            <TextInput
              type="number"
              value={String(form.sort_order)}
              onChange={(v) => set("sort_order", Number(v) || 0)}
            />
          </Field>

          <Field label="slug" hint="Leave blank to derive it from the title.">
            <TextInput
              value={form.slug}
              onChange={(v) => set("slug", v)}
              placeholder="auto"
            />
          </Field>

          <Field label="tech">
            <ListInput
              values={form.tech}
              onChange={(v) => set("tech", v)}
              placeholder="Go, Postgres…"
            />
          </Field>

          <Field label="repo url">
            <TextInput
              value={form.repo_url}
              onChange={(v) => set("repo_url", v)}
            />
          </Field>

          <Field label="live url">
            <TextInput
              value={form.live_url}
              onChange={(v) => set("live_url", v)}
            />
          </Field>

          <MediaPicker
            label="cover image"
            selected={form.cover_media_id ? [form.cover_media_id] : []}
            onChange={(ids) => set("cover_media_id", ids[0] ?? null)}
          />
        </aside>
      </div>
    </>
  );
}
