import { NextResponse } from "next/server";

/**
 * Liveness probe for the container healthcheck.
 *
 * Deliberately touches nothing: no API call, no database, no cache. It answers
 * "this Next.js process is up and serving", which is the only question a
 * healthcheck should ask. Pointing the healthcheck at `/` instead would make
 * the container's health depend on the API being reachable, so an API blip
 * would get the web container killed and restarted for no reason.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ status: "ok" });
}
