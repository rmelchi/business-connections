import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { AppShell } from "@/components/AppShell";
import { ListingForm } from "@/components/ListingForm";
import { useStore } from "@/lib/store";
import type { Request } from "@/lib/types";

export const Route = createFileRoute("/requests")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { new?: boolean } =>
    search["new"] === true ? { new: true } : {},

  head: () => ({
    meta: [
      {
        title: "Requests — Business Match",
      },
      {
        name: "description",
        content:
          "Publish what your company is looking for and let the network surface matching offers.",
      },
      {
        property: "og:title",
        content: "Requests — Business Match",
      },
      {
        property: "og:description",
        content:
          "Manage your published B2B requests.",
      },
    ],
  }),

  component: RequestsPage,
});

function RequestsPage() {
  const search = Route.useSearch();

  const {
    currentMember,
    requests,
    toggleListingStatus,
    matches,
  } = useStore();

  const [creating, setCreating] =
    useState(Boolean(search.new));

  const [editing, setEditing] =
    useState<Request | null>(null);

  const me = currentMember;

  if (!me) {
    return (
      <AppShell title="Requests">
        {null}
      </AppShell>
    );
  }

  const mine = requests.filter(
    (request) => request.member_id === me.id,
  );

  const closeForm = () => {
    setCreating(false);
    setEditing(null);
  };

  const startCreating = () => {
    setEditing(null);
    setCreating(true);
  };

  const startEditing = (request: Request) => {
    setCreating(false);
    setEditing(request);

    if (typeof window !== "undefined") {
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }
  };

  return (
    <AppShell
      eyebrow="What you're looking for"
      title="Requests"
      description="Each request is scored against every eligible member offer. Add an expiration date for time-bound needs."
      actions={
        !creating &&
        !editing && (
          <button
            onClick={startCreating}
            className="rounded-sm bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Add request
          </button>
        )
      }
    >
      {(creating || editing) && (
        <div className="mb-8">
          <ListingForm
            kind="request"
            initial={editing}
            onDone={closeForm}
          />
        </div>
      )}

      <div className="grid gap-4">
        {mine.map((request) => {
          const count = matches.filter(
            (match) =>
              match.request_id === request.id,
          ).length;

          return (
            <article
              key={request.id}
              className="surface-card p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-eyebrow">
                    {request.category} ·{" "}
                    {request.industry}
                  </p>

                  <h2 className="mt-1.5 font-display text-xl font-semibold">
                    {request.title}
                  </h2>
                </div>

                <span
                  className={
                    request.status === "active"
                      ? "rounded-full bg-success/12 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-success"
                      : "rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                  }
                >
                  {request.status}
                </span>
              </div>

              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {request.description}
              </p>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {request.keywords.map(
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
                  {request.geography} ·{" "}
                  {request.audience.toUpperCase()} ·{" "}
                  {request.product_service} ·
                  created{" "}
                  {new Date(
                    request.created_at,
                  ).toLocaleDateString()}

                  {request.expires_at
                    ? ` · expires ${new Date(
                        request.expires_at,
                      ).toLocaleDateString()}`
                    : " · no expiration"}

                  {" · "}
                  {count} match
                  {count === 1 ? "" : "es"}
                </span>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() =>
                      startEditing(request)
                    }
                    className="rounded-sm border border-input px-3 py-1.5 font-medium text-foreground transition-colors hover:bg-secondary"
                  >
                    Edit
                  </button>

                  <button
                    onClick={() =>
                      toggleListingStatus(
                        "request",
                        request.id,
                      )
                    }
                    className="rounded-sm border border-input px-3 py-1.5 font-medium text-foreground transition-colors hover:bg-secondary"
                  >
                    {request.status === "active"
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
              You haven't published a request
              yet.
            </p>
          )}
      </div>
    </AppShell>
  );
}
