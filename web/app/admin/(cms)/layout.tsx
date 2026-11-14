import type { Metadata } from "next";

import { AuthGuard } from "@/components/admin/auth-guard";
import { AdminShell } from "@/components/admin/shell";

export const metadata: Metadata = {
  title: "CMS",
  robots: { index: false, follow: false },
};

/**
 * Everything in the (cms) route group is behind the session guard. /admin/login
 * deliberately sits outside this group so it is not wrapped by the guard, which
 * would redirect to itself forever.
 */
export default function CmsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <AdminShell>{children}</AdminShell>
    </AuthGuard>
  );
}
