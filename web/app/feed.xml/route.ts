import { feedResponse } from "@/lib/feed";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";

// Rendered per request so a build-time failure is never cached as the feed;
// the upstream fetch in lib/feed.ts is what caches, keyed by the posts tag.
export const dynamic = "force-dynamic";

/** The original, unprefixed feed: kept, in the default locale, for old subscribers. */
export function GET() {
  return feedResponse(DEFAULT_LOCALE);
}
