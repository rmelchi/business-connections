import { createFileRoute } from "@tanstack/react-router";

import {
  accountMatches,
  buildExternalEventId,
  normalizeWebhookEvent,
  webhookPayloadSchema,
} from "@/lib/wildapricot-webhook";

/**
 * WildApricot webhook receiver.
 *
 * Configure this URL in WildApricot (Settings → Integration → Webhooks) and set
 * the same shared secret in Project Settings → Secrets as
 * `WILDAPRICOT_WEBHOOK_SECRET`. The secret is expected on the request as either
 * `X-WildApricot-Secret` or `?token=`. Secrets are compared server-side only
 * and never echoed back in a response, a log line or the admin UI.
 *
 * Deliveries are only trusted for the configured account id, the payload is
 * used solely to identify which contact changed, and processing is idempotent:
 * every delivery is recorded under a unique external event id, so a retried
 * delivery is acknowledged without re-applying changes.
 */

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hashPayload(body: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

export const Route = createFileRoute("/api/public/wildapricot/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["WILDAPRICOT_WEBHOOK_SECRET"];
        const configuredAccountId = process.env["WILDAPRICOT_ACCOUNT_ID"] ?? null;
        if (!secret) {
          return Response.json(
            { error: "Webhook receiver is not configured (WILDAPRICOT_WEBHOOK_SECRET missing)." },
            { status: 503 },
          );
        }

        const url = new URL(request.url);
        const provided =
          request.headers.get("x-wildapricot-secret") ?? url.searchParams.get("token") ?? "";
        if (!timingSafeEqual(provided, secret)) {
          return new Response("Invalid signature", { status: 401 });
        }

        const body = await request.text();
        let payload;
        try {
          payload = webhookPayloadSchema.parse(JSON.parse(body));
        } catch {
          return Response.json({ error: "Invalid payload" }, { status: 400 });
        }

        const event = normalizeWebhookEvent(payload);

        // Account gate — a delivery for a different WildApricot account is
        // rejected without touching any profile.
        if (!accountMatches(event.accountId, configuredAccountId)) {
          return Response.json(
            {
              outcome: "ignored",
              message: configuredAccountId
                ? "Event belongs to a different WildApricot account."
                : "WILDAPRICOT_ACCOUNT_ID is not configured.",
            },
            { status: configuredAccountId ? 200 : 503 },
          );
        }

        const externalEventId = buildExternalEventId(payload, event, await hashPayload(body));

        const { processWebhookEvent } = await import("@/lib/wildapricot-sync.server");
        const result = await processWebhookEvent({
          externalEventId,
          messageType: event.messageType,
          action: event.action,
          contactId: event.contactId,
          contactIdRaw: event.contactIdRaw,
          accountId: event.accountId ?? configuredAccountId,
          handled: event.handled,
          payload,
        });

        // Always 200 on a verified delivery so WildApricot does not hot-retry;
        // failures are recorded in the sync log for admin review.
        return Response.json({ outcome: result.outcome, message: result.message ?? null });
      },
    },
  },
});
