import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Email-verified account activation for WildApricot-synced profiles that have
 * no linked auth user yet (`profiles.auth_user_id IS NULL`).
 *
 * Flow:
 *  1. `requestActivationEmail` checks eligibility (exactly one ACTIVE profile
 *     for the email, not yet linked) and only then sends a one-time sign-in
 *     link to that address. No password is set and nothing is linked here.
 *  2. The member clicks the link, which proves control of the mailbox and
 *     gives the browser a verified session.
 *  3. On /activate-complete the member chooses a password and calls
 *     `completeActivation`, which (server-side, authenticated) re-checks that
 *     the auth user's email is confirmed and equals the profile email, then
 *     links with an atomic conditional update (`auth_user_id IS NULL`).
 *
 * No profile is ever created here — WildApricot stays authoritative, and roles,
 * listings, matches and history attach to the existing profile id unchanged.
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

async function lookup(email: string): Promise<{ status: ActivationStatus; profile?: ProfileRow }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, email, name, membership_status, auth_user_id")
    .ilike("email", email.replace(/[%_\\]/g, "\\$&"));
  if (error) throw error;
  const rows = (data ?? []) as ProfileRow[];
  if (rows.length === 0) return { status: "not_found" };
  if (rows.length > 1) return { status: "ambiguous" };
  const profile = rows[0]!;
  if (profile.auth_user_id) return { status: "already_activated", profile };
  if (profile.membership_status !== "active") return { status: "inactive", profile };
  return { status: "eligible", profile };
}

export const requestActivationEmail = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({ email: z.string().email().max(255), redirectTo: z.string().url() }).parse(data),
  )
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();
    const { status } = await lookup(email);
    if (status !== "eligible") return { status, sent: false };

    // Only same-origin activation pages are allowed as redirect targets.
    const redirect = new URL(data.redirectTo);
    if (redirect.pathname !== "/activate-complete") {
      throw new Error("Invalid activation redirect.");
    }

    const { createClient } = await import("@supabase/supabase-js");
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"]!;
    const client = createClient(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
            h.delete("Authorization");
          }
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });
    const { error } = await client.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true, emailRedirectTo: redirect.toString() },
    });
    if (error) {
      console.error("[activation] send failed", error.message);
      throw new Error("We could not send the activation email. Please try again shortly.");
    }
    return { status, sent: true };
  });

export const completeActivation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: userRes, error: userErr } = await supabaseAdmin.auth.admin.getUserById(
      context.userId,
    );
    if (userErr || !userRes.user) throw new Error("Your session could not be verified.");
    const user = userRes.user;
    const email = user.email?.trim().toLowerCase();
    if (!email || !user.email_confirmed_at) {
      return { ok: false as const, status: "not_verified" as const };
    }

    // Already linked to this user? Treat as success (idempotent).
    const { data: mine } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (mine) return { ok: true as const, status: "linked" as const, profileId: mine.id };

    const { status, profile } = await lookup(email);
    if (status !== "eligible" || !profile) return { ok: false as const, status };

    const { data: linked, error: linkError } = await supabaseAdmin
      .from("profiles")
      .update({ auth_user_id: user.id })
      .eq("id", profile.id)
      .is("auth_user_id", null)
      .select("id")
      .maybeSingle();
    if (linkError) throw linkError;
    if (!linked) return { ok: false as const, status: "already_activated" as const };
    return { ok: true as const, status: "linked" as const, profileId: profile.id };
  });
