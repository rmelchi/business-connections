/**
 * WildApricot integration layer (scaffold).
 *
 * WildApricot is the authoritative source for member identity and membership
 * status. This module is the ONLY place the rest of the app should talk to it.
 * Today it resolves against local demo data; swapping `WildApricotClient` for a
 * REST-backed implementation (server function + API key secret) requires no
 * changes elsewhere.
 *
 * Planned surface:
 *   GET  /v2.2/accounts/{accountId}/contacts/{contactId}
 *   GET  /v2.2/accounts/{accountId}/contacts?$filter=...
 *   POST webhook -> /api/public/wildapricot/webhook  (Contact / Membership events)
 */
import type { Member, MembershipStatus } from "./types";

export interface WildApricotContact {
  Id: string;
  FirstName: string;
  LastName: string;
  Email: string;
  Organization: string;
  Phone?: string;
  MembershipLevel: { Name: string };
  Status: "Active" | "Lapsed" | "PendingNew" | "Suspended";
}

export type WildApricotWebhookEvent =
  | { type: "Contact.Modified"; contactId: string }
  | { type: "Membership.Enabled"; contactId: string }
  | { type: "Membership.Disabled"; contactId: string };

export interface WildApricotClient {
  getContact(contactId: string): Promise<WildApricotContact | null>;
  listContacts(): Promise<WildApricotContact[]>;
}

export function mapStatus(status: WildApricotContact["Status"]): MembershipStatus {
  switch (status) {
    case "Active":
      return "active";
    case "Lapsed":
      return "lapsed";
    case "Suspended":
      return "suspended";
    default:
      return "pending";
  }
}

/**
 * Applies a WildApricot contact onto a local member record.
 * Identity fields are overwritten; app-owned fields (bio, offers, requests,
 * matches) are never touched. A lapsed member is disabled for matching but
 * keeps all of their content.
 */
export function applyContactToMember(member: Member, contact: WildApricotContact): Member {
  const membership_status = mapStatus(contact.Status);
  return {
    ...member,
    wildapricot_contact_id: contact.Id,
    name: `${contact.FirstName} ${contact.LastName}`,
    email: contact.Email,
    ...(contact.Phone === undefined ? {} : { phone: contact.Phone }),
    company: contact.Organization,
    membership_level: contact.MembershipLevel.Name,
    membership_status,
    matching_enabled: membership_status === "active",
    last_synced_at: new Date().toISOString(),
  };
}

/** Fields this app must never write back to WildApricot. */
export const WILDAPRICOT_OWNED_FIELDS = [
  "name",
  "email",
  "phone",
  "company",
  "membership_level",
  "membership_status",
] as const;

export const WILDAPRICOT_SYNC_NOTE =
  "Identity and membership data is synchronized from WildApricot and cannot be edited here.";
