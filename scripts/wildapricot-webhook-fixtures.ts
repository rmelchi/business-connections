/**
 * Representative WildApricot webhook fixtures + a safe local test runner.
 *
 * Dry run (no network, checks payload parsing/normalisation only):
 *   bun scripts/wildapricot-webhook-fixtures.ts
 *
 * Live local run against the dev server (records events in the sync log):
 *   WILDAPRICOT_WEBHOOK_SECRET=<secret> \
 *     bun scripts/wildapricot-webhook-fixtures.ts --post
 *
 * The secret is read from the environment and never printed. Run against a
 * local/preview URL only.
 */
import {
  accountMatches,
  normalizeWebhookEvent,
  webhookPayloadSchema,
} from "../src/lib/wildapricot-webhook";

const ACCOUNT_ID = process.env["WILDAPRICOT_ACCOUNT_ID"] ?? "453118";
const BASE_URL = process.env["WEBHOOK_BASE_URL"] ?? "http://localhost:8080";
const CONTACT_ID = process.env["WILDAPRICOT_TEST_CONTACT_ID"] ?? "1000001";

export const fixtures: Array<{ name: string; expect: string; body: Record<string, unknown> }> = [
  {
    name: "Contact updated (valid)",
    expect: "processed (or skipped when the contact is unknown to WildApricot)",
    body: {
      MessageType: "ContactModified",
      AccountId: Number(ACCOUNT_ID),
      EventId: "fixture-contact-1",
      Parameters: { Action: "Changed", "Contact.Id": CONTACT_ID },
    },
  },
  {
    name: "Duplicate delivery of the same event",
    expect: "duplicate",
    body: {
      MessageType: "ContactModified",
      AccountId: Number(ACCOUNT_ID),
      EventId: "fixture-contact-1",
      Parameters: { Action: "Changed", "Contact.Id": CONTACT_ID },
    },
  },
  {
    name: "Membership lapsed",
    expect: "processed — status re-fetched from WildApricot, listings retained",
    body: {
      MessageType: "Membership",
      AccountId: Number(ACCOUNT_ID),
      EventId: "fixture-lapse-1",
      Parameters: {
        Action: "StatusChanged",
        "Contact.Id": CONTACT_ID,
        "Membership.Status": "Lapsed",
      },
    },
  },
  {
    name: "Membership reactivated",
    expect: "processed — matching re-enabled when WildApricot reports Active",
    body: {
      MessageType: "Membership",
      AccountId: Number(ACCOUNT_ID),
      EventId: "fixture-reactivate-1",
      Parameters: {
        Action: "Enabled",
        "Contact.Id": CONTACT_ID,
        "Membership.Status": "Active",
      },
    },
  },
  {
    name: "Zero Contact.Id",
    expect: "skipped — no profile changed",
    body: {
      MessageType: "ContactModified",
      AccountId: Number(ACCOUNT_ID),
      EventId: "fixture-zero-1",
      Parameters: { Action: "Changed", "Contact.Id": 0 },
    },
  },
  {
    name: "Missing Contact.Id",
    expect: "skipped — no profile changed",
    body: {
      MessageType: "ContactModified",
      AccountId: Number(ACCOUNT_ID),
      EventId: "fixture-missing-1",
      Parameters: { Action: "Changed" },
    },
  },
  {
    name: "Malformed Contact.Id",
    expect: "skipped — no profile changed",
    body: {
      MessageType: "ContactModified",
      AccountId: Number(ACCOUNT_ID),
      EventId: "fixture-malformed-1",
      Parameters: { Action: "Changed", "Contact.Id": "abc-123" },
    },
  },
  {
    name: "Foreign account",
    expect: "ignored — different WildApricot account",
    body: {
      MessageType: "ContactModified",
      AccountId: 999999,
      EventId: "fixture-foreign-1",
      Parameters: { Action: "Changed", "Contact.Id": CONTACT_ID },
    },
  },
  {
    name: "Unknown message type",
    expect: "ignored — not a contact/membership event",
    body: {
      MessageType: "EventRegistration",
      AccountId: Number(ACCOUNT_ID),
      EventId: "fixture-unknown-1",
      Parameters: { Action: "Created", "Contact.Id": CONTACT_ID },
    },
  },
];

async function main() {
  const post = process.argv.includes("--post");
  const secret = process.env["WILDAPRICOT_WEBHOOK_SECRET"];
  if (post && !secret) {
    console.error("WILDAPRICOT_WEBHOOK_SECRET must be set to post fixtures.");
    process.exit(1);
  }

  for (const fixture of fixtures) {
    const parsed = webhookPayloadSchema.parse(fixture.body);
    const event = normalizeWebhookEvent(parsed);
    const gate = accountMatches(event.accountId, ACCOUNT_ID);
    console.log(
      `\n${fixture.name}\n  expect: ${fixture.expect}\n  parsed: type=${event.messageType} action=${event.action || "-"} ` +
        `contactId=${event.contactId ?? "null"} handled=${event.handled} accountAllowed=${gate}`,
    );

    if (!post) continue;
    const response = await fetch(`${BASE_URL}/api/public/wildapricot/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-wildapricot-secret": secret! },
      body: JSON.stringify(fixture.body),
    });
    console.log(`  response: ${response.status} ${await response.text()}`);
  }
}

void main();
