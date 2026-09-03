import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * WildApricot webhook receiver.
 *
 * Configure this URL in WildApricot (Settings → Integration → Webhooks) and set
 * the same shared secret in Project Settings → Secrets as
 * `WILDAPRICOT_WEBHOOK_SECRET`. The secret is expected on the request as either
 * `X-WildApricot-Secret` or `?token=`.
 *
 * Processing is idempotent: every delivery is recorded under a unique external
 * event id, so a retried delivery is acknowledged without re-applying changes.
 */

const payloadSchema = z.object({
  MessageType: z.string().min(1).max(120).optional(),
  Action: z.string().min(1).max(120).optional(),
  AccountId: z.union([z.string(), z.number()]).optional(),
  Parameters: z
    .object({
      "Contact.Id": z.union([z.string(), z.number()]).optional(),
      "Membership.Status": z.string().max(60).optional(),
    })
    .passthrough()
    .optional(),
  ContactId: z.union([z.string(), z.number()]).optional(),
  EventId: z.union([z.string(), z.number()]).optional(),
});

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
        let parsed: z.infer<typeof payloadSchema>;
        try {
          parsed = payloadSchema.parse(JSON.parse(body));
        } catch {
          return Response.json({ error: "Invalid payload" }, { status: 400 });
        }

        const contactIdRaw = parsed.Parameters?.["Contact.Id"] ?? parsed.ContactId;
        const contactId = contactIdRaw === undefined ? null : String(contactIdRaw);
        const eventType = parsed.MessageType ?? parsed.Action ?? "Contact.Modified";
        const externalEventId =
          parsed.EventId !== undefined
            ? String(parsed.EventId)
            : `${eventType}:${contactId ?? "unknown"}:${await hashPayload(body)}`;

        const { processWebhookEvent } = await import("@/lib/wildapricot-sync.server");
        const result = await processWebhookEvent({
          externalEventId,
          eventType,
          contactId,
          payload: parsed,
        });

        // Always 200 on a verified delivery so WildApricot does not hot-retry;
        // failures are recorded in the sync log for admin review.
        return Response.json({ outcome: result.outcome, message: result.message ?? null });
      },
    },
  },
});
