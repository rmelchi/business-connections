import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Demo sign-in path.
 *
 * Clearly marked as preview-only: it provisions a confirmed Supabase Auth user
 * for a small allow-list of demo member emails and links it to the seeded
 * profile via `auth_user_id`. Real email-based member sign-in (invite or
 * password) can be switched on without touching the rest of the app — the
 * client always ends up with a normal Supabase session.
 */
export const DEMO_ACCOUNTS = [
  "giulia@tenutaferrari.it",
  "marcus@goldenstatefinefoods.com",
  "sofia@italiancommerce.org",
] as const;

export const DEMO_PASSWORD = "business-match-demo";

export const provisionDemoAccount = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({ email: z.string().email() }).parse(data),
  )
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();
    if (!(DEMO_ACCOUNTS as readonly string[]).includes(email)) {
      throw new Error("Not a demo account. Real member sign-in is not enabled yet.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, auth_user_id")
      .eq("email", email)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile) throw new Error("No member profile found for that email address.");

    let userId = profile.auth_user_id ?? undefined;

    if (!userId) {
      const { data: created, error: createError } =
        await supabaseAdmin.auth.admin.createUser({
          email,
          password: DEMO_PASSWORD,
          email_confirm: true,
        });
      if (createError && !/already been registered|already exists/i.test(createError.message)) {
        throw createError;
      }
      userId = created?.user?.id;

      if (!userId) {
        const { data: list } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
        userId = list?.users.find((u) => u.email?.toLowerCase() === email)?.id;
      }
      if (!userId) throw new Error("Could not provision the demo account.");

      await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: DEMO_PASSWORD,
        email_confirm: true,
      });
      const { error: linkError } = await supabaseAdmin
        .from("profiles")
        .update({ auth_user_id: userId })
        .eq("id", profile.id);
      if (linkError) throw linkError;
    }

    return { email, password: DEMO_PASSWORD };
  });
