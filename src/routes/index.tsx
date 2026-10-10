
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { useStore } from "@/lib/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign in — Business Match" },
      {
        name: "description",
        content:
          "Member sign-in for Business Match: find the right business opportunity within your association network.",
      },
      { property: "og:title", content: "Sign in — Business Match" },
      {
        property: "og:description",
        content: "Private B2B matchmaking for association members.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { signIn } = useStore();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const submit = async (value: string, pw: string) => {
    if (pending) return;
    setPending(true);
    setError("");

    try {
      const err = await signIn(value, pw);
      if (err) setError(err);
      else await navigate({ to: "/dashboard" });
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Sign-in failed. Please try again.",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden flex-col justify-between bg-ink px-14 py-14 text-ink-foreground lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-sm bg-brass font-display text-sm font-bold text-brass-foreground">
            BM
          </span>
          <span className="font-display text-lg font-semibold">
            Business Match
          </span>
        </div>

        <div className="max-w-xl">
          <p className="text-eyebrow text-brass">
            Member opportunity network
          </p>
          <h1 className="mt-4 font-display text-5xl font-semibold leading-[1.08]">
            Find the right business opportunity within your network.
          </h1>
          <p className="mt-6 text-[15px] leading-relaxed text-ink-foreground/70">
            Business Match reads what members are looking for and what they
            can provide, then surfaces the pairings worth a conversation —
            including mutual opportunities where both sides need what the
            other offers.
          </p>
          <dl className="mt-10 grid grid-cols-3 gap-6 border-t border-ink-foreground/15 pt-8">
            {[
              ["Structured", "Offers and requests with real commercial criteria"],
              ["Explained", "Every match shows why it scored"],
              ["Private", "Contact details stay protected until mutual interest"],
            ].map(([t, d]) => (
              <div key={t}>
                <dt className="font-display text-base font-semibold text-brass">
                  {t}
                </dt>
                <dd className="mt-1 text-[13px] leading-relaxed text-ink-foreground/60">
                  {d}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <p className="text-xs text-ink-foreground/45">
          Membership identity provided by WildApricot.
        </p>
      </section>

      <section className="flex items-center justify-center bg-background px-6 py-16">
        <div className="w-full max-w-sm">
          <p className="text-eyebrow">Member access</p>
          <h2 className="mt-2 font-display text-3xl font-semibold">
            Sign in
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Use the email address registered with your membership.
          </p>

          <form
            className="mt-8 grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void submit(email, password);
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

            <div className="grid gap-2">
              <label className="text-eyebrow" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-sm border border-input bg-card px-3 py-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/25"
                placeholder="••••••••"
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
              {pending ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="mt-4 text-sm text-muted-foreground">
            First time signing in?{" "}
            <Link
              to="/activate"
              className="font-medium text-foreground underline underline-offset-4"
            >
              Activate your account
            </Link>
          </p>
        
          <div className="mt-8 border-t border-border pt-6">
            <h3 className="font-display text-lg font-semibold">
              Not an IT-COMM member yet?
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Join IT-COMM to access Business Match, connect with
              fellow members, and discover new business opportunities.
            </p>
            <a
              href="https://italiancommerce.org/join-us"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex rounded-sm bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Become an IT-COMM Member →
            </a>
          </div>

        </div>
      </section>
    </div>
  );
}
