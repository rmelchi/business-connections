import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/activate-complete")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Finish activation — Business Match" },
      { name: "description", content: "Choose a password to finish activating your member account." },
      { property: "og:title", content: "Finish activation — Business Match" },
      { property: "og:description", content: "Finish activating your Business Match member account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CompletePage,
});

const FAIL: Record<string, string> = {
  not_verified: "Your email address has not been verified yet. Open the link from the activation email.",
  already_activated: "This member account is already active. Sign in with your email and password.",
  inactive: "Your membership is not currently active, so activation is unavailable.",
  not_found: "No member profile matches this email address.",
  ambiguous: "More than one member profile uses this email. Please contact the association office.",
};

function CompletePage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const read = async () => {
      const { data } = await supabase.auth.getUser();
      setEmail(data.user?.email ?? null);
      setChecked(true);
    };
    void read();
    const { data: sub } = supabase.auth.onAuthStateChange(() => void read());
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async () => {
    if (password.length < 10) return setError("Please use at least 10 characters.");
    if (password !== confirm) return setError("The two passwords do not match.");
    setPending(true);
    setError("");
    try {
      const { completeActivation } = await import("@/lib/activation.functions");
      const res = await completeActivation();
      if (!res.ok) {
        setError(FAIL[res.status] ?? "Activation failed.");
        return;
      }
      const { error: pwError } = await supabase.auth.updateUser({ password });
      if (pwError) throw pwError;
      await navigate({ to: "/dashboard" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Activation failed. Please try again.");
    } finally {
      setPending(false);
    }
  };

  const input =
    "w-full rounded-sm border border-input bg-card px-3 py-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/25";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-sm">
        <p className="text-eyebrow">Member access</p>
        <h1 className="mt-2 font-display text-3xl font-semibold">Finish activation</h1>
        {!checked ? (
          <p className="mt-4 text-sm text-muted-foreground">Verifying your link…</p>
        ) : !email ? (
          <p className="mt-4 text-sm text-muted-foreground">
            This activation link is missing or has expired.{" "}
            <Link to="/activate" className="underline underline-offset-4">
              Request a new one
            </Link>
            .
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              Email verified for <strong>{email}</strong>. Choose a password for future sign-ins.
            </p>
            <form
              className="mt-8 grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              <input
                type="password"
                aria-label="New password"
                required
                className={input}
                placeholder="New password (10+ characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <input
                type="password"
                aria-label="Confirm password"
                required
                className={input}
                placeholder="Repeat the password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={pending}
                className="mt-2 rounded-sm bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {pending ? "Please wait…" : "Set password and continue"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
