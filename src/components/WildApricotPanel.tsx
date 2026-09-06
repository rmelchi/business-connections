import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import {
  getWildApricotStatus,
  runWildApricotSync,
  testWildApricotConnection,
  type IntegrationStatus,
} from "@/lib/wildapricot.functions";

/** Admin-only WildApricot connection and synchronization controls. */
export function WildApricotPanel() {
  const fetchStatus = useServerFn(getWildApricotStatus);
  const testConnection = useServerFn(testWildApricotConnection);
  const runSync = useServerFn(runWildApricotSync);

  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<"test" | "sync" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setStatus(await fetchStatus());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [fetchStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  const onTest = async () => {
    setBusy("test");
    setMessage(null);
    try {
      const result = await testConnection();
      setMessage(result.message);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
      void load();
    }
  };

  const onSync = async (kind: "full" | "incremental") => {
    setBusy("sync");
    setMessage(null);
    try {
      const result = await runSync({ data: { kind } });
      setMessage(
        result.status === "skipped"
          ? (result.error ?? "Sync skipped — integration not configured.")
          : `Sync ${result.status}: ${result.seen} seen · ${result.created} created · ${result.updated} updated · ${result.failed} failed.`,
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
      void load();
    }
  };

  const configured = status?.configured ?? false;

  return (
    <div className="surface-card mt-6 overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-6 py-5">
        <div>
          <h2 className="font-display text-lg font-semibold">WildApricot integration</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Identity and membership status are synchronized from WildApricot using the contact ID as
            the immutable external key. Lapsed or suspended members stop matching; their offers,
            requests and history are retained.
          </p>
        </div>
        <span
          className={
            configured
              ? "rounded-full bg-success/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-success"
              : "rounded-full bg-secondary px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
          }
        >
          {configured ? "Configured" : "Not configured"}
        </span>
      </div>

      <div className="space-y-5 px-6 py-5 text-sm">
        {error && <p className="text-destructive">{error}</p>}

        {status && !configured && (
          <div className="rounded-lg border border-border bg-surface p-4 text-muted-foreground">
            <p className="font-medium text-foreground">Credentials required</p>
            <p className="mt-1">
              Add {status.missing.join(" and ")} in Project Settings → Secrets. No live WildApricot
              calls are made until then — nothing below is simulated.
            </p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Fact label="Account ID" value={status?.accountId ?? "—"} />
          <Fact
            label="Webhook secret"
            value={status?.webhookSecretConfigured ? "Set" : "Not set"}
          />
          <Fact label="Last sync" value={formatTime(status?.lastRun?.startedAt)} />
          <Fact
            label="Last result"
            value={
              status?.lastRun
                ? `${status.lastRun.status} · ${status.lastRun.seen} seen · ${status.lastRun.failed} failed`
                : "Never run"
            }
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Fact label="Profiles" value={String(status?.memberCounts.total ?? 0)} />
          <Fact label="Active" value={String(status?.memberCounts.active ?? 0)} />
          <Fact label="Matching enabled" value={String(status?.memberCounts.matchingEnabled ?? 0)} />
          <Fact label="Linked to WildApricot" value={String(status?.memberCounts.linked ?? 0)} />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void onTest()}
            disabled={busy !== null}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-secondary disabled:opacity-60"
          >
            {busy === "test" ? "Testing…" : "Test connection"}
          </button>
          <button
            type="button"
            onClick={() => void onSync("full")}
            disabled={busy !== null}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            {busy === "sync" ? "Syncing…" : "Run full sync"}
          </button>
          <button
            type="button"
            onClick={() => void onSync("incremental")}
            disabled={busy !== null}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-secondary disabled:opacity-60"
          >
            Incremental sync
          </button>
          <span className="text-xs text-muted-foreground">
            Webhook endpoint: <code>{status?.webhookPath ?? "/api/public/wildapricot/webhook"}</code>
          </span>
        </div>

        {message && <p className="rounded-lg bg-surface px-4 py-3 text-muted-foreground">{message}</p>}

        {status && status.recentRuns.length > 0 && (
          <div>
            <p className="text-eyebrow">Recent sync runs</p>
            <ul className="mt-2 divide-y divide-border">
              {status.recentRuns.map((run) => (
                <li key={run.id} className="flex flex-wrap gap-3 py-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{run.kind}</span>
                  <span>{run.status}</span>
                  <span>{formatTime(run.startedAt)}</span>
                  <span>{run.seen} seen</span>
                  {run.failed > 0 && <span className="text-destructive">{run.failed} failed</span>}
                  {run.error && <span className="text-destructive">{run.error}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {status && (
          <div>
            <p className="text-eyebrow">Recent webhook events</p>
            {status.recentEvents.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                No webhook deliveries recorded yet.
              </p>
            ) : (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[46rem] text-left text-xs">
                  <thead className="text-eyebrow">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Received</th>
                      <th className="py-2 pr-4 font-medium">Message type</th>
                      <th className="py-2 pr-4 font-medium">Action</th>
                      <th className="py-2 pr-4 font-medium">Contact ID</th>
                      <th className="py-2 pr-4 font-medium">Outcome</th>
                      <th className="py-2 font-medium">Detail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-muted-foreground">
                    {status.recentEvents.map((event) => (
                      <tr key={event.id}>
                        <td className="py-2 pr-4 whitespace-nowrap">{formatTime(event.createdAt)}</td>
                        <td className="py-2 pr-4 font-medium text-foreground">{event.type}</td>
                        <td className="py-2 pr-4">{event.action || "—"}</td>
                        <td className="py-2 pr-4">{event.contactId ?? "—"}</td>
                        <td className="py-2 pr-4">
                          <span
                            className={
                              event.status === "failed"
                                ? "text-destructive"
                                : event.status === "processed"
                                  ? "text-foreground"
                                  : undefined
                            }
                          >
                            {event.status}
                          </span>
                        </td>
                        <td className="py-2">{event.error ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-3">
      <p className="text-eyebrow">{label}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function formatTime(value?: string | null) {
  if (!value) return "Never";
  return new Date(value).toLocaleString();
}
