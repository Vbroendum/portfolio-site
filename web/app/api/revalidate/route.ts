import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

/**
 * Drops Next.js's cached copy of public pages after a CMS edit.
 *
 * Authorisation is delegated to the Go API: the caller's session cookie is
 * forwarded to /api/v1/auth/me, and only a 200 lets the purge through. That
 * keeps the rule in one place instead of duplicating JWT verification here.
 */
const INTERNAL =
  process.env.API_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8080";

const ALLOWED = new Set(["posts", "projects", "cv", "settings"]);

export async function POST(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  const check = await fetch(`${INTERNAL}/api/v1/auth/me`, {
    headers: { cookie },
    cache: "no-store",
  });
  if (!check.ok) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "sign in first" } },
      { status: 401 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as { tags?: string[] };
  const tags = (body.tags ?? []).filter((t) => ALLOWED.has(t));
  // "max" expires the entry immediately for subsequent requests.
  for (const tag of tags) revalidateTag(tag, "max");

  return NextResponse.json({ revalidated: tags });
}
