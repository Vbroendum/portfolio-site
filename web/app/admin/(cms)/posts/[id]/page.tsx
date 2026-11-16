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
} from "@/components/admin/fields";
import { LocaleTabs } from "@/components/admin/locale-tabs";
import { MarkdownEditor } from "@/components/admin/markdown-editor";
import { MediaPicker } from "@/components/admin/media-picker";
import { AdminHeader } from "@/components/admin/shell";
import {
  createPost,
  getPost,
  revalidate,
  updatePost,
} from "@/lib/api/admin";
import type {
  Locale,
  PostInput,
  PostTranslation,
  Status,
} from "@/lib/api/types";
import { DEFAULT_LOCALE, localePath } from "@/lib/i18n/config";
import { hasTranslation, translatable } from "@/lib/i18n/editing";

const EMPTY: PostInput = {
  slug: "",
  title: "",
  summary: "",
  body_markdown: "",
  cover_media_id: null,
  tags: [],
  status: "draft",
  published_at: null,
  translations: {},
};

const EMPTY_TRANSLATION: PostTranslation = {
  title: "",
  summary: "",
  body_markdown: "",
};

/**
 * One editor for both create and edit: the route param is either "new" or a
 * post id. Saving a new post redirects to its real id so a refresh keeps
 * editing the same record.
 */
export default function PostEditor() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const isNew = params.id === "new";

  const [form, setForm] = useState<PostInput>(EMPTY);
  const [status, setStatus] = useState<{
    kind: "idle" | "saving" | "saved" | "error";
    message?: string;
  }>({ kind: "idle" });
  const [loaded, setLoaded] = useState(isNew);
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);
  const t = translatable(form, setForm, locale, EMPTY_TRANSLATION);

  useEffect(() => {
    if (isNew) return;
    getPost(params.id)
      .then((post) =>
        setForm({
          slug: post.slug,
          title: post.title,
          summary: post.summary,
          body_markdown: post.body_markdown,
          cover_media_id: post.cover_media_id ?? null,
          tags: post.tags,
          status: post.status,
          published_at: post.published_at ?? null,
          translations: post.translations ?? {},
        }),
      )
      .catch((err: unknown) =>
        setStatus({
          kind: "error",
          message: err instanceof Error ? err.message : "could not load post",
        }),
      )
      .finally(() => setLoaded(true));
  }, [isNew, params.id]);

  function set<K extends keyof PostInput>(key: K, value: PostInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    setStatus({ kind: "saving" });
    try {
      const saved = isNew
        ? await createPost(form)
        : await updatePost(params.id, form);
      await revalidate(["posts"]);
      setStatus({ kind: "saved" });
      if (isNew) router.replace(`/admin/posts/${saved.id}`);
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
      <AdminHeader title={isNew ? "New post" : "Edit post"}>
        {!isNew && form.status === "published" ? (
          <Link
            href={localePath(locale, `/blog/${form.slug}`)}
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
          <LocaleTabs
            value={locale}
            onChange={setLocale}
            filled={{ da: hasTranslation(form.translations.da) }}
          />

          <Field label="title">
            <TextInput
              value={t.value("title")}
              onChange={(v) => t.set("title", v)}
              placeholder={t.fallback("title") || "What is this post called?"}
              lang={locale}
            />
          </Field>

          <Field
            label="summary"
            hint="Shown in the post list and used as the meta description."
          >
            <TextArea
              value={t.value("summary")}
              onChange={(v) => t.set("summary", v)}
              placeholder={t.fallback("summary")}
              rows={2}
              lang={locale}
            />
          </Field>

          <div>
            <span className="mb-1 block font-mono text-[12px] text-muted">
              body
            </span>
            <MarkdownEditor
              key={locale}
              value={t.value("body_markdown")}
              onChange={(v) => t.set("body_markdown", v)}
              placeholder={t.fallback("body_markdown") || undefined}
              lang={locale}
            />
          </div>
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

          <Field
            label="slug"
            hint="Leave blank to derive it from the title. Changing it breaks old links."
          >
            <TextInput
              value={form.slug}
              onChange={(v) => set("slug", v)}
              placeholder="auto"
            />
          </Field>

          <Field label="tags">
            <ListInput
              values={form.tags}
              onChange={(v) => set("tags", v)}
              placeholder="go, postgres…"
            />
          </Field>

          <MediaPicker
            label="cover image"
            selected={form.cover_media_id ? [form.cover_media_id] : []}
            onChange={(ids) => set("cover_media_id", ids[0] ?? null)}
          />

          <Field
            label="publish date"
            hint="Leave blank to use the moment you publish."
          >
            <TextInput
              type="datetime-local"
              value={toLocalInput(form.published_at)}
              onChange={(v) =>
                set("published_at", v ? new Date(v).toISOString() : null)
              }
            />
          </Field>
        </aside>
      </div>
    </>
  );
}

/** ISO timestamp -> the "YYYY-MM-DDTHH:mm" shape datetime-local expects. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
