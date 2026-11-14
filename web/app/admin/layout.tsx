import type { Metadata } from "next";

/**
 * The CMS is a private, per-person UI: there is no version of it worth
 * prerendering into the image, and trying to do so made the build depend on
 * the production API being reachable. Rendering it on demand is both correct
 * and what keeps `next build` independent of the API.
 *
 * This layout deliberately adds no chrome, so /admin/login stays outside the
 * auth guard in (cms)/layout.tsx.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
