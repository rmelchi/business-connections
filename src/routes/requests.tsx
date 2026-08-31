import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { AppShell } from "@/components/AppShell";
import { ListingForm } from "@/components/ListingForm";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/requests")({
  validateSearch: (search: Record<string, unknown>) => ({ new: search["new"] === true }),
  head: () => ({
    meta: [
      { title: "Requests — Business Match" },
      {
        name: "description",
        content:
          "Publish what your company is looking for and let the network surface matching offers.",
      },
      { property: "og:title", content: "Requests — Business Match" },
      { property: "og:description", content: "Manage your published B2B requests." },
    ],
  }),
  component: RequestsPage,
});

function RequestsPage() {
  const search = Route.useSearch();
  const { currentMember, requests, toggleListingStatus, matches } = useStore();
  const [creating, setCreating] = useState(Boolean(search.new));
  const me = currentMember;
  if (!me) return <AppShell title="Requests">{null}</AppShell>;

  const mine = requests.filter((r) => r.member_id === me.id);

  return (
    <AppShell
      eyebrow="What you're looking for"
      title="Requests"
      description="Each request is scored against every eligible member offer. Add an expiration date for time-bound needs."
      actions={
        !creating && (
          <button
            onClick={() => setCreating(true)}
            className="rounded-sm bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Add request
          </button>
        )
      }
    >
      {creating && (
        <div className="mb-8">
          <ListingForm kind="request" onDone={() => setCreating(false)} />
        </div>
      )}

      <div className="grid gap-4">
        {mine.map((r) => {
          const count = matches.filter((m) => m.request_id === r.id).length;
          return (
            <article key={r.id} className="surface-card p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-eyebrow">
                    {r.category} · {r.industry}
                  </p>
                  <h2 className="mt-1.5 font-display text-xl font-semibold">{r.title}</h2>
                </div>
                <span
                  className={
                    r.status === "active"
                      ? "rounded-full bg-success/12 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-success"
                      : "rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                  }
                >
                  {r.status}
                </span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{r.description}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {r.keywords.map((k) => (
                  <span
                    key={k}
                    className="rounded-full bg-surface px-2.5 py-1 text-xs text-muted-foreground"
                  >
                    {k}
                  </span>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-xs text-muted-foreground">
                <span>
                  {r.geography} · {r.audience.toUpperCase()} · {r.product_service} · created{" "}
                  {new Date(r.created_at).toLocaleDateString()}
                  {r.expires_at
                    ? ` · expires ${new Date(r.expires_at).toLocaleDateString()}`
                    : " · no expiration"}{" "}
                  · {count} match{count === 1 ? "" : "es"}
                </span>
                <button
                  onClick={() => toggleListingStatus("request", r.id)}
                  className="rounded-sm border border-input px-3 py-1.5 font-medium text-foreground transition-colors hover:bg-secondary"
                >
                  {r.status === "active" ? "Deactivate" : "Activate"}
                </button>
              </div>
            </article>
          );
        })}
        {mine.length === 0 && !creating && (
          <p className="surface-card p-8 text-sm text-muted-foreground">
            You haven't published a request yet.
          </p>
        )}
      </div>
    </AppShell>
  );
}
