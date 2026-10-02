import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { env } from "cloudflare:workers";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Secure activation for WildApricot-synced member profiles.
 *
 * Flow:
 * 1. Member enters the email address registered in WildApricot.
 * 2. We verify that exactly one active, unlinked profile exists.
 * 3. Supabase sends an email OTP.
 * 4. The browser verifies that OTP directly with Supabase Auth.
 * 5. The verified Supabase session proceeds to /activate-complete.
 * 6. completeActivation re-checks the verified email and atomically
 *    links the Supabase auth user to the existing WildApricot profile.
 *
 * No member profile is created here.
 */

export type ActivationStatus =
  | "eligible"
  | "already_activated"
  | "inactive"
  | "not_found"
  | "ambiguous";

type ProfileRow = {
  id: string;
  email: string;
  name: string;
  membership_status: string;
  auth_user_id: string | null;
};

async function lookup(
  email: string,
): Promise<{
  status: ActivationStatus;
  profile?: ProfileRow;
}> {
  const { supabaseAdmin } = await import(
    "@/integrations/supabase/client.server"
  );

  const escapedEmail = email.replace(
    /[%_\\]/g,
    "\\$&",
  );

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select(
      "id, email, name, membership_status, auth_user_id",
    )
    .ilike("email", escapedEmail);

  if (error) throw error;

  const rows = (data ?? []) as ProfileRow[];

  if (rows.length === 0) {
    return { status: "not_found" };
  }

  if (rows.length > 1) {
    return { status: "ambiguous" };
  }

  const profile = rows[0]!;

  if (profile.auth_user_id) {
    return {
      status: "already_activated",
      profile,
    };
  }

  if (profile.membership_status !== "active") {
    return {
      status: "inactive",
      profile,
    };
  }

  return {
    status: "eligible",
    profile,
  };
}

function createPublicSupabaseClient() {
  const SUPABASE_URL =
    env.SUPABASE_URL as string | undefined;

  const SUPABASE_PUBLISHABLE_KEY =
    env.SUPABASE_PUBLISHABLE_KEY as
      | string
      | undefined;

  if (
    !SUPABASE_URL ||
    !SUPABASE_PUBLISHABLE_KEY
  ) {
    const missing = [
      ...(!SUPABASE_URL
        ? ["SUPABASE_URL"]
        : []),
      ...(!SUPABASE_PUBLISHABLE_KEY
        ? ["SUPABASE_PUBLISHABLE_KEY"]
        : []),
    ];

    throw new Error(
      `Missing Supabase environment variable(s): ${missing.join(", ")}.`,
    );
  }

  return import("@supabase/supabase-js").then(
    ({ createClient }) =>
      createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },

          global: {
            fetch: (input, init) => {
              const headers = new Headers(
                init?.headers,
              );

              /*
               * New Supabase publishable keys are opaque API keys,
               * rather than JWT bearer tokens.
               */
              if (
                SUPABASE_PUBLISHABLE_KEY.startsWith(
                  "sb_",
                ) &&
                headers.get("Authorization") ===
                  `Bearer ${SUPABASE_PUBLISHABLE_KEY}`
              ) {
                headers.delete("Authorization");
              }

              headers.set(
                "apikey",
                SUPABASE_PUBLISHABLE_KEY,
              );

              return fetch(input, {
                ...init,
                headers,
              });
            },
          },
        },
      ),
  );
}

/**
 * Send the member an email OTP.
 */
export const requestActivationEmail =
  createServerFn({ method: "POST" })
    .inputValidator((data) =>
      z
        .object({
          email: z.string().email().max(255),
        })
        .parse(data),
    )
    .handler(async ({ data }) => {
      const email = data.email
        .trim()
        .toLowerCase();

      const { status } = await lookup(email);

      if (status !== "eligible") {
        return {
          status,
          sent: false,
        };
      }

      const client =
        await createPublicSupabaseClient();

      /*
       * No emailRedirectTo is supplied.
       *
       * The Supabase email template will contain {{ .Token }},
       * allowing the member to enter the OTP directly in the app.
       */
      const { error } =
        await client.auth.signInWithOtp({
          email,
          options: {
            shouldCreateUser: true,
          },
        });

      if (error) {
        console.error(
          "[activation] OTP send failed",
          error.message,
        );

        throw new Error(
          "We could not send the verification code. Please try again shortly.",
        );
      }

      return {
        status,
        sent: true,
      };
    });

/**
 * Called only after the browser has an authenticated Supabase session.
 *
 * The middleware verifies the session before this handler runs.
 */
export const completeActivation =
  createServerFn({ method: "POST" })
    .middleware([requireSupabaseAuth])
    .handler(async ({ context }) => {
      const { supabaseAdmin } = await import(
        "@/integrations/supabase/client.server"
      );

      const {
        data: userRes,
        error: userErr,
      } =
        await supabaseAdmin.auth.admin.getUserById(
          context.userId,
        );

      if (userErr || !userRes.user) {
        throw new Error(
          "Your session could not be verified.",
        );
      }

      const user = userRes.user;

      const email = user.email
        ?.trim()
        .toLowerCase();

      if (
        !email ||
        !user.email_confirmed_at
      ) {
        return {
          ok: false as const,
          status: "not_verified" as const,
        };
      }

      /*
       * Idempotency:
       * if this Supabase user is already linked, activation is
       * considered successful.
       */
      const { data: mine } =
        await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq(
            "auth_user_id",
            user.id,
          )
          .maybeSingle();

      if (mine) {
        return {
          ok: true as const,
          status: "linked" as const,
          profileId: mine.id,
        };
      }

      /*
       * Re-check WildApricot-derived eligibility AFTER email
       * verification.
       */
      const {
        status,
        profile,
      } = await lookup(email);

      if (
        status !== "eligible" ||
        !profile
      ) {
        return {
          ok: false as const,
          status,
        };
      }

      /*
       * Atomic conditional link.
       *
       * We only claim the profile if auth_user_id is still NULL.
       * This prevents two auth users from activating the same
       * WildApricot profile concurrently.
       */
      const {
        data: linked,
        error: linkError,
      } = await supabaseAdmin
        .from("profiles")
        .update({
          auth_user_id: user.id,
        })
        .eq("id", profile.id)
        .is("auth_user_id", null)
        .select("id")
        .maybeSingle();

      if (linkError) {
        throw linkError;
      }

      if (!linked) {
        return {
          ok: false as const,
          status:
            "already_activated" as const,
        };
      }

      return {
        ok: true as const,
        status: "linked" as const,
        profileId: profile.id,
      };
    });
