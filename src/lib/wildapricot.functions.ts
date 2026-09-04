import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * WildApricot integration entry points.
 *
 * WildApricot stays authoritative for identity and membership status; the app
 * owns offers, requests and matching history. Credentials live in backend
 * secrets and are only ever read inside these handlers.
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

/**
 * Admin-only: only association admins may run identity synchronization.
 *
 * The user id comes from a token already verified by `requireSupabaseAuth`, so
 * the role lookup is done with the service client against `member_roles`
 * (the middleware's client instance is not reusable inside the handler).
 */
async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("auth_user_id", userId)
    .maybeSingle();
  if (!profile) throw new Error("Administrator access is required to run a sync.");
  const { data: role } = await supabaseAdmin
    .from("member_roles")
    .select("role")
    .eq("profile_id", profile.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!role) throw new Error("Administrator access is required to run a sync.");
}

/** Upsert a WildApricot contact by its external identity key. */
export const syncWildApricotContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => contactSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
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
    await assertAdmin(context.userId);
    const { applyMembershipStatus } = await import("./wildapricot-sync.server");
    await applyMembershipStatus(data.contactId, data.status);
    return { ok: true };
  });

export interface IntegrationStatus {
  configured: boolean;
  missing: string[];
  accountId: string | null;
  webhookSecretConfigured: boolean;
  webhookPath: string;
  lastRun: {
    id: string;
    kind: string;
    status: string;
    startedAt: string;
    finishedAt: string | null;
    seen: number;
    created: number;
    updated: number;
    failed: number;
    error: string | null;
  } | null;
  recentRuns: Array<{
    id: string;
    kind: string;
    status: string;
    startedAt: string;
    seen: number;
    failed: number;
    error: string | null;
  }>;
  recentEvents: Array<{
    id: string;
    type: string;
    contactId: string | null;
    status: string;
    createdAt: string;
    error: string | null;
  }>;
  memberCounts: { total: number; active: number; matchingEnabled: number; linked: number };
}

/** Connection + synchronization status for the Admin dashboard. */
export const getWildApricotStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<IntegrationStatus> => {
    await assertAdmin(context.userId);
    const { readConfigState } = await import("./wildapricot-client.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const config = readConfigState();

    const [{ data: runs }, { data: events }, { data: profiles }] = await Promise.all([
      supabaseAdmin
        .from("wildapricot_sync_runs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(5),
      supabaseAdmin
        .from("wildapricot_events")
        .select("id, event_type, contact_id, status, created_at, error_message")
        .order("created_at", { ascending: false })
        .limit(8),
      supabaseAdmin
        .from("profiles")
        .select("membership_status, matching_enabled, wildapricot_contact_id"),
    ]);

    const rows = runs ?? [];
    const head = rows[0];
    const members = profiles ?? [];

    return {
      configured: config.configured,
      missing: config.missing,
      accountId: config.accountId,
      webhookSecretConfigured: config.webhookSecretConfigured,
      webhookPath: "/api/public/wildapricot/webhook",
      lastRun: head
        ? {
            id: head.id,
            kind: head.kind,
            status: head.status,
            startedAt: head.started_at,
            finishedAt: head.finished_at,
            seen: head.contacts_seen,
            created: head.contacts_created,
            updated: head.contacts_updated,
            failed: head.contacts_failed,
            error: head.error_message,
          }
        : null,
      recentRuns: rows.map((r) => ({
        id: r.id,
        kind: r.kind,
        status: r.status,
        startedAt: r.started_at,
        seen: r.contacts_seen,
        failed: r.contacts_failed,
        error: r.error_message,
      })),
      recentEvents: (events ?? []).map((e) => ({
        id: e.id,
        type: e.event_type,
        contactId: e.contact_id,
        status: e.status,
        createdAt: e.created_at,
        error: e.error_message,
      })),
      memberCounts: {
        total: members.length,
        active: members.filter((m) => m.membership_status === "active").length,
        matchingEnabled: members.filter((m) => m.matching_enabled).length,
        linked: members.filter((m) => Boolean(m.wildapricot_contact_id)).length,
      },
    };
  });

/** Live credential check — never returns or logs the secret values. */
export const testWildApricotConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const client = await import("./wildapricot-client.server");
    const config = client.readConfigState();
    if (!config.configured) {
      return {
        ok: false as const,
        configured: false as const,
        message: `Not configured. Add ${config.missing.join(" and ")} in Project Settings → Secrets.`,
      };
    }
    try {
      const account = await client.fetchAccount();
      return {
        ok: true as const,
        configured: true as const,
        message: `Connected to WildApricot account “${account.Name}” (id ${account.Id}).`,
      };
    } catch (error) {
      const { errorMessage } = await import("./wildapricot-sync.server");
      return { ok: false as const, configured: true as const, message: errorMessage(error) };
    }
  });

/** Manual full or incremental synchronization from the Admin dashboard. */
export const runWildApricotSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({ kind: z.enum(["full", "incremental"]).default("full") })
      .parse(data ?? { kind: "full" }),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { runSync } = await import("./wildapricot-sync.server");
    const since =
      data.kind === "incremental"
        ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
        : null;
    return runSync({
      kind: data.kind,
      since,
      triggerSource: "admin",
      triggeredBy: context.userId,
    });
  });
