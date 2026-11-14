import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-24 sm:px-8">
      <p className="font-mono text-[13px] text-faint">404</p>
      <h1 className="mt-2 text-3xl">That page is not here.</h1>
      <p className="mt-3 text-muted">
        It may have been renamed, or it may never have existed.
      </p>
      <p className="mt-6 font-mono text-[13px]">
        <Link href="/" className="text-muted no-underline hover:text-accent">
          back to the start
        </Link>
      </p>
    </div>
  );
}
