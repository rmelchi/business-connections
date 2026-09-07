import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Account activation for synced WildApricot profiles that have no Supabase auth
 * user yet (`profiles.auth_user_id IS NULL`).
 *
 * Security model:
 *  - All privileged work happens server-side with the service-role client; the
 *    browser never sees admin credentials.
 *  - A profile is eligible only when exactly ONE active profile matches the
 *    email and it is not already linked.
 *  - Linking is done with a conditional update (`auth_user_id IS NULL`) so two
 *    concurrent activations cannot both claim the same profile.
 *  - No profile is ever created here — WildApricot stays authoritative.
 *
 * PREVIEW LIMITATION: transactional email is not configured for this project,
 * so instead of emailing a one-time link we let the member set their password
 * directly after the eligibility check. This path is clearly marked as
 * temporary/demo-only in the UI and should be replaced by
 * `resetPasswordForEmail` / invite links once email sending is live.
 */

export type ActivationStatus =
  | "eligible"
  | "already_activated"
  | "inactive"
  | "not_found"
  | "ambiguous";

const emailSchema = z.object({ email: z.string().email() });

type ProfileRow = {
  id: string;
  email: string;
  name: string;
  membership_status: string;
  auth_user_id: string | null;
};

async function lookup(email: string): Promise<{
  status: ActivationStatus;
  profile?: ProfileRow;
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, email, name, membership_status, auth_user_id")
    .ilike("email", email);
  if (error) throw error;

  const rows = (data ?? []) as ProfileRow[];
  if (rows.length === 0) return { status: "not_found" };
  if (rows.length > 1) return { status: "ambiguous" };

  const profile = rows[0]!;
  if (profile.auth_user_id) return { status: "already_activated", profile };
  if (profile.membership_status !== "active") return { status: "inactive", profile };
  return { status: "eligible", profile };
}

export const checkActivationEligibility = createServerFn({ method: "POST" })
  .inputValidator((data) => emailSchema.parse(data))
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();
    const { status, profile } = await lookup(email);
    return {
      status,
      name: status === "eligible" ? (profile?.name ?? "") : "",
    };
  });

export const activateAccount = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({ email: z.string().email(), password: z.string().min(10).max(128) })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();
    const { status, profile } = await lookup(email);
    if (status !== "eligible" || !profile) {
      return { ok: false as const, status };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Re-use an existing auth user with this email if one somehow exists,
    // otherwise create it. Never create a second profile.
    let userId: string | undefined;
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
    });
    if (createError && !/already been registered|already exists/i.test(createError.message)) {
      throw createError;
    }
    userId = created?.user?.id;

    if (!userId) {
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      userId = list?.users.find((u) => u.email?.toLowerCase() === email)?.id;
      if (userId) {
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          password: data.password,
          email_confirm: true,
        });
      }
    }
    if (!userId) throw new Error("Could not create the sign-in account.");

    // Atomic claim: only link while the profile is still unlinked.
    const { data: linked, error: linkError } = await supabaseAdmin
      .from("profiles")
      .update({ auth_user_id: userId })
      .eq("id", profile.id)
      .is("auth_user_id", null)
      .select("id")
      .maybeSingle();
    if (linkError) throw linkError;
    if (!linked) return { ok: false as const, status: "already_activated" as ActivationStatus };

    return { ok: true as const, status: "eligible" as ActivationStatus, profileId: profile.id };
  });
