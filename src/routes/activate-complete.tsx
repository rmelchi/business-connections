import {
  createFileRoute,
  Link,
  useNavigate,
} from "@tanstack/react-router";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import { useServerFn } from "@tanstack/react-start";

import { supabase } from "@/integrations/supabase/client";
import { completeActivation } from "@/lib/activation.functions";

export const Route = createFileRoute(
  "/activate-complete",
)({
  ssr: false,

  head: () => ({
    meta: [
      {
        title:
          "Finish activation — Business Match",
      },
      {
        name: "description",
        content:
          "Choose a password to finish activating your member account.",
      },
      {
        property: "og:title",
        content:
          "Finish activation — Business Match",
      },
      {
        property: "og:description",
        content:
          "Finish activating your Business Match member account.",
      },
      {
        property: "og:type",
        content: "website",
      },
      {
        name: "twitter:card",
        content: "summary",
      },
    ],
  }),

  component: CompletePage,
});

const FAIL: Record<string, string> = {
  not_verified:
    "Your email address has not been verified yet. Request a new activation email and try again.",

  already_activated:
    "This member account is already active. Sign in with your email and password.",

  inactive:
    "Your membership is not currently active, so activation is unavailable.",

  not_found:
    "No member profile matches this email address.",

  ambiguous:
    "More than one member profile uses this email. Please contact the association office.",
};

/*
 * Decodes ONLY the first JWT segment (the header) as
 * base64url JSON and returns the non-secret fields
 * alg and kid. The payload and signature segments are
 * never touched. Returns null when parsing fails.
 */
function decodeJwtHeader(
  token: string,
): { alg: string | null; kid: string | null } | null {
  try {
    const segment =
      token.trim().split(".")[0] ?? "";

    if (!segment) {
      return null;
    }

    const normalized = segment
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    const padded =
      normalized +
      "=".repeat((4 - (normalized.length % 4)) % 4);

    const json = atob(padded);

    const parsed: unknown = JSON.parse(
      json,
    );

    if (
      !parsed ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      return null;
    }

    const header = parsed as Record<
      string,
      unknown
    >;

    return {
      alg:
        typeof header.alg === "string"
          ? header.alg
          : null,

      kid:
        typeof header.kid === "string"
          ? header.kid
          : null,
    };
  } catch {
    return null;
  }
}

function CompletePage() {
  const navigate = useNavigate();

  const [email, setEmail] =
    useState<string | null>(null);

  const [checked, setChecked] =
    useState(false);

  const [password, setPassword] =
    useState("");

  const [confirm, setConfirm] =
    useState("");

  const [error, setError] =
    useState("");

  const [pending, setPending] =
    useState(false);

  /*
   * Non-secret diagnostic fields decoded locally from the
   * implicit-flow token header. The token itself, its
   * payload and its signature are never displayed,
   * logged or stored.
   */
  const [tokenAlg, setTokenAlg] =
    useState<string | null>(null);

  const [tokenKid, setTokenKid] =
    useState<string | null>(null);

  /*
   * Guards the PKCE code exchange against a second run when
   * React StrictMode remounts the effect.
   */
  const exchangingRef = useRef(false);

  /*
   * Guards the implicit-flow hash session against a second
   * run when React StrictMode remounts the effect.
   */
  const implicitRef = useRef(false);

  const completeFn =
    useServerFn(completeActivation);

  useEffect(() => {
    let active = true;

    const finishCheck = async () => {
    try {
        /*
         * Production implicit-flow magic links arrive as
         * #access_token=... in the URL hash. Establish the
         * session explicitly before any getSession/getUser
         * checks; tokens are never logged.
         */
        const hashParams =
          typeof window !== "undefined" &&
          window.location.hash
            ? new URLSearchParams(
                window.location.hash.replace(
                  /^#/,
                  "",
                ),
              )
            : null;

        const implicitAccessToken =
          hashParams?.get(
            "access_token",
          ) ?? null;

        const implicitRefreshToken =
          hashParams?.get(
            "refresh_token",
          ) ?? null;

        if (
          implicitAccessToken &&
          implicitRefreshToken &&
          !implicitRef.current
        ) {
          implicitRef.current = true;

          const {
            error: implicitError,
          } =
            await supabase.auth.setSession(
              {
                access_token:
                  implicitAccessToken,
                refresh_token:
                  implicitRefreshToken,
              },
            );

          if (implicitError) {
            console.error(
              "[activation] implicit session error",
              implicitError,
            );

            /*
             * If Supabase already processed the hash
             * during client initialization, a valid
             * session can exist even though the
             * explicit setSession reported an error.
             */
            const {
              data: existing,
            } =
              await supabase.auth.getSession();

            if (
              !existing.session?.user &&
              active
            ) {
              /*
               * Local diagnostic: decode only the JWT
               * header to surface alg and kid. The
               * token, payload and signature are
               * never displayed, logged or stored.
               */
              const header =
                decodeJwtHeader(
                  implicitAccessToken,
                );

              setTokenAlg(
                header?.alg ?? null,
              );

              setTokenKid(
                header?.kid ?? null,
              );

              setError(
                "We could not verify the activation link.",
              );

              setChecked(true);
              return;
            }
          }
          if (
            typeof window !== "undefined" &&
            (window.location.search ||
              window.location.hash)
          ) {
            window.history.replaceState(
              {},
              document.title,
              window.location.pathname,
            );
          }
        }

        /*
         * PKCE magic-link callbacks arrive as ?code=... in the
         * query string. Exchange the code for a session before
         * reading the stored session.
         */
        const params =
          typeof window !== "undefined"
            ? new URLSearchParams(
                window.location.search,
              )
            : null;

        const code = params?.get("code") ?? null;

        if (code && !exchangingRef.current) {
          exchangingRef.current = true;

          const {
            error: exchangeError,
          } =
            await supabase.auth.exchangeCodeForSession(
              code,
            );

          if (exchangeError) {
            console.error(
              "[activation] code exchange error",
              exchangeError,
            );

            /*
             * If Supabase already exchanged this code
             * automatically during client initialization,
             * a valid session can exist even though the
             * explicit exchange reports an error.
             */
            const {
              data: existing,
            } =
              await supabase.auth.getSession();

            if (
              !existing.session?.user &&
              active
            ) {
              setError(
                "We could not verify the activation link.",
              );

              setChecked(true);
              return;
            }
          }

          if (!active) return;

          /*
           * Remove the code and any other auth callback
           * query or hash material from the visible URL,
           * preserving the pathname.
           */
          if (
            typeof window !== "undefined" &&
            (window.location.search ||
              window.location.hash)
          ) {
            window.history.replaceState(
              {},
              document.title,
              window.location.pathname,
            );
          }
        }

        /*
         * getSession() waits for the Supabase auth client to
         * initialize and gives it an opportunity to process
         * the magic-link session contained in the URL.
         */
        const {
          data: sessionData,
          error: sessionError,
        } =
          await supabase.auth.getSession();

        if (!active) return;

        if (sessionError) {
          console.error(
            "[activation] session error",
            sessionError,
          );

          setError(
            "We could not verify the activation link.",
          );

          setChecked(true);
          return;
        }

        if (sessionData.session?.user) {
          setEmail(
            sessionData.session.user.email ??
              null,
          );

          setChecked(true);

          /*
           * Once Supabase has stored the session, remove
           * authentication tokens from the visible browser URL.
           */
          if (
            typeof window !== "undefined" &&
            window.location.hash
          ) {
            window.history.replaceState(
              {},
              document.title,
              window.location.pathname +
                window.location.search,
            );
          }

          return;
        }

        /*
         * If initialization has not completed yet, getUser()
         * performs an authenticated check against Supabase.
         */
        const {
          data: userData,
          error: userError,
        } =
          await supabase.auth.getUser();

        if (!active) return;

        if (userError) {
          console.error(
            "[activation] user error",
            userError,
          );
        }

        setEmail(
          userData.user?.email ??
            null,
        );

        setChecked(true);
      } catch (e) {
        console.error(
          "[activation] callback error",
          e,
        );

        if (active) {
          setError(
            "We could not verify the activation link.",
          );

          setChecked(true);
        }
      }
    };

    /*
     * Listen before performing the initial session check.
     *
     * If Supabase finishes processing the magic-link callback
     * during initialization, SIGNED_IN will update this page.
     */
    const {
      data: subscription,
    } =
      supabase.auth.onAuthStateChange(
        (_event, session) => {
          if (
            !active ||
            !session?.user
          ) {
            return;
          }

          setEmail(
            session.user.email ??
              null,
          );

          setChecked(true);

          if (
            typeof window !== "undefined" &&
            window.location.hash
          ) {
            window.history.replaceState(
              {},
              document.title,
              window.location.pathname +
                window.location.search,
            );
          }
        },
      );

    void finishCheck();

    return () => {
      active = false;

      subscription.subscription.unsubscribe();
    };
  }, []);

  const submit = async () => {
    if (password.length < 10) {
      setError(
        "Please use at least 10 characters.",
      );

      return;
    }

    if (password !== confirm) {
      setError(
        "The two passwords do not match.",
      );

      return;
    }

    setPending(true);
    setError("");

    setTokenAlg(null);
    setTokenKid(null);

    try {
      /*
       * First link the verified Supabase user to the
       * existing WildApricot profile.
       */
      const res =
        await completeFn();

      if (!res.ok) {
        setError(
          FAIL[res.status] ??
            "Activation failed.",
        );

        return;
      }

      /*
       * The verified user can now choose the password that
       * will be used for normal future sign-ins.
       */
      const {
        error: passwordError,
      } =
        await supabase.auth.updateUser({
          password,
        });

      if (passwordError) {
        throw passwordError;
      }

      await navigate({
        to: "/dashboard",
      });
    } catch (e) {
      console.error(
        "[activation] completion error",
        e,
      );

      setError(
        e instanceof Error
          ? e.message
          : "Activation failed. Please try again.",
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
          Finish activation
        </h1>

        {!checked ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Verifying your activation
            link…
          </p>
        ) : !email ? (
          <>
            <p className="mt-4 text-sm text-muted-foreground">
              This activation link is
              missing, invalid or has
              expired.{" "}
              <Link
                to="/activate"
                className="underline underline-offset-4"
              >
                Request a new one
              </Link>
              .
            </p>

              {error && (
                <p
                  role="alert"
                  className="mt-4 text-sm text-destructive"
                >
                  {error}
                </p>
              )}

              {error &&
                (tokenAlg || tokenKid) && (
                  <div className="mt-3 rounded-sm border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    <p className="font-medium text-foreground">
                      Token diagnostics
                    </p>

                    {tokenAlg && (
                      <p className="mt-1">
                        Token algorithm:{" "}
                        {tokenAlg}
                      </p>
                    )}

                    {tokenKid && (
                      <p className="mt-1">
                        Token key ID:{" "}
                        {tokenKid}
                      </p>
                    )}
                  </div>
                )}
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              Email verified for{" "}
              <strong>{email}</strong>.
              Choose a password for future
              sign-ins.
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
                onChange={(e) =>
                  setPassword(
                    e.target.value,
                  )
                }
                autoComplete="new-password"
              />

              <input
                type="password"
                aria-label="Confirm password"
                required
                className={input}
                placeholder="Repeat the password"
                value={confirm}
                onChange={(e) =>
                  setConfirm(
                    e.target.value,
                  )
                }
                autoComplete="new-password"
              />

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
                className="mt-2 rounded-sm bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {pending
                  ? "Please wait…"
                  : "Set password and continue"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
