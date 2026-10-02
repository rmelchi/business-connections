import {
  createFileRoute,
  Link,
  useNavigate,
} from "@tanstack/react-router";

import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { supabase } from "@/integrations/supabase/client";

import {
  requestActivationEmail,
  type ActivationStatus,
} from "@/lib/activation.functions";

export const Route = createFileRoute("/activate")({
  ssr: false,

  head: () => ({
    meta: [
      {
        title:
          "Activate your account — Business Match",
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
  const navigate = useNavigate();

  const [step, setStep] =
    useState<"email" | "code">("email");

  const [email, setEmail] =
    useState("");

  const [code, setCode] =
    useState("");

  const [error, setError] =
    useState("");

  const [pending, setPending] =
    useState(false);

  const requestFn =
    useServerFn(requestActivationEmail);

  const normalizedEmail =
    email.trim().toLowerCase();

  const sendCode = async () => {
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
        setStep("code");
        return;
      }

      setError(
        MESSAGES[
          res.status as Exclude<
            ActivationStatus,
            "eligible"
          >
        ],
      );
    } catch (e) {
      console.error(
        "activation",
        e,
      );

      setError(
        e instanceof Error
          ? e.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setPending(false);
    }
  };

  const verifyCode = async () => {
    const token = code
      .replace(/\s/g, "")
      .trim();

    if (!token) {
      setError(
        "Enter the verification code from your email.",
      );
      return;
    }

    setPending(true);
    setError("");

    try {
      const {
        data,
        error: verifyError,
      } =
        await supabase.auth.verifyOtp({
          email: normalizedEmail,
          token,
          type: "email",
        });

      if (
        verifyError ||
        !data.session ||
        !data.user
      ) {
        throw new Error(
          "That verification code is invalid or has expired. Please check the code and try again.",
        );
      }

      await navigate({
        to: "/activate-complete",
      });
    } catch (e) {
      console.error(
        "OTP verification",
        e,
      );

      setError(
        e instanceof Error
          ? e.message
          : "We could not verify that code.",
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
        <p className="text-eyebrow">
          Member access
        </p>

        <h1 className="mt-2 font-display text-3xl font-semibold">
          Activate your account
        </h1>

        {step === "email" ? (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              Enter the email address
              registered with your
              membership. We will send you
              a one-time verification code.
            </p>

            <form
              className="mt-8 grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                void sendCode();
              }}
            >
              <div className="grid gap-2">
                <label
                  className="text-eyebrow"
                  htmlFor="email"
                >
                  Email
                </label>

                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) =>
                    setEmail(
                      e.target.value,
                    )
                  }
                  className={input}
                  placeholder="you@company.com"
                  autoComplete="email"
                />
              </div>

              {error && (
                <p
                  role="alert"
                  className="text-sm text-destructive"
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={pending}
                className="mt-2 rounded-sm bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
              >
                {pending
                  ? "Sending…"
                  : "Send verification code"}
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              We sent a verification code
              to{" "}
              <strong>
                {normalizedEmail}
              </strong>
              . Enter the code below.
            </p>

            <form
              className="mt-8 grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                void verifyCode();
              }}
            >
              <div className="grid gap-2">
                <label
                  className="text-eyebrow"
                  htmlFor="code"
                >
                  Verification code
                </label>

                <input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  value={code}
                  onChange={(e) =>
                    setCode(
                      e.target.value,
                    )
                  }
                  className={input}
                  placeholder="Enter code"
                  autoFocus
                />
              </div>

              {error && (
                <p
                  role="alert"
                  className="text-sm text-destructive"
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={pending}
                className="mt-2 rounded-sm bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
              >
                {pending
                  ? "Verifying…"
                  : "Verify email"}
              </button>

              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setCode("");
                  setError("");
                  void sendCode();
                }}
                className="text-sm underline underline-offset-4 disabled:opacity-60"
              >
                Send a new code
              </button>

              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setStep("email");
                  setCode("");
                  setError("");
                }}
                className="text-sm text-muted-foreground underline underline-offset-4 disabled:opacity-60"
              >
                Use a different email
              </button>
            </form>
          </>
        )}

        <p className="mt-6 text-sm">
          <Link
            to="/"
            className="underline underline-offset-4"
          >
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
