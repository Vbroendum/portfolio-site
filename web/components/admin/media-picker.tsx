"use client";

import { useCallback, useEffect, useState } from "react";

import { listMedia, uploadMedia } from "@/lib/api/admin";
import type { Media } from "@/lib/api/types";

import { Button } from "./fields";

/**
 * Pick one image (cover) or several (project gallery) from the media library,
 * with upload built in. Selection order is preserved for galleries, because
 * that order is what the public page renders.
 */
export function MediaPicker({
  selected,
  onChange,
  multiple = false,
  label = "Media",
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
  multiple?: boolean;
  label?: string;
}) {
  const [items, setItems] = useState<Media[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await listMedia();
      setItems(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not load media");
    }
  }, []);

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

  const byId = new Map(items.map((m) => [m.id, m]));
  const chosen = selected.map((id) => byId.get(id)).filter(Boolean) as Media[];

  function toggle(id: string) {
    if (multiple) {
      onChange(
        selected.includes(id)
          ? selected.filter((s) => s !== id)
          : [...selected, id],
      );
    } else {
      onChange(selected[0] === id ? [] : [id]);
      setOpen(false);
    }
  }

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        const media = await uploadMedia(file);
        uploaded.push(media.id);
      }
      await refresh();
      onChange(multiple ? [...selected, ...uploaded] : uploaded.slice(0, 1));
    } catch (err) {
      setError(err instanceof Error ? err.message : "upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <span className="mb-1 block font-mono text-[12px] text-muted">{label}</span>

      {chosen.length > 0 ? (
        <ul className="mb-2 flex flex-wrap gap-2">
          {chosen.map((media) => (
            <li key={media.id} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={media.url}
                alt={media.alt_text}
                className="h-16 w-24 rounded border border-line object-cover"
              />
              <button
                type="button"
                onClick={() => toggle(media.id)}
                title="Remove"
                className="absolute -right-1.5 -top-1.5 rounded-full border border-line bg-ink px-1 font-mono text-[11px] text-muted hover:border-danger hover:text-danger"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => setOpen((o) => !o)}>
          {open ? "close library" : "choose from library"}
        </Button>
        <label className="cursor-pointer rounded border border-line px-3 py-1.5 font-mono text-[13px] text-muted transition-colors hover:border-line-strong hover:text-fg">
          {busy ? "uploading…" : "upload"}
          <input
            type="file"
            multiple={multiple}
            accept="image/*,video/mp4,video/webm,application/pdf"
            onChange={(e) => void handleUpload(e.target.files)}
            className="hidden"
          />
        </label>
      </div>

      {error ? (
        <p className="mt-1 font-mono text-[12px] text-danger">{error}</p>
      ) : null}

      {open ? (
        <ul className="mt-3 grid max-h-72 grid-cols-3 gap-2 overflow-y-auto rounded border border-line p-2 sm:grid-cols-5">
          {items.map((media) => {
            const isSelected = selected.includes(media.id);
            return (
              <li key={media.id}>
                <button
                  type="button"
                  onClick={() => toggle(media.id)}
                  title={media.filename}
                  className={`block w-full overflow-hidden rounded border transition-colors ${
                    isSelected
                      ? "border-accent"
                      : "border-line hover:border-line-strong"
                  }`}
                >
                  {media.content_type.startsWith("image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={media.url}
                      alt={media.alt_text}
                      className="h-16 w-full object-cover"
                    />
                  ) : (
                    <span className="flex h-16 items-center justify-center font-mono text-[11px] text-faint">
                      {media.content_type.split("/")[1]}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
          {items.length === 0 ? (
            <li className="col-span-full py-6 text-center font-mono text-[12px] text-faint">
              The library is empty. Upload something.
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
