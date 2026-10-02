// Server-side Supabase client for Cloudflare Workers.
//
// SECURITY:
// This client uses the Supabase secret/service-role key and therefore
// bypasses Row Level Security. It must only be imported by trusted
// server-side code.
//
// Cloudflare Workers exposes runtime variables and secrets through
// `cloudflare:workers`, rather than relying on Lovable's process.env setup.

import { env } from "cloudflare:workers";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "./types";

function isNewSupabaseApiKey(value: string): boolean {
  return (
    value.startsWith("sb_publishable_") ||
    value.startsWith("sb_secret_")
  );
}

/**
 * Supabase's newer sb_secret_ keys are opaque API keys rather than
 * JWT bearer tokens. Ensure they are sent as the apikey header.
 */
function createSupabaseFetch(
  supabaseKey: string,
): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" &&
        input instanceof Request
        ? input.headers
        : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach(
        (value, key) => {
          headers.set(key, value);
        },
      );
    }

    /*
     * The Supabase JS client may try to use the supplied key as
     * a Bearer token. New sb_secret_ / sb_publishable_ keys are
     * opaque API keys, not JWTs.
     */
    if (
      isNewSupabaseApiKey(supabaseKey) &&
      headers.get("Authorization") ===
        `Bearer ${supabaseKey}`
    ) {
      headers.delete("Authorization");
    }

    headers.set("apikey", supabaseKey);

    return fetch(input, {
      ...init,
      headers,
    });
  };
}

function createSupabaseAdminClient() {
  /*
   * Cloudflare Worker runtime bindings.
   *
   * SUPABASE_URL is a normal Production variable.
   * SUPABASE_SERVICE_ROLE_KEY is an encrypted Production secret.
   */
  const SUPABASE_URL =
    env.SUPABASE_URL as string | undefined;

  const SUPABASE_SERVICE_ROLE_KEY =
    env.SUPABASE_SERVICE_ROLE_KEY as
      | string
      | undefined;

  if (
    !SUPABASE_URL ||
    !SUPABASE_SERVICE_ROLE_KEY
  ) {
    const missing = [
      ...(!SUPABASE_URL
        ? ["SUPABASE_URL"]
        : []),

      ...(!SUPABASE_SERVICE_ROLE_KEY
        ? ["SUPABASE_SERVICE_ROLE_KEY"]
        : []),
    ];

    const message =
      `Missing Supabase environment variable(s): ` +
      `${missing.join(", ")}.`;

    console.error(
      `[Supabase] ${message}`,
    );

    throw new Error(message);
  }

  return createClient<Database>(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    {
      global: {
        fetch: createSupabaseFetch(
          SUPABASE_SERVICE_ROLE_KEY,
        ),
      },

      auth: {
        storage: undefined,
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}

let _supabaseAdmin:
  | ReturnType<
      typeof createSupabaseAdminClient
    >
  | undefined;

/**
 * Lazy server-only Supabase administrator client.
 *
 * Using a Proxy prevents creation of the privileged client until
 * trusted server code actually accesses it.
 */
export const supabaseAdmin =
  new Proxy(
    {} as ReturnType<
      typeof createSupabaseAdminClient
    >,
    {
      get(_, prop, receiver) {
        if (!_supabaseAdmin) {
          _supabaseAdmin =
            createSupabaseAdminClient();
        }

        return Reflect.get(
          _supabaseAdmin,
          prop,
          receiver,
        );
      },
    },
  );
