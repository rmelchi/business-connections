/**
 * Pure WildApricot webhook payload handling.
 *
 * Kept free of secrets, network and database access so it can be unit-tested
 * and reasoned about on its own. WildApricot delivers several shapes:
 *
 *   { "MessageType": "ContactModified",
 *     "AccountId": 453118,
 *     "Parameters": { "Action": "Changed", "Contact.Id": "12345" } }
 *
 *   { "MessageType": "Membership",
 *     "AccountId": 453118,
 *     "Parameters": { "Action": "StatusChanged", "Contact.Id": "12345",
 *                     "Membership.Status": "Lapsed" } }
 *
 * The payload is only ever used to learn *which* contact changed. The
 * authoritative record is re-fetched from the WildApricot API afterwards —
 * status or profile details inside the payload are never trusted.
 */
import { z } from "zod";

export const webhookPayloadSchema = z
  .object({
    MessageType: z.string().min(1).max(120).optional(),
    Action: z.string().min(1).max(120).optional(),
    AccountId: z.union([z.string(), z.number()]).optional(),
    Parameters: z
      .object({
        Action: z.string().max(120).optional(),
        "Contact.Id": z.union([z.string(), z.number()]).optional(),
        "Membership.Status": z.string().max(60).optional(),
      })
      .passthrough()
      .optional(),
    ContactId: z.union([z.string(), z.number()]).optional(),
    EventId: z.union([z.string(), z.number()]).optional(),
  })
  .passthrough();

export type WebhookPayload = z.infer<typeof webhookPayloadSchema>;

/** Message types this app acts on. Anything else is recorded and ignored. */
export const HANDLED_MESSAGE_TYPES = [
  "contact",
  "contactmodified",
  "contactcreated",
  "contactdeleted",
  "membership",
  "membershipenabled",
  "membershipdisabled",
  "membershiplapsed",
  "membershipstatuschanged",
] as const;

export interface NormalizedWebhookEvent {
  messageType: string;
  action: string;
  /** Null when absent, zero or malformed — never used to touch a profile. */
  contactId: string | null;
  contactIdRaw: string | null;
  accountId: string | null;
  membershipStatusHint: string | null;
  handled: boolean;
}

/**
 * A WildApricot contact id is a positive integer. Zero, empty, `null`,
 * non-numeric junk and oversized values are rejected so a malformed delivery
 * can never be mistaken for a real contact.
 */
export function parseContactId(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!/^\d{1,18}$/.test(raw)) return null;
  const normalized = raw.replace(/^0+/, "");
  if (normalized === "") return null;
  return normalized;
}

export function normalizeWebhookEvent(payload: WebhookPayload): NormalizedWebhookEvent {
  const messageType = (payload.MessageType ?? payload.Action ?? "Unknown").trim();
  const action = (payload.Parameters?.Action ?? payload.Action ?? "").trim();
  const contactIdRawValue = payload.Parameters?.["Contact.Id"] ?? payload.ContactId;
  const contactIdRaw =
    contactIdRawValue === undefined || contactIdRawValue === null
      ? null
      : String(contactIdRawValue).slice(0, 64);
  const accountIdValue = payload.AccountId;

  const key = `${messageType}${action}`.toLowerCase().replace(/[^a-z]/g, "");
  const typeKey = messageType.toLowerCase().replace(/[^a-z]/g, "");

  return {
    messageType: messageType || "Unknown",
    action,
    contactId: parseContactId(contactIdRawValue),
    contactIdRaw,
    accountId: accountIdValue === undefined ? null : String(accountIdValue).trim(),
    membershipStatusHint: payload.Parameters?.["Membership.Status"] ?? null,
    handled: HANDLED_MESSAGE_TYPES.some((t) => typeKey.startsWith(t) || key.startsWith(t)),
  };
}

/**
 * Stable identity for a delivery, so a retry is recognised as a duplicate.
 * WildApricot does not always send an event id, so a deterministic hash of the
 * body is used as the fallback.
 */
export function buildExternalEventId(
  payload: WebhookPayload,
  event: NormalizedWebhookEvent,
  bodyHash: string,
): string {
  if (payload.EventId !== undefined && payload.EventId !== null) {
    return `wa:${String(payload.EventId)}`;
  }
  return `${event.messageType}:${event.action || "-"}:${event.contactId ?? event.contactIdRaw ?? "none"}:${bodyHash}`;
}

/** Account gate: events for any other WildApricot account are ignored. */
export function accountMatches(eventAccountId: string | null, configuredAccountId: string | null): boolean {
  if (!configuredAccountId) return false;
  if (!eventAccountId) return true; // payload omitted it; secret already proved the caller
  return eventAccountId.replace(/^0+/, "") === configuredAccountId.trim().replace(/^0+/, "");
}
