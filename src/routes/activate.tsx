
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import {
  requestActivationEmail,
  type ActivationStatus,
} from "@/lib/activation.functions";

export const Route = createFileRoute("/activate")({
  ssr: false,
  head: () => ({
    meta: [
      {
        title: "Activate your account — Business Match",
      },
      {
        name: "description",
        content:
          "Verify your membership email and activate your Business Match account.",
      },
    ],
  }),
  component: ActivatePage,
});

const MESSAGES: Record<
  Exclude<ActivationStatus, "eligible">,
  string
> = {
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
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const requestFn = useServerFn(requestActivationEmail);

  const sendActivationEmail = async () => {
    if (pending) return;

    const normalizedEmail = email.trim().toLowerCase();

    setPending(true);
    setError("");

    try {
      const res = await requestFn({
        data: {
          email: normalizedEmail,
          redirectTo: `${window.location.origin}/activate-complete`,
        },
      });

      if (res.sent) {
        setSentTo(normalizedEmail);
        return;
      }

      setError(
        MESSAGES[
          res.status as Exclude<ActivationStatus, "eligible">
        ],
      );
    } catch (e) {
      console.error("activation", e);

      setError(
        e instanceof Error
          ? e.message
          : "Something went wrong. Please try again.",
      );
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

        <h1 className="mt-2 font-display text-3xl font-semibold">
          Activate your account
        </h1>

        {!sentTo ? (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              Enter the email address registered with your membership.
              We will send you a secure activation link by email.
            </p>

            <form
              className="mt-8 grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                void sendActivationEmail();
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
                  className={input}
                  placeholder="you@company.com"
                  autoComplete="email"
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
                {pending ? "Sending…" : "Send activation email"}
              </button>
            </form>
          </>
        ) : (
          <>
            <h2 className="mt-6 font-display text-xl font-semibold">
              Check your email
            </h2>

            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              We sent an activation email to{" "}
              <strong className="text-foreground">{sentTo}</strong>.
            </p>

            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Open the email from IT-COMM Business Matching and click
              the confirmation button. You will then be able to
              complete your account activation and set your password.
            </p>

            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              If you do not see the email, check your spam or junk folder.
            </p>

            {error && (
              <p role="alert" className="mt-4 text-sm text-destructive">
                {error}
              </p>
            )}

            <div className="mt-8 grid gap-4">
              <button
                type="button"
                disabled={pending}
                onClick={() => void sendActivationEmail()}
                className="rounded-sm border border-border bg-card px-4 py-2.5 text-sm font-semibold transition-colors hover:border-ring disabled:opacity-60"
              >
                {pending ? "Sending…" : "Resend activation email"}
              </button>

              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setSentTo("");
                  setError("");
                }}
                className="text-sm text-muted-foreground underline underline-offset-4 disabled:opacity-60"
              >
                Use a different email
              </button>
            </div>
          </>
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
