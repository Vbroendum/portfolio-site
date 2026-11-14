"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { logout as apiLogout, me } from "@/lib/api/admin";
import type { User } from "@/lib/api/types";

/**
 * Client-side session gate for /admin.
 *
 * This is a convenience, not the security boundary: the real check happens in
 * the Go API, which rejects every /api/v1/admin request without a valid cookie.
 * Rendering the shell for an unauthenticated user would simply show empty
 * lists, so we redirect to the login page instead.
 */

type AuthState = {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    me()
      .then((u) => {
        if (!cancelled) setUser(u);
      })
      .catch(() => {
        if (!cancelled) router.replace("/admin/login");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  const signOut = useCallback(async () => {
    await apiLogout().catch(() => {});
    setUser(null);
    router.replace("/admin/login");
  }, [router]);

  if (loading) {
    return (
      <p className="p-8 font-mono text-[13px] text-faint">Checking session…</p>
    );
  }
  if (!user) return null;

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
