import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import type { ActivationStatus } from "@/lib/activation.functions";

export const Route = createFileRoute("/activate")({
  head: () => ({
    meta: [
      { title: "Activate your account — Business Match" },
      {
        name: "description",
        content:
          "Set a password for your existing member profile and get access to Business Match.",
      },
      { property: "og:title", content: "Activate your account — Business Match" },
      {
        property: "og:description",
        content: "Set a password for your existing Business Match member profile.",
      },
    ],
  }),
  component: ActivatePage,
});

const MESSAGES: Record<Exclude<ActivationStatus, "eligible">, string> = {
  already_activated:
    "This member account is already active. Go back and sign in with your email and password.",
  inactive:
    "Your membership is not currently active, so account activation is unavailable. Please contact the association office.",
  not_found:
    "We could not find a member profile with that email address. Use the address registered with your membership.",
  ambiguous:
    "More than one member profile uses that email address. Please contact the association office so it can be resolved.",
};

function ActivatePage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"email" | "password" | "done">("email");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const checkEmail = async () => {
    setPending(true);
    setError("");
    try {
      const { checkActivationEligibility } = await import("@/lib/activation.functions");
      const res = await checkActivationEligibility({
        data: { email: email.trim().toLowerCase() },
      });
      if (res.status === "eligible") {
        setName(res.name);
        setStep("password");
      } else {
        setError(MESSAGES[res.status]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  };

  const setUpPassword = async () => {
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }
    if (password.length < 10) {
      setError("Please use at least 10 characters.");
      return;
    }
    setPending(true);
    setError("");
    try {
      const { activateAccount } = await import("@/lib/activation.functions");
      const res = await activateAccount({
        data: { email: email.trim().toLowerCase(), password },
      });
      if (!res.ok) {
        setError(MESSAGES[res.status as Exclude<ActivationStatus, "eligible">]);
        setStep("email");
        return;
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (signInError) throw signInError;
      setStep("done");
      await navigate({ to: "/dashboard" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Activation failed. Please try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-sm">
        <p className="text-eyebrow">Member access</p>
        <h1 className="mt-2 font-display text-3xl font-semibold">Activate your account</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {step === "email"
            ? "Enter the email address registered with your membership. Your existing member profile, offers and requests are kept exactly as they are."
            : step === "password"
              ? `Welcome${name ? `, ${name.split(" ")[0]}` : ""}. Choose a password to finish setting up your sign-in.`
              : "Your account is ready. Taking you to your dashboard…"}
        </p>

        <form
          className="mt-8 grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void (step === "email" ? checkEmail() : setUpPassword());
          }}
        >
          <div className="grid gap-2">
            <label className="text-eyebrow" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              disabled={step !== "email"}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-sm border border-input bg-card px-3 py-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/25 disabled:opacity-60"
              placeholder="you@company.com"
            />
          </div>

          {step === "password" && (
            <>
              <div className="grid gap-2">
                <label className="text-eyebrow" htmlFor="password">
                  New password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-sm border border-input bg-card px-3 py-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/25"
                  placeholder="At least 10 characters"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-eyebrow" htmlFor="confirm">
                  Confirm password
                </label>
                <input
                  id="confirm"
                  type="password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full rounded-sm border border-input bg-card px-3 py-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/25"
                  placeholder="Repeat the password"
                />
              </div>
            </>
          )}

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending || step === "done"}
            className="mt-2 rounded-sm bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {pending
              ? "Please wait…"
              : step === "email"
                ? "Continue"
                : step === "password"
                  ? "Set password and sign in"
                  : "Done"}
          </button>
        </form>

        <p className="mt-6 text-xs text-muted-foreground">
          Temporary preview setup: email delivery is not switched on yet, so activation confirms
          your membership record and lets you set a password immediately instead of emailing a
          one-time link.
        </p>

        <p className="mt-6 text-sm">
          <Link to="/" className="underline underline-offset-4">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
