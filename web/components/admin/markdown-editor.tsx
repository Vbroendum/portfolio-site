"use client";

import { useState } from "react";

import { Markdown } from "@/components/markdown";

/**
 * A two-tab markdown editor: write on the left tab, see the rendered result on
 * the preview tab using the exact same renderer the public site uses.
 *
 * There is no WYSIWYG and no toolbar by design - the body is markdown in the
 * database, so the editor shows markdown.
 */
export function MarkdownEditor({
  value,
  onChange,
  rows = 22,
}: {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  const [tab, setTab] = useState<"write" | "preview">("write");

  return (
    <div className="rounded border border-line bg-ink">
      <div className="flex items-center gap-1 border-b border-line px-1.5 py-1">
        {(["write", "preview"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded px-2 py-1 font-mono text-[12px] transition-colors ${
              tab === t
                ? "bg-raised text-fg"
                : "text-muted hover:text-fg"
            }`}
          >
            {t}
          </button>
        ))}
        <span className="ml-auto pr-1.5 font-mono text-[11px] text-faint">
          {value.trim() ? value.trim().split(/\s+/).length : 0} words
        </span>
      </div>

      {tab === "write" ? (
        <textarea
          value={value}
          rows={rows}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Write in markdown. Fenced code blocks get syntax highlighting."
          spellCheck
          className="block w-full resize-y bg-transparent px-3 py-2.5 font-mono text-[13px] leading-relaxed text-fg placeholder:text-faint focus:outline-none"
        />
      ) : (
        <div className="px-3 py-3">
          {value.trim() ? (
            <Markdown>{value}</Markdown>
          ) : (
            <p className="font-mono text-[13px] text-faint">Nothing to preview yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
