import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/** Small shared primitives. Deliberately few: the site is mostly type. */

export function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded border border-line px-1.5 py-0.5 font-mono text-[11px] text-muted">
      {children}
    </span>
  );
}

export function ChipLink({
  href,
  active,
  children,
}: {
  href: string;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded border px-1.5 py-0.5 font-mono text-[11px] no-underline transition-colors ${
        active
          ? "border-accent-dim bg-accent-wash text-fg"
          : "border-line text-muted hover:border-line-strong hover:text-fg"
      }`}
    >
      {children}
    </Link>
  );
}

/** A section heading with its hairline rule - used on every index page. */
export function SectionHead({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex items-baseline justify-between gap-4 border-b border-line pb-2">
      <h2 className="text-xl">{title}</h2>
      {action ? <div className="font-mono text-[13px]">{action}</div> : null}
    </div>
  );
}

/** Dates are machine data, so they are set in mono throughout the site. */
export function FormattedDate({
  value,
  className = "",
}: {
  value?: string | null;
  className?: string;
}) {
  if (!value) return null;
  const date = new Date(value);
  return (
    <time
      dateTime={date.toISOString()}
      className={`font-mono text-[13px] text-faint ${className}`}
    >
      {date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })}
    </time>
  );
}

export function ExternalLink({
  href,
  children,
  ...rest
}: ComponentProps<"a">) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="font-mono text-[13px] text-muted no-underline transition-colors hover:text-accent"
      {...rest}
    >
      {children}
    </a>
  );
}

export function EmptyState({
  children,
  hint,
}: {
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-md border border-dashed border-line px-5 py-10 text-center">
      <p className="text-muted">{children}</p>
      {hint ? (
        <p className="mt-1 font-mono text-[13px] text-faint">{hint}</p>
      ) : null}
    </div>
  );
}
