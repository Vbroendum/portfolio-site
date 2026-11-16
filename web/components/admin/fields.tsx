"use client";

import type { ReactNode } from "react";
import { useState } from "react";

/**
 * Form primitives for the CMS. They are plain and dense on purpose: this is a
 * tool, not a page, so the styling stays quiet and consistent.
 */

const inputBase =
  "w-full rounded border border-line bg-ink px-2.5 py-1.5 font-mono text-[13px] text-fg placeholder:text-faint focus:border-accent-dim focus:outline-none";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-[12px] text-muted">
        {label}
      </span>
      {children}
      {hint ? (
        <span className="mt-1 block font-mono text-[11px] text-faint">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
  required,
  lang,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  /** Sets the browser's spellcheck language. */
  lang?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      required={required}
      placeholder={placeholder}
      lang={lang}
      onChange={(e) => onChange(e.target.value)}
      className={inputBase}
    />
  );
}

export function TextArea({
  value,
  onChange,
  rows = 4,
  placeholder,
  lang,
}: {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  lang?: string;
}) {
  return (
    <textarea
      value={value}
      rows={rows}
      placeholder={placeholder}
      lang={lang}
      onChange={(e) => onChange(e.target.value)}
      className={`${inputBase} resize-y leading-relaxed`}
    />
  );
}

export function Select<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className={inputBase}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} className="bg-ink">
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 font-mono text-[13px] text-muted">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 accent-[var(--color-accent)]"
      />
      {label}
    </label>
  );
}

/**
 * Comma- or Enter-separated list input, used for tags, tech and CV highlights.
 * Values are kept as an array so the API contract stays honest.
 */
export function ListInput({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");

  function commit(raw: string) {
    const parts = raw
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    const next = [...values];
    for (const p of parts) if (!next.includes(p)) next.push(p);
    onChange(next);
    setDraft("");
  }

  return (
    <div className="rounded border border-line bg-ink p-1.5">
      {values.length > 0 ? (
        <ul className="mb-1.5 flex flex-wrap gap-1">
          {values.map((value) => (
            <li key={value}>
              <button
                type="button"
                onClick={() => onChange(values.filter((v) => v !== value))}
                title="Remove"
                className="rounded border border-line px-1.5 py-0.5 font-mono text-[11px] text-muted hover:border-danger hover:text-danger"
              >
                {value} ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <input
        value={draft}
        placeholder={placeholder ?? "type and press Enter"}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => commit(draft)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commit(draft);
          }
          if (e.key === "Backspace" && draft === "" && values.length > 0) {
            onChange(values.slice(0, -1));
          }
        }}
        className="w-full bg-transparent px-1 py-0.5 font-mono text-[13px] text-fg placeholder:text-faint focus:outline-none"
      />
    </div>
  );
}

export function Button({
  children,
  onClick,
  type = "button",
  variant = "default",
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "default" | "primary" | "danger";
  disabled?: boolean;
}) {
  const styles = {
    default: "border-line text-muted hover:border-line-strong hover:text-fg",
    primary:
      "border-accent-dim bg-accent-wash text-fg hover:border-accent disabled:opacity-50",
    danger: "border-line text-danger hover:border-danger",
  }[variant];

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded border px-3 py-1.5 font-mono text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${styles}`}
    >
      {children}
    </button>
  );
}

/** One-line status under a form: saved / error / nothing. */
export function StatusLine({
  status,
}: {
  status: { kind: "idle" | "saving" | "saved" | "error"; message?: string };
}) {
  if (status.kind === "idle") return null;
  const color =
    status.kind === "error"
      ? "text-danger"
      : status.kind === "saved"
        ? "text-ok"
        : "text-muted";
  const text =
    status.message ??
    { saving: "Saving…", saved: "Saved", error: "Something went wrong", idle: "" }[
      status.kind
    ];
  return <p className={`font-mono text-[12px] ${color}`}>{text}</p>;
}
