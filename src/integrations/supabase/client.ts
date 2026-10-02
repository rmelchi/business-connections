// Browser-side Supabase client.
//
// In production on Cloudflare this uses normal localStorage.
// On a Lovable preview surface, brokeredPreviewStorage() can still
// share authentication with the Lovable editor.

import { createClient } from "@supabase/supabase-js";

import type { Database } from "./types";
import { brokeredPreviewStorage } from "./previewAuthStorage";

function isNewSupabaseApiKey(
  value: string,
): boolean {
  return (
    value.startsWith("sb_publishable_") ||
    value.startsWith("sb_secret_")
  );
}

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
        (value, key) =>
          headers.set(key, value),
      );
    }

    /*
     * New Supabase API keys are opaque API keys,
     * rather than JWT bearer tokens.
     */
    if (
      isNewSupabaseApiKey(supabaseKey) &&
      headers.get("Authorization") ===
        `Bearer ${supabaseKey}`
    ) {
      headers.delete("Authorization");
    }

    headers.set(
      "apikey",
      supabaseKey,
    );

    return fetch(input, {
      ...init,
      headers,
    });
  };
}

function createSupabaseClient() {
  /*
   * These values must be available to the browser at BUILD time.
   *
   * Vite exposes VITE_* variables to client-side code.
   */
  const SUPABASE_URL =
    import.meta.env[
      "VITE_SUPABASE_URL"
    ] ||
    process.env["SUPABASE_URL"];

  const SUPABASE_PUBLISHABLE_KEY =
    import.meta.env[
      "VITE_SUPABASE_PUBLISHABLE_KEY"
    ] ||
    process.env[
      "SUPABASE_PUBLISHABLE_KEY"
    ];

  if (
    !SUPABASE_URL ||
    !SUPABASE_PUBLISHABLE_KEY
  ) {
    const missing = [
      ...(!SUPABASE_URL
        ? ["SUPABASE_URL"]
        : []),

      ...(!SUPABASE_PUBLISHABLE_KEY
        ? ["SUPABASE_PUBLISHABLE_KEY"]
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
    SUPABASE_PUBLISHABLE_KEY,
    {
      global: {
        fetch: createSupabaseFetch(
          SUPABASE_PUBLISHABLE_KEY,
        ),
      },

      auth: {
        storage:
          brokeredPreviewStorage(),

        persistSession: true,

        autoRefreshToken: true,

        /*
         * IMPORTANT:
         *
         * Supabase magic-link authentication returns the
         * authenticated session in the callback URL.
         *
         * This tells the browser client to detect that
         * session automatically and save it.
         */
        detectSessionInUrl: true,
      },
    },
  );
}

let _supabase:
  | ReturnType<
      typeof createSupabaseClient
    >
  | undefined;

/*
 * Lazy browser client.
 */
export const supabase =
  new Proxy(
    {} as ReturnType<
      typeof createSupabaseClient
    >,
    {
      get(_, prop, receiver) {
        if (!_supabase) {
          _supabase =
            createSupabaseClient();
        }

        return Reflect.get(
          _supabase,
          prop,
          receiver,
        );
      },
    },
  );
