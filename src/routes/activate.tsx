import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import { useServerFn } from "@tanstack/react-start";

import { requestActivationEmail, type ActivationStatus } from "@/lib/activation.functions";

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
  const [step, setStep] = useState<"email" | "sent">("email");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const requestFn = useServerFn(requestActivationEmail);

  const send = async () => {
    setPending(true);
    setError("");
    try {
      const res = await requestFn({
        data: {
          email: email.trim().toLowerCase(),
          redirectTo: `${window.location.origin}/activate-complete`,
        },
      });
      if (res.sent) setStep("sent");
      else setError(MESSAGES[res.status as Exclude<ActivationStatus, "eligible">]);
    } catch (e) {
      console.error("activation", e);
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
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
            ? "Enter the email address registered with your membership. We will email you a one-time link to verify it, then you choose a password. Your existing profile, role, offers and requests are kept exactly as they are."
            : `Activation email sent to ${email.trim().toLowerCase()}. Open the link in that email on this device to choose your password. The link expires after a short time.`}
        </p>
        {step === "email" && (
          <form
            className="mt-8 grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
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
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-sm border border-input bg-card px-3 py-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/25"
                placeholder="you@company.com"
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={pending}
              className="mt-2 rounded-sm bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              {pending ? "Please wait…" : "Send activation email"}
            </button>
          </form>
        )}
        <p className="mt-6 text-sm">
          <Link to="/" className="underline underline-offset-4">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
