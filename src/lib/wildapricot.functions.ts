import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Database-backed WildApricot sync entry points.
 *
 * These are the seam a future WildApricot REST poller or webhook receiver
 * plugs into. Today they only write to our own database via the
 * `sync_wildapricot_contact` function — no live WildApricot credentials are
 * configured yet. WildApricot stays authoritative for identity and membership
 * status; app-owned offers, requests and matching history are never modified,
 * so a lapsed member is disabled for matching rather than deleted.
 */

const membershipStatus = z.enum(["active", "lapsed", "pending", "suspended"]);

const contactSchema = z.object({
  contactId: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().default(""),
  company: z.string().default(""),
  membershipLevel: z.string().default("Member"),
  membershipStatus,
});

/** Admin-only: only association admins may run identity synchronization. */
async function assertAdmin(
  supabase: { rpc: (...args: never[]) => unknown },
  userId: string,
) {
  const rpc = supabase.rpc as unknown as (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown }>;
  const { data } = await rpc("has_role", { _user_id: userId, _role: "admin" });
  if (data !== true) throw new Error("Administrator access is required to run a sync.");
}

/** Upsert a WildApricot contact by its external identity key. */
export const syncWildApricotContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => contactSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profileId, error } = await supabaseAdmin.rpc("sync_wildapricot_contact", {
      _contact_id: data.contactId,
      _name: data.name,
      _email: data.email,
      _phone: data.phone,
      _company: data.company,
      _membership_level: data.membershipLevel,
      _membership_status: data.membershipStatus,
    });
    if (error) throw error;
    return { profileId: profileId as string };
  });

/**
 * Apply a membership status change coming from WildApricot. A non-active
 * status disables matching while leaving every offer and request in place.
 */
export const syncWildApricotMembershipStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ contactId: z.string().min(1), status: membershipStatus }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        membership_status: data.status,
        matching_enabled: data.status === "active",
        last_synced_at: new Date().toISOString(),
      })
      .eq("wildapricot_contact_id", data.contactId);
    if (error) throw error;
    return { ok: true };
  });
