import { NextResponse } from "next/server";

import { feedResponse } from "@/lib/feed";
import { isLocale } from "@/lib/i18n/config";

// See app/feed.xml/route.ts.
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ lang: string }> },
) {
  const { lang } = await params;
  if (!isLocale(lang)) return new NextResponse("not found", { status: 404 });
  return feedResponse(lang);
}
