import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Platform role administration.
 *
 * Roles live only in this application — WildApricot stays authoritative for
 * identity and membership status and is never written back to. Every check
 * here is server-side; the UI gating is convenience only.
 */

type AdminContext = { actorProfileId: string };

/**
 * Verifies the caller is an administrator with an *active* membership.
 * A lapsed/suspended admin keeps their role record but loses admin access.
 */
async function requireActiveAdmin(userId: string): Promise<AdminContext> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id, membership_status")
    .eq("auth_user_id", userId)
    .maybeSingle();
  if (!profile) throw new Error("Administrator access is required.");

  const { data: role } = await supabaseAdmin
    .from("member_roles")
    .select("role")
    .eq("profile_id", profile.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!role) throw new Error("Administrator access is required.");
  if (profile.membership_status !== "active") {
    throw new Error(
      "Your membership is not active in WildApricot, so administrator actions are blocked.",
    );
  }
  return { actorProfileId: profile.id };
}

export interface RoleAuditEntry {
  id: string;
  targetProfileId: string;
  actorProfileId: string | null;
  oldRole: "member" | "admin";
  newRole: "member" | "admin";
  reason: string | null;
  createdAt: string;
}

/** Recent role-change audit entries (administrators only). */
export const listRoleAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RoleAuditEntry[]> => {
    await requireActiveAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("role_change_audit")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(25);
    if (error) throw error;
    return (data ?? []).map((r) => ({
      id: r.id,
      targetProfileId: r.target_profile_id,
      actorProfileId: r.actor_profile_id,
      oldRole: r.old_role,
      newRole: r.new_role,
      reason: r.reason,
      createdAt: r.created_at,
    }));
  });

/** Promote a member to administrator, or demote an administrator to member. */
export const setMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        profileId: z.string().min(1),
        role: z.enum(["member", "admin"]),
        reason: z.string().max(280).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { actorProfileId } = await requireActiveAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: target } = await supabaseAdmin
      .from("profiles")
      .select("id, name, membership_status")
      .eq("id", data.profileId)
      .maybeSingle();
    if (!target) throw new Error("That member could not be found.");

    const { data: existing } = await supabaseAdmin
      .from("member_roles")
      .select("id, role")
      .eq("profile_id", target.id)
      .eq("role", "admin")
      .maybeSingle();

    const oldRole: "member" | "admin" = existing ? "admin" : "member";
    if (oldRole === data.role) {
      return { ok: true as const, role: oldRole, unchanged: true as const };
    }

    if (data.role === "admin") {
      if (target.membership_status !== "active") {
        throw new Error(
          "Only members with an active WildApricot membership can be promoted to administrator.",
        );
      }
      const { error: insertError } = await supabaseAdmin
        .from("member_roles")
        .insert({ profile_id: target.id, role: "admin" });
      if (insertError) throw insertError;
    } else {
      // Never leave the association without an administrator.
      const { count } = await supabaseAdmin
        .from("member_roles")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin");
      if ((count ?? 0) <= 1) {
        throw new Error("You cannot remove the last remaining administrator.");
      }
      const { error: deleteError } = await supabaseAdmin
        .from("member_roles")
        .delete()
        .eq("profile_id", target.id)
        .eq("role", "admin");
      if (deleteError) throw deleteError;
    }

    const { error: auditError } = await supabaseAdmin.from("role_change_audit").insert({
      target_profile_id: target.id,
      actor_profile_id: actorProfileId,
      old_role: oldRole,
      new_role: data.role,
      reason: data.reason?.trim() ? data.reason.trim() : null,
    });
    if (auditError) throw auditError;

    return { ok: true as const, role: data.role, unchanged: false as const };
  });
