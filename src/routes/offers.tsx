import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { AppShell } from "@/components/AppShell";
import { ListingForm } from "@/components/ListingForm";
import { useStore } from "@/lib/store";
import type { Offer } from "@/lib/types";

export const Route = createFileRoute("/offers")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { new?: boolean } =>
    search["new"] === true ? { new: true } : {},

  head: () => ({
    meta: [
      {
        title: "Offers — Business Match",
      },
      {
        name: "description",
        content:
          "Publish and manage what your company can provide to other members.",
      },
      {
        property: "og:title",
        content: "Offers — Business Match",
      },
      {
        property: "og:description",
        content:
          "Manage your published B2B offers.",
      },
    ],
  }),

  component: OffersPage,
});

function OffersPage() {
  const search = Route.useSearch();

  const {
    currentMember,
    offers,
    toggleListingStatus,
    matches,
  } = useStore();

  const [creating, setCreating] =
    useState(Boolean(search.new));

  const [editing, setEditing] =
    useState<Offer | null>(null);

  const me = currentMember;

  if (!me) {
    return (
      <AppShell title="Offers">
        {null}
      </AppShell>
    );
  }

  const mine = offers.filter(
    (offer) => offer.member_id === me.id,
  );

  const closeForm = () => {
    setCreating(false);
    setEditing(null);
  };

  const startCreating = () => {
    setEditing(null);
    setCreating(true);
  };

  const startEditing = (offer: Offer) => {
    setCreating(false);
    setEditing(offer);

    if (typeof window !== "undefined") {
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }
  };

  return (
    <AppShell
      eyebrow="What you provide"
      title="Offers"
      description="Each offer is matched independently against other members' requests. Detailed descriptions produce better matches."
      actions={
        !creating &&
        !editing && (
          <button
            onClick={startCreating}
            className="rounded-sm bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Add offer
          </button>
        )
      }
    >
      {(creating || editing) && (
        <div className="mb-8">
          <ListingForm
            kind="offer"
            initial={editing}
            onDone={closeForm}
          />
        </div>
      )}

      <div className="grid gap-4">
        {mine.map((offer) => {
          const count = matches.filter(
            (match) =>
              match.offer_id === offer.id,
          ).length;

          return (
            <article
              key={offer.id}
              className="surface-card p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-eyebrow">
                    {offer.category} ·{" "}
                    {offer.industry}
                  </p>

                  <h2 className="mt-1.5 font-display text-xl font-semibold">
                    {offer.title}
                  </h2>
                </div>

                <span
                  className={
                    offer.status === "active"
                      ? "rounded-full bg-success/12 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-success"
                      : "rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                  }
                >
                  {offer.status}
                </span>
              </div>

              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {offer.description}
              </p>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {offer.keywords.map(
                  (keyword) => (
                    <span
                      key={keyword}
                      className="rounded-full bg-surface px-2.5 py-1 text-xs text-muted-foreground"
                    >
                      {keyword}
                    </span>
                  ),
                )}
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-xs text-muted-foreground">
                <span>
                  {offer.geography} ·{" "}
                  {offer.audience.toUpperCase()} ·{" "}
                  {offer.product_service} ·
                  created{" "}
                  {new Date(
                    offer.created_at,
                  ).toLocaleDateString()}{" "}
                  · updated{" "}
                  {new Date(
                    offer.updated_at,
                  ).toLocaleDateString()}{" "}
                  · {count} match
                  {count === 1 ? "" : "es"}
                </span>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() =>
                      startEditing(offer)
                    }
                    className="rounded-sm border border-input px-3 py-1.5 font-medium text-foreground transition-colors hover:bg-secondary"
                  >
                    Edit
                  </button>

                  <button
                    onClick={() =>
                      toggleListingStatus(
                        "offer",
                        offer.id,
                      )
                    }
                    className="rounded-sm border border-input px-3 py-1.5 font-medium text-foreground transition-colors hover:bg-secondary"
                  >
                    {offer.status === "active"
                      ? "Deactivate"
                      : "Activate"}
                  </button>
                </div>
              </div>
            </article>
          );
        })}

        {mine.length === 0 &&
          !creating &&
          !editing && (
            <p className="surface-card p-8 text-sm text-muted-foreground">
              You haven't published an offer
              yet.
            </p>
          )}
      </div>
    </AppShell>
  );
}
