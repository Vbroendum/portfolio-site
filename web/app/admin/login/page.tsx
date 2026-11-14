"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, Field, TextInput } from "@/components/admin/fields";
import { login } from "@/lib/api/admin";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      router.replace("/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5">
      <h1 className="text-2xl">Sign in</h1>
      <p className="mt-1 font-mono text-[12px] text-faint">
        Admin access for this site.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <Field label="email">
          <TextInput type="email" value={email} onChange={setEmail} required />
        </Field>
        <Field label="password">
          <TextInput
            type="password"
            value={password}
            onChange={setPassword}
            required
          />
        </Field>

        {error ? (
          <p className="font-mono text-[12px] text-danger">{error}</p>
        ) : null}

        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? "signing in…" : "sign in"}
        </Button>
      </form>

      {/* Only outside production. /admin/login is reachable by anyone who
          guesses the URL, and there is no reason to show them the stack or the
          command that creates accounts. */}
      {process.env.NODE_ENV !== "production" ? (
        <p className="mt-8 font-mono text-[11px] text-faint">
          No account yet? Create one on the server with:
          <br />
          <code>go run ./cmd/adminctl create-user -email you@example.com</code>
        </p>
      ) : null}
    </div>
  );
}
