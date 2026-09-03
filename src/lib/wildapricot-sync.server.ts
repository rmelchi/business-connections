/**
 * Server-only WildApricot synchronization engine.
 *
 * Writes identity/membership data into `profiles` through the
 * `sync_wildapricot_contact` database function, keyed on the immutable
 * `wildapricot_contact_id`. App-owned data (offers, requests, matches,
 * explanations, interest history) is never touched: a lapsed or suspended
 * member simply becomes ineligible for matching.
 *
 * Every run and every webhook event is recorded for audit in
 * `wildapricot_sync_runs`, `wildapricot_events` and `wildapricot_sync_log`.
 */
import type { MembershipStatus } from "./types";
import { isMatchingEligible, toSyncInput, type WildApricotContact } from "./wildapricot";
import {
  fetchContact,
  fetchContacts,
  readConfigState,
  WildApricotNotConfiguredError,
} from "./wildapricot-client.server";

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

async function admin(): Promise<Admin> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function log(
  db: Admin,
  entry: {
    runId?: string | null;
    eventId?: string | null;
    level?: "info" | "warn" | "error";
    message: string;
    context?: Record<string, unknown>;
  },
) {
  await db.from("wildapricot_sync_log").insert({
    run_id: entry.runId ?? null,
    event_id: entry.eventId ?? null,
    level: entry.level ?? "info",
    message: entry.message,
    context: (entry.context ?? {}) as never,
  });
}

/** Upsert a single contact; returns whether the profile already existed. */
async function upsertContact(
  db: Admin,
  contact: WildApricotContact,
): Promise<{ profileId: string; created: boolean; status: MembershipStatus }> {
  const input = toSyncInput(contact);
  const { data: existing } = await db
    .from("profiles")
    .select("id")
    .eq("wildapricot_contact_id", input.contactId)
    .maybeSingle();

  const { data: profileId, error } = await db.rpc("sync_wildapricot_contact", {
    _contact_id: input.contactId,
    _name: input.name,
    _email: input.email,
    _phone: input.phone,
    _company: input.company,
    _membership_level: input.membershipLevel,
    _membership_status: input.membershipStatus,
  });
  if (error) throw error;

  return {
    profileId: profileId as string,
    created: !existing,
    status: input.membershipStatus,
  };
}

export interface SyncRunResult {
  runId: string;
  status: "succeeded" | "failed" | "skipped";
  seen: number;
  created: number;
  updated: number;
  failed: number;
  error?: string;
}

/**
 * Full or incremental contact synchronization.
 * `since` (ISO date) switches to an incremental pull.
 */
export async function runSync(options: {
  kind?: "full" | "incremental";
  since?: string | null;
  triggerSource?: string;
  triggeredBy?: string | null;
}): Promise<SyncRunResult> {
  const db = await admin();
  const kind = options.kind ?? "full";

  const { data: run, error: runError } = await db
    .from("wildapricot_sync_runs")
    .insert({
      kind,
      status: "running",
      trigger_source: options.triggerSource ?? "manual",
      triggered_by: options.triggeredBy ?? null,
    })
    .select("id")
    .single();
  if (runError) throw runError;
  const runId = run.id;

  const finish = async (patch: Record<string, unknown>) => {
    await db
      .from("wildapricot_sync_runs")
      .update({ ...patch, finished_at: new Date().toISOString() })
      .eq("id", runId);
  };

  const config = readConfigState();
  if (!config.configured) {
    const message = `WildApricot is not configured. Missing: ${config.missing.join(", ")}.`;
    await log(db, { runId, level: "warn", message });
    await finish({ status: "skipped", error_message: message });
    return { runId, status: "skipped", seen: 0, created: 0, updated: 0, failed: 0, error: message };
  }

  let seen = 0;
  let created = 0;
  let updated = 0;
  let failed = 0;

  try {
    const contacts = await fetchContacts({ modifiedSince: options.since ?? null });
    seen = contacts.length;
    await log(db, { runId, message: `Fetched ${seen} contact(s) from WildApricot.`, context: { kind } });

    for (const contact of contacts) {
      try {
        const result = await upsertContact(db, contact);
        if (result.created) created += 1;
        else updated += 1;
        if (!isMatchingEligible(result.status)) {
          await log(db, {
            runId,
            level: "info",
            message: `Matching disabled for ${result.profileId} (status ${result.status}); listings retained.`,
            context: { contactId: contact.Id },
          });
        }
      } catch (error) {
        failed += 1;
        await log(db, {
          runId,
          level: "error",
          message: `Failed to sync contact ${contact.Id}: ${errorMessage(error)}`,
          context: { contactId: contact.Id },
        });
      }
    }

    await finish({
      status: failed > 0 && created + updated === 0 ? "failed" : "succeeded",
      contacts_seen: seen,
      contacts_created: created,
      contacts_updated: updated,
      contacts_failed: failed,
    });
    return { runId, status: "succeeded", seen, created, updated, failed };
  } catch (error) {
    const message = errorMessage(error);
    await log(db, { runId, level: "error", message });
    await finish({
      status: "failed",
      error_message: message,
      contacts_seen: seen,
      contacts_created: created,
      contacts_updated: updated,
      contacts_failed: failed,
    });
    return { runId, status: "failed", seen, created, updated, failed, error: message };
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof WildApricotNotConfiguredError) return error.message;
  if (error instanceof Error) return error.message;
  return String(error);
}

/** Directly apply a membership status change (used by webhooks). */
export async function applyMembershipStatus(contactId: string, status: MembershipStatus) {
  const db = await admin();
  const { error } = await db
    .from("profiles")
    .update({
      membership_status: status,
      matching_enabled: isMatchingEligible(status),
      last_synced_at: new Date().toISOString(),
    })
    .eq("wildapricot_contact_id", contactId);
  if (error) throw error;
}

export type WebhookOutcome = "processed" | "duplicate" | "skipped" | "failed";

/**
 * Idempotent webhook processing: the event is recorded first, keyed on its
 * external id. A repeated delivery hits the unique index and is reported as a
 * duplicate without re-applying anything.
 */
export async function processWebhookEvent(input: {
  externalEventId: string;
  eventType: string;
  contactId: string | null;
  payload: unknown;
}): Promise<{ outcome: WebhookOutcome; message?: string }> {
  const db = await admin();

  const { data: event, error: insertError } = await db
    .from("wildapricot_events")
    .insert({
      external_event_id: input.externalEventId,
      event_type: input.eventType,
      contact_id: input.contactId,
      payload: (input.payload ?? {}) as never,
      status: "pending",
    })
    .select("id")
    .maybeSingle();

  if (insertError) {
    if (insertError.code === "23505") return { outcome: "duplicate" };
    throw insertError;
  }
  const eventId = event?.id ?? null;

  const settle = async (status: string, message?: string) => {
    if (!eventId) return;
    await db
      .from("wildapricot_events")
      .update({
        status,
        error_message: message ?? null,
        processed_at: new Date().toISOString(),
      })
      .eq("id", eventId);
  };

  try {
    if (!input.contactId) {
      await settle("skipped", "Event carried no contact id.");
      return { outcome: "skipped", message: "No contact id on event." };
    }

    const config = readConfigState();
    const type = input.eventType.toLowerCase();

    if (type.includes("disabled") || type.includes("lapsed")) {
      await applyMembershipStatus(input.contactId, "lapsed");
      await log(db, { eventId, message: `Membership lapsed for contact ${input.contactId}.` });
      await settle("processed");
      return { outcome: "processed" };
    }
    if (type.includes("suspend")) {
      await applyMembershipStatus(input.contactId, "suspended");
      await settle("processed");
      return { outcome: "processed" };
    }

    if (!config.configured) {
      const message = `Cannot re-fetch contact: ${config.missing.join(", ")} not configured.`;
      await log(db, { eventId, level: "warn", message });
      await settle("skipped", message);
      return { outcome: "skipped", message };
    }

    const contact = await fetchContact(input.contactId);
    if (!contact) {
      await settle("skipped", "Contact not found in WildApricot.");
      return { outcome: "skipped", message: "Contact not found." };
    }
    await upsertContact(db, contact);
    await log(db, { eventId, message: `Synced contact ${input.contactId} from webhook.` });
    await settle("processed");
    return { outcome: "processed" };
  } catch (error) {
    const message = errorMessage(error);
    await settle("failed", message);
    await log(db, { eventId, level: "error", message });
    return { outcome: "failed", message };
  }
}
