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
import {
  isMatchingEligible,
  toSyncInput,
  type WildApricotContact,
} from "./wildapricot";

import {
  fetchContact,
  fetchContacts,
  readConfigState,
  WildApricotNotConfiguredError,
} from "./wildapricot-client.server";

type Admin =
  Awaited<
    typeof import("@/integrations/supabase/client.server")
  >["supabaseAdmin"];

async function admin(): Promise<Admin> {
  const { supabaseAdmin } = await import(
    "@/integrations/supabase/client.server"
  );

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

/**
 * Upsert a single WildApricot contact.
 */
async function upsertContact(
  db: Admin,
  contact: WildApricotContact,
): Promise<{
  profileId: string;
  created: boolean;
  status: MembershipStatus;
}> {
  const input = toSyncInput(contact);

  const { data: existing } = await db
    .from("profiles")
    .select("id")
    .eq("wildapricot_contact_id", input.contactId)
    .maybeSingle();

  const { data: profileId, error } = await db.rpc(
    "sync_wildapricot_contact",
    {
      _contact_id: input.contactId,
      _name: input.name,
      _email: input.email,
      _phone: input.phone,
      _company: input.company,
      _membership_level: input.membershipLevel,
      _membership_status: input.membershipStatus,
    },
  );

  if (error) {
    throw error;
  }

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

  /**
   * Temporary diagnostic output.
   *
   * Groups database/API errors without exposing member names,
   * email addresses, phone numbers or contact ids.
   */
  failureReasons?: Array<{
    message: string;
    count: number;
  }>;

  error?: string;
}

/**
 * Full or incremental contact synchronization.
 *
 * `since` switches to an incremental WildApricot pull.
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

  if (runError) {
    throw runError;
  }

  const runId = run.id;

  const finish = async (patch: Record<string, unknown>) => {
    const { error } = await db
      .from("wildapricot_sync_runs")
      .update({
        ...patch,
        finished_at: new Date().toISOString(),
      })
      .eq("id", runId);

    /*
     * Do not let a failure to update the audit row hide the
     * actual synchronization result, but surface it in logs.
     */
    if (error) {
      console.error(
        "[WildApricot sync] Could not finalize sync run:",
        error.message,
      );
    }
  };

  const config = readConfigState();

  if (!config.configured) {
    const message =
      `WildApricot is not configured. Missing: ` +
      `${config.missing.join(", ")}.`;

    await log(db, {
      runId,
      level: "warn",
      message,
    });

    await finish({
      status: "skipped",
      error_message: message,
    });

    return {
      runId,
      status: "skipped",
      seen: 0,
      created: 0,
      updated: 0,
      failed: 0,
      error: message,
    };
  }

  let seen = 0;
  let created = 0;
  let updated = 0;
  let failed = 0;

  /*
   * Temporary diagnostic collection.
   *
   * We group identical errors so the bootstrap endpoint can tell
   * us why contacts fail without returning member-specific data.
   */
  const failureReasonCounts = new Map<string, number>();

  try {
    const contacts = await fetchContacts({
      modifiedSince: options.since ?? null,
    });

    seen = contacts.length;

    await log(db, {
      runId,
      message: `Fetched ${seen} contact(s) from WildApricot.`,
      context: {
        kind,
      },
    });

    for (const contact of contacts) {
      try {
        const result = await upsertContact(db, contact);

        if (result.created) {
          created += 1;
        } else {
          updated += 1;
        }

        if (!isMatchingEligible(result.status)) {
          await log(db, {
            runId,
            level: "info",
            message:
              `Matching disabled for ${result.profileId} ` +
              `(status ${result.status}); listings retained.`,
            context: {
              contactId: contact.Id,
            },
          });
        }
      } catch (error) {
        failed += 1;

        const reason = errorMessage(error);

        failureReasonCounts.set(
          reason,
          (failureReasonCounts.get(reason) ?? 0) + 1,
        );

        /*
         * We still try to preserve the detailed server-side log.
         * If logging itself fails, it must not stop the full sync.
         */
        try {
          await log(db, {
            runId,
            level: "error",
            message:
              `Failed to sync contact ${contact.Id}: ${reason}`,
            context: {
              contactId: contact.Id,
            },
          });
        } catch (logError) {
          console.error(
            "[WildApricot sync] Could not write failure log:",
            errorMessage(logError),
          );
        }
      }
    }

    const finalStatus =
      failed > 0 && created + updated === 0
        ? "failed"
        : "succeeded";

    await finish({
      status: finalStatus,
      contacts_seen: seen,
      contacts_created: created,
      contacts_updated: updated,
      contacts_failed: failed,
    });

    return {
      runId,
      status: finalStatus,
      seen,
      created,
      updated,
      failed,
      failureReasons: [
        ...failureReasonCounts.entries(),
      ].map(([message, count]) => ({
        message,
        count,
      })),
    };
  } catch (error) {
    const message = errorMessage(error);

    failureReasonCounts.set(
      message,
      (failureReasonCounts.get(message) ?? 0) + 1,
    );

    try {
      await log(db, {
        runId,
        level: "error",
        message,
      });
    } catch (logError) {
      console.error(
        "[WildApricot sync] Could not write fatal error log:",
        errorMessage(logError),
      );
    }

    await finish({
      status: "failed",
      error_message: message,
      contacts_seen: seen,
      contacts_created: created,
      contacts_updated: updated,
      contacts_failed: failed,
    });

    return {
      runId,
      status: "failed",
      seen,
      created,
      updated,
      failed,
      failureReasons: [
        ...failureReasonCounts.entries(),
      ].map(([reason, count]) => ({
        message: reason,
        count,
      })),
      error: message,
    };
  }
}

/**
 * Convert an unknown thrown value into a readable diagnostic.
 */
export function errorMessage(error: unknown): string {
  if (error instanceof WildApricotNotConfiguredError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error
  ) {
    return String(
      (error as { message?: unknown }).message ??
        "Unknown error",
    );
  }

  return String(error);
}

/**
 * Directly apply a membership status change.
 *
 * Used by WildApricot webhook processing.
 */
export async function applyMembershipStatus(
  contactId: string,
  status: MembershipStatus,
) {
  const db = await admin();

  const { error } = await db
    .from("profiles")
    .update({
      membership_status: status,
      matching_enabled: isMatchingEligible(status),
      last_synced_at: new Date().toISOString(),
    })
    .eq("wildapricot_contact_id", contactId);

  if (error) {
    throw error;
  }
}

export type WebhookOutcome =
  | "processed"
  | "duplicate"
  | "skipped"
  | "ignored"
  | "failed";

/**
 * Idempotent WildApricot webhook processing.
 *
 * The event is recorded first, keyed on its external id, so
 * repeated deliveries do not apply the same change twice.
 *
 * The webhook payload is never trusted as the authoritative
 * member record. The actual contact is re-fetched from
 * WildApricot before the profile is synchronized.
 */
export async function processWebhookEvent(input: {
  externalEventId: string;
  messageType: string;
  action: string;
  contactId: string | null;
  contactIdRaw: string | null;
  accountId: string | null;
  handled: boolean;
  payload: unknown;
}): Promise<{
  outcome: WebhookOutcome;
  message?: string;
}> {
  const db = await admin();

  const { data: event, error: insertError } = await db
    .from("wildapricot_events")
    .insert({
      external_event_id: input.externalEventId,
      event_type: input.messageType,
      action: input.action,
      account_id: input.accountId,
      contact_id:
        input.contactId ?? input.contactIdRaw,
      payload: (input.payload ?? {}) as never,
      status: "pending",
    })
    .select("id")
    .maybeSingle();

  if (insertError) {
    /*
     * PostgreSQL unique-constraint error:
     * webhook has already been processed.
     */
    if (insertError.code === "23505") {
      return {
        outcome: "duplicate",
      };
    }

    throw insertError;
  }

  const eventId = event?.id ?? null;

  const settle = async (
    status: string,
    message?: string,
  ) => {
    if (!eventId) {
      return;
    }

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
    if (!input.handled) {
      const message =
        `Unhandled message type “${input.messageType}”; ` +
        `no profile changed.`;

      await settle("ignored", message);

      return {
        outcome: "ignored",
        message,
      };
    }

    if (!input.contactId) {
      const message = input.contactIdRaw
        ? `Malformed Contact.Id “${input.contactIdRaw}”; ` +
          `no profile changed.`
        : "Event carried no Contact.Id; no profile changed.";

      await log(db, {
        eventId,
        level: "warn",
        message,
      });

      await settle("skipped", message);

      return {
        outcome: "skipped",
        message,
      };
    }

    const config = readConfigState();

    if (!config.configured) {
      const message =
        `Cannot re-fetch contact: ` +
        `${config.missing.join(", ")} not configured.`;

      await log(db, {
        eventId,
        level: "warn",
        message,
      });

      await settle("skipped", message);

      return {
        outcome: "skipped",
        message,
      };
    }

    /*
     * Re-fetch the authoritative WildApricot record.
     * Membership/profile fields from the webhook itself
     * are intentionally ignored.
     */
    const contact = await fetchContact(
      input.contactId,
    );

    if (!contact) {
      const message =
        `Contact ${input.contactId} not found ` +
        `in WildApricot.`;

      await log(db, {
        eventId,
        level: "warn",
        message,
      });

      await settle("skipped", message);

      return {
        outcome: "skipped",
        message,
      };
    }

    const result = await upsertContact(
      db,
      contact,
    );

    await log(db, {
      eventId,
      message:
        `Synced contact ${input.contactId} ` +
        `from webhook (${input.messageType}` +
        `${input.action ? `/${input.action}` : ""}); ` +
        `status ${result.status}, matching ` +
        `${
          isMatchingEligible(result.status)
            ? "enabled"
            : "disabled"
        }.`,
    });

    await settle("processed");

    return {
      outcome: "processed",
    };
  } catch (error) {
    const message = errorMessage(error);

    await settle(
      "failed",
      message,
    );

    try {
      await log(db, {
        eventId,
        level: "error",
        message,
      });
    } catch (logError) {
      console.error(
        "[WildApricot webhook] Could not write error log:",
        errorMessage(logError),
      );
    }

    return {
      outcome: "failed",
      message,
    };
  }
}
