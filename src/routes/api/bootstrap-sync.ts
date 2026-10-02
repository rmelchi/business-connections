import { createFileRoute } from "@tanstack/react-router";

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return diff === 0;
}

export const Route = createFileRoute("/api/bootstrap-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expectedSecret = process.env["BOOTSTRAP_SYNC_SECRET"];

        if (!expectedSecret) {
          return Response.json(
            { error: "Bootstrap sync is not configured." },
            { status: 503 },
          );
        }

        const providedSecret =
          request.headers.get("x-bootstrap-secret") ?? "";

        if (!timingSafeEqual(providedSecret, expectedSecret)) {
          return Response.json(
            { error: "Unauthorized." },
            { status: 401 },
          );
        }

        try {
          const { runSync } = await import(
            "@/lib/wildapricot-sync.server"
          );

          const result = await runSync({
            kind: "full",
            since: null,
            triggerSource: "bootstrap",
            triggeredBy: "initial-cloudflare-bootstrap",
          });

          return Response.json(result);
        } catch (error) {
          console.error("Bootstrap sync failed");

          return Response.json(
            {
              status: "failed",
              error:
                error instanceof Error
                  ? error.message
                  : "Unknown bootstrap sync error",
            },
            { status: 500 },
          );
        }
      },
    },
  },
});
