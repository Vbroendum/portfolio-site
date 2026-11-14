"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/admin/fields";
import { AdminHeader } from "@/components/admin/shell";
import {
  deleteMedia,
  listMedia,
  updateMediaAlt,
  uploadMedia,
} from "@/lib/api/admin";
import type { Media } from "@/lib/api/types";

/**
 * The media library. Alt text is editable inline because an image without it
 * is a bug on the public site, not a nice-to-have.
 */
export default function MediaPage() {
  const [items, setItems] = useState<Media[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const res = await listMedia();
    setItems(res.items);
  }

  useEffect(() => {
    let cancelled = false;
    listMedia()
      .then((res) => {
        if (!cancelled) setItems(res.items);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "could not load media");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    try {
      for (const file of Array.from(files)) await uploadMedia(file);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(media: Media) {
    if (
      !confirm(
        `Delete ${media.filename}? Anything using it will lose the image.`,
      )
    )
      return;
    await deleteMedia(media.id);
    await refresh();
  }

  return (
    <>
      <AdminHeader title="Media">
        <label className="cursor-pointer rounded border border-accent-dim bg-accent-wash px-3 py-1.5 font-mono text-[13px] hover:border-accent">
          {busy ? "uploading…" : "upload"}
          <input
            type="file"
            multiple
            onChange={(e) => void upload(e.target.files)}
            className="hidden"
          />
        </label>
      </AdminHeader>

      {error ? (
        <p className="mb-4 font-mono text-[13px] text-danger">{error}</p>
      ) : null}

      {items.length === 0 ? (
        <p className="font-mono text-[13px] text-faint">
          Nothing uploaded yet.
        </p>
      ) : null}

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((media) => (
          <li
            key={media.id}
            className="overflow-hidden rounded border border-line"
          >
            {media.content_type.startsWith("image/") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={media.url}
                alt={media.alt_text}
                className="h-36 w-full bg-ink object-contain"
              />
            ) : (
              <div className="flex h-36 items-center justify-center bg-ink font-mono text-[12px] text-faint">
                {media.content_type}
              </div>
            )}

            <div className="space-y-2 border-t border-line p-2.5">
              <p className="truncate font-mono text-[12px] text-muted">
                {media.filename}
              </p>
              <p className="font-mono text-[11px] text-faint">
                {media.width && media.height
                  ? `${media.width}×${media.height} · `
                  : ""}
                {formatBytes(media.size_bytes)}
              </p>

              <AltEditor media={media} onSaved={refresh} />

              <div className="flex items-center justify-between">
                <a
                  href={media.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-[12px] text-muted no-underline hover:text-accent"
                >
                  open
                </a>
                <button
                  type="button"
                  onClick={() => void remove(media)}
                  className="font-mono text-[12px] text-faint hover:text-danger"
                >
                  delete
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

function AltEditor({
  media,
  onSaved,
}: {
  media: Media;
  onSaved: () => Promise<void>;
}) {
  const [alt, setAlt] = useState(media.alt_text);
  const [dirty, setDirty] = useState(false);

  return (
    <div className="flex items-center gap-1.5">
      <input
        value={alt}
        placeholder="alt text"
        onChange={(e) => {
          setAlt(e.target.value);
          setDirty(true);
        }}
        className="min-w-0 flex-1 rounded border border-line bg-ink px-1.5 py-1 font-mono text-[12px] text-fg placeholder:text-faint focus:border-accent-dim focus:outline-none"
      />
      {dirty ? (
        <Button
          onClick={async () => {
            await updateMediaAlt(media.id, alt);
            setDirty(false);
            await onSaved();
          }}
        >
          save
        </Button>
      ) : null}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
