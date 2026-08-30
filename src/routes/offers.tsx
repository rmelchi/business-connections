import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { AppShell } from "@/components/AppShell";
import { ListingForm } from "@/components/ListingForm";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/offers")({
  validateSearch: (search: Record<string, unknown>) => ({ new: search["new"] === true }),
  head: () => ({
    meta: [
      { title: "Offers — Business Match" },
      {
        name: "description",
        content: "Publish and manage what your company can provide to other members.",
      },
      { property: "og:title", content: "Offers — Business Match" },
      { property: "og:description", content: "Manage your published B2B offers." },
    ],
  }),
  component: OffersPage,
});

function OffersPage() {
  const search = Route.useSearch();
  const { currentMember, offers, toggleListingStatus, matches } = useStore();
  const [creating, setCreating] = useState(Boolean(search.new));
  const me = currentMember;
  if (!me) return <AppShell title="Offers">{null}</AppShell>;

  const mine = offers.filter((o) => o.member_id === me.id);

  return (
    <AppShell
      eyebrow="What you provide"
      title="Offers"
      description="Each offer is matched independently against other members' requests. Detailed descriptions produce better matches."
      actions={
        !creating && (
          <button
            onClick={() => setCreating(true)}
            className="rounded-sm bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Add offer
          </button>
        )
      }
    >
      {creating && (
        <div className="mb-8">
          <ListingForm kind="offer" onDone={() => setCreating(false)} />
        </div>
      )}

      <div className="grid gap-4">
        {mine.map((o) => {
          const count = matches.filter((m) => m.offer_id === o.id).length;
          return (
            <article key={o.id} className="surface-card p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-eyebrow">
                    {o.category} · {o.industry}
                  </p>
                  <h2 className="mt-1.5 font-display text-xl font-semibold">{o.title}</h2>
                </div>
                <span
                  className={
                    o.status === "active"
                      ? "rounded-full bg-success/12 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-success"
                      : "rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                  }
                >
                  {o.status}
                </span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{o.description}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {o.keywords.map((k) => (
                  <span key={k} className="rounded-full bg-surface px-2.5 py-1 text-xs text-muted-foreground">
                    {k}
                  </span>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-xs text-muted-foreground">
                <span>
                  {o.geography} · {o.audience.toUpperCase()} · {o.product_service} · created{" "}
                  {new Date(o.created_at).toLocaleDateString()} · updated{" "}
                  {new Date(o.updated_at).toLocaleDateString()} · {count} match
                  {count === 1 ? "" : "es"}
                </span>
                <button
                  onClick={() => toggleListingStatus("offer", o.id)}
                  className="rounded-sm border border-input px-3 py-1.5 font-medium text-foreground transition-colors hover:bg-secondary"
                >
                  {o.status === "active" ? "Deactivate" : "Activate"}
                </button>
              </div>
            </article>
          );
        })}
        {mine.length === 0 && !creating && (
          <p className="surface-card p-8 text-sm text-muted-foreground">
            You haven't published an offer yet.
          </p>
        )}
      </div>
    </AppShell>
  );
}
