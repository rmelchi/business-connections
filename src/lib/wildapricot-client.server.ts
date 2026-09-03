/**
 * Server-only WildApricot REST client.
 *
 * Credentials are read from backend secrets at call time and never reach the
 * browser. Nothing in this module is imported from client-reachable modules at
 * module scope — load it with `await import(...)` inside a handler.
 *
 * Secrets used (Project Settings -> Secrets):
 *   WILDAPRICOT_ACCOUNT_ID   numeric WildApricot account id
 *   WILDAPRICOT_API_KEY      authorized application API key (server credential)
 *   WILDAPRICOT_WEBHOOK_SECRET  shared secret for the webhook receiver
 */
import type { WildApricotContact } from "./wildapricot";

const TOKEN_URL = "https://oauth.wildapricot.org/auth/token";
const API_BASE = "https://api.wildapricot.org/v2.2";

export interface WildApricotConfig {
  accountId: string;
  apiKey: string;
}

export class WildApricotNotConfiguredError extends Error {
  readonly missing: string[];
  constructor(missing: string[]) {
    super(`WildApricot is not configured. Missing secret(s): ${missing.join(", ")}.`);
    this.name = "WildApricotNotConfiguredError";
    this.missing = missing;
  }
}

export class WildApricotApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "WildApricotApiError";
    this.status = status;
  }
}

/** Which credentials are present — safe to expose (never returns values). */
export function readConfigState(): {
  configured: boolean;
  missing: string[];
  accountId: string | null;
  webhookSecretConfigured: boolean;
} {
  const accountId = process.env["WILDAPRICOT_ACCOUNT_ID"] ?? "";
  const apiKey = process.env["WILDAPRICOT_API_KEY"] ?? "";
  const missing = [
    ...(accountId ? [] : ["WILDAPRICOT_ACCOUNT_ID"]),
    ...(apiKey ? [] : ["WILDAPRICOT_API_KEY"]),
  ];
  return {
    configured: missing.length === 0,
    missing,
    accountId: accountId || null,
    webhookSecretConfigured: Boolean(process.env["WILDAPRICOT_WEBHOOK_SECRET"]),
  };
}

export function requireConfig(): WildApricotConfig {
  const state = readConfigState();
  if (!state.configured) throw new WildApricotNotConfiguredError(state.missing);
  return {
    accountId: process.env["WILDAPRICOT_ACCOUNT_ID"]!,
    apiKey: process.env["WILDAPRICOT_API_KEY"]!,
  };
}

interface CachedToken {
  token: string;
  expiresAt: number;
}

/** Per-isolate token cache; workers are stateless, so this is best-effort. */
let cachedToken: CachedToken | undefined;

/**
 * WildApricot API-key authentication: HTTP Basic `APIKEY:<key>` against the
 * OAuth token endpoint, client_credentials grant. Tokens live ~30 minutes and
 * are refreshed automatically 60s before expiry.
 */
export async function getAccessToken(force = false): Promise<string> {
  const { apiKey } = requireConfig();
  const now = Date.now();
  if (!force && cachedToken && cachedToken.expiresAt > now + 60_000) return cachedToken.token;

  const basic = btoa(`APIKEY:${apiKey}`);
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials&scope=auto",
  });

  if (!response.ok) {
    const detail = await safeText(response);
    throw new WildApricotApiError(
      `WildApricot token request failed (${response.status}). ${detail}`,
      response.status,
    );
  }

  const payload = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!payload.access_token) {
    throw new WildApricotApiError("WildApricot token response did not include an access token.", 502);
  }
  cachedToken = {
    token: payload.access_token,
    expiresAt: now + (payload.expires_in ?? 1800) * 1000,
  };
  return cachedToken.token;
}

async function safeText(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 400);
  } catch {
    return "";
  }
}

/** Authenticated GET against the WildApricot API, with one refresh retry on 401. */
export async function apiGet<T>(path: string): Promise<T> {
  const { accountId } = requireConfig();
  const url = `${API_BASE}/accounts/${accountId}${path}`;

  const attempt = async (token: string) =>
    fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });

  let response = await attempt(await getAccessToken());
  if (response.status === 401) response = await attempt(await getAccessToken(true));

  if (!response.ok) {
    throw new WildApricotApiError(
      `WildApricot API ${path} failed (${response.status}). ${await safeText(response)}`,
      response.status,
    );
  }
  return (await response.json()) as T;
}

/** Account metadata — the cheapest call, used by "Test connection". */
export async function fetchAccount(): Promise<{ Id: number; Name: string; PrimaryDomainName?: string }> {
  const { accountId } = requireConfig();
  const token = await getAccessToken();
  const response = await fetch(`${API_BASE}/accounts/${accountId}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!response.ok) {
    throw new WildApricotApiError(
      `WildApricot account lookup failed (${response.status}). ${await safeText(response)}`,
      response.status,
    );
  }
  return (await response.json()) as { Id: number; Name: string; PrimaryDomainName?: string };
}

interface RawContact {
  Id: number | string;
  FirstName?: string;
  LastName?: string;
  Email?: string;
  Organization?: string;
  Phone?: string;
  MembershipLevel?: { Name?: string } | null;
  Status?: string | null;
  FieldValues?: Array<{ FieldName?: string; SystemCode?: string; Value?: unknown }>;
}

function normalizeStatus(status: string | null | undefined): WildApricotContact["Status"] {
  switch ((status ?? "").toLowerCase()) {
    case "active":
      return "Active";
    case "lapsed":
      return "Lapsed";
    case "suspended":
      return "Suspended";
    default:
      return "PendingNew";
  }
}

function fieldValue(contact: RawContact, code: string): string {
  const entry = contact.FieldValues?.find((f) => f.SystemCode === code);
  const value = entry?.Value;
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "Label" in (value as Record<string, unknown>)) {
    return String((value as { Label?: unknown }).Label ?? "");
  }
  return "";
}

export function toContact(raw: RawContact): WildApricotContact {
  return {
    Id: String(raw.Id),
    FirstName: raw.FirstName ?? "",
    LastName: raw.LastName ?? "",
    Email: raw.Email ?? "",
    Organization: raw.Organization ?? fieldValue(raw, "Organization"),
    ...(raw.Phone ? { Phone: raw.Phone } : {}),
    MembershipLevel: { Name: raw.MembershipLevel?.Name ?? "Member" },
    Status: normalizeStatus(raw.Status),
  };
}

/** Fetch one contact by its immutable WildApricot contact id. */
export async function fetchContact(contactId: string): Promise<WildApricotContact | null> {
  try {
    const raw = await apiGet<RawContact>(`/contacts/${encodeURIComponent(contactId)}`);
    return toContact(raw);
  } catch (error) {
    if (error instanceof WildApricotApiError && error.status === 404) return null;
    throw error;
  }
}

/**
 * Fetch members, paging through the API. `modifiedSince` performs an
 * incremental pull using the WildApricot `Profile last updated` filter.
 */
export async function fetchContacts(options?: {
  modifiedSince?: string | null;
  pageSize?: number;
  maxPages?: number;
}): Promise<WildApricotContact[]> {
  const pageSize = options?.pageSize ?? 200;
  const maxPages = options?.maxPages ?? 50;
  const filters = ["'Member' eq true"];
  if (options?.modifiedSince) {
    filters.push(`'Profile last updated' ge ${options.modifiedSince}`);
  }
  const filter = encodeURIComponent(filters.join(" AND "));

  const all: WildApricotContact[] = [];
  for (let page = 0; page < maxPages; page += 1) {
    const path =
      `/contacts?$async=false&$filter=${filter}` +
      `&$top=${pageSize}&$skip=${page * pageSize}`;
    const result = await apiGet<{ Contacts?: RawContact[] }>(path);
    const batch = result.Contacts ?? [];
    all.push(...batch.map(toContact));
    if (batch.length < pageSize) break;
  }
  return all;
}
