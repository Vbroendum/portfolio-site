import { notFound } from "next/navigation";

/**
 * Catches /<locale>/anything-unknown so it 404s inside the [lang] layout,
 * with the site's header, footer and translated not-found page, instead of
 * falling through to Next.js's bare default.
 */
export default function UnknownPage() {
  notFound();
}
