import { createFileRoute } from "@tanstack/react-router";

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let diff = 0;

  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return diff === 0;
}

function errorMessage(error: unknown): string {
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

export const Route = createFileRoute("/api/bootstrap-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        /*
         * Temporary bootstrap protection.
         *
         * This route must be removed after the initial WildApricot
         * import is complete.
         */
        const expectedSecret =
          process.env["BOOTSTRAP_SYNC_SECRET"];

        if (!expectedSecret) {
          return Response.json(
            {
              error:
                "Bootstrap sync is not configured.",
            },
            {
              status: 503,
            },
          );
        }

        const providedSecret =
          request.headers.get("x-bootstrap-secret") ?? "";

        if (
          !timingSafeEqual(
            providedSecret,
            expectedSecret,
          )
        ) {
          return Response.json(
            {
              error: "Unauthorized.",
            },
            {
              status: 401,
            },
          );
        }

        /*
         * Batch controls.
         *
         * Cloudflare Free permits a limited number of external
         * subrequests per Worker invocation. Ten contacts per run
         * keeps the WildApricot + Supabase work safely below that
         * threshold.
         */
        const url = new URL(request.url);

        const requestedSkip = Number.parseInt(
          url.searchParams.get("skip") ?? "0",
          10,
        );

        const requestedLimit = Number.parseInt(
          url.searchParams.get("limit") ?? "10",
          10,
        );

        const skip =
          Number.isFinite(requestedSkip) &&
          requestedSkip >= 0
            ? requestedSkip
            : 0;

        /*
         * Never allow this temporary endpoint to process more than
         * ten contacts in one Worker invocation.
         */
        const limit =
          Number.isFinite(requestedLimit)
            ? Math.min(
                Math.max(requestedLimit, 1),
                10,
              )
            : 10;

        try {
          const [
            { fetchContacts },
            { toSyncInput },
            { supabaseAdmin },
          ] = await Promise.all([
            import("@/lib/wildapricot-client.server"),
            import("@/lib/wildapricot"),
            import(
              "@/integrations/supabase/client.server"
            ),
          ]);

          /*
           * Fetch the authoritative WildApricot membership list.
           *
           * fetchContacts already handles WildApricot pagination.
           */
          const contacts = await fetchContacts();

          const totalSeen = contacts.length;

          const batch = contacts.slice(
            skip,
            skip + limit,
          );

          let created = 0;
          let updated = 0;
          let failed = 0;

          const failureReasonCounts =
            new Map<string, number>();

          for (const contact of batch) {
            try {
              const input = toSyncInput(contact);

              /*
               * Check whether this WildApricot contact already has
               * a Business Connections profile.
               */
              const {
                data: existing,
                error: lookupError,
              } = await supabaseAdmin
                .from("profiles")
                .select("id")
                .eq(
                  "wildapricot_contact_id",
                  input.contactId,
                )
                .maybeSingle();

              if (lookupError) {
                throw lookupError;
              }

              /*
               * Use the same database synchronization function as
               * the normal production sync.
               */
              const { error: syncError } =
                await supabaseAdmin.rpc(
                  "sync_wildapricot_contact",
                  {
                    _contact_id:
                      input.contactId,
                    _name:
                      input.name,
                    _email:
                      input.email,
                    _phone:
                      input.phone,
                    _company:
                      input.company,
                    _membership_level:
                      input.membershipLevel,
                    _membership_status:
                      input.membershipStatus,
                  },
                );

              if (syncError) {
                throw syncError;
              }

              if (existing) {
                updated += 1;
              } else {
                created += 1;
              }
            } catch (error) {
              failed += 1;

              const reason =
                errorMessage(error);

              failureReasonCounts.set(
                reason,
                (
                  failureReasonCounts.get(
                    reason,
                  ) ?? 0
                ) + 1,
              );
            }
          }

          const nextSkip =
            skip + batch.length;

          const done =
            nextSkip >= totalSeen;

          return Response.json({
            status:
              failed > 0 &&
              created + updated === 0
                ? "failed"
                : "succeeded",

            totalSeen,

            batch: {
              skip,
              limit,
              processed: batch.length,
              created,
              updated,
              failed,
            },

            nextSkip:
              done ? null : nextSkip,

            done,

            failureReasons: [
              ...failureReasonCounts.entries(),
            ].map(
              ([message, count]) => ({
                message,
                count,
              }),
            ),
          });
        } catch (error) {
          return Response.json(
            {
              status: "failed",
              error:
                errorMessage(error),
            },
            {
              status: 500,
            },
          );
        }
      },
    },
  },
});
