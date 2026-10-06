import { Link } from "@tanstack/react-router";

import { scoreLabel } from "@/lib/matching";
import { useStore } from "@/lib/store";
import type { Match } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ScoreDial({
  score,
  size = 56,
}: {
  score: number;
  size?: number;
}) {
  const pct = Math.round(score * 100);

  return (
    <div
      className="relative grid shrink-0 place-items-center rounded-full"
      style={{
        width: size,
        height: size,
        background: `conic-gradient(var(--brass) ${
          pct * 3.6
        }deg, var(--secondary) 0deg)`,
      }}
      aria-label={`Match score ${pct} percent`}
    >
      <div
        className="grid place-items-center rounded-full bg-card font-semibold"
        style={{
          width: size - 10,
          height: size - 10,
          fontSize: size / 4.6,
        }}
      >
        {pct}
      </div>
    </div>
  );
}

export function MutualBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-ink px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-ink-foreground">
      <span className="size-1.5 rounded-full bg-brass" />
      Mutual Opportunity
    </span>
  );
}

export function MatchCard({
  match,
  perspective,
}: {
  match: Match;
  perspective: string;
}) {
  const {
    memberById,
    offerById,
    requestById,
    setInterest,
  } = useStore();

  const outbound =
    match.requester_id === perspective;

  const counterpart = memberById(
    outbound
      ? match.provider_id
      : match.requester_id,
  );

  const offer = offerById(match.offer_id);
  const request = requestById(match.request_id);

  const interested =
    match.requester_interest === "interested";

  const dismissed =
    match.requester_interest === "not_relevant";

  const ownListingLabel = outbound
    ? "Your request"
    : "Your offer";

  const ownListingTitle = outbound
    ? request?.title
    : offer?.title;

  return (
    <article
      className={cn(
        "surface-card group p-6 transition-shadow hover:shadow-[var(--shadow-lift)]",
        match.reciprocal &&
          "border-brass/50 ring-1 ring-brass/25",
        dismissed && "opacity-55",
      )}
    >
      <div className="flex items-start gap-5">
        <ScoreDial score={match.score} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {match.reciprocal && (
              <MutualBadge />
            )}

            <span className="text-eyebrow">
              {scoreLabel(match.score)} ·{" "}
              {ownListingLabel}
            </span>
          </div>

          <h3 className="mt-2 font-display text-xl font-semibold leading-snug">
            <Link
              to="/matches/$matchId"
              params={{
                matchId: match.id,
              }}
              className="hover:underline"
            >
              {offer?.title}
            </Link>
          </h3>

          <p className="mt-1 text-sm text-muted-foreground">
            {counterpart?.company} ·{" "}
            {counterpart?.name} ·{" "}
            {counterpart?.geography}
          </p>

          <p className="mt-4 text-sm leading-relaxed text-foreground/85">
            {match.explanation}
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-md bg-surface p-3.5">
              <p className="text-eyebrow">
                Request excerpt
              </p>

              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                {match.request_excerpt}
              </p>
            </div>

            <div className="rounded-md bg-surface p-3.5">
              <p className="text-eyebrow">
                Offer excerpt
              </p>

              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                {match.offer_excerpt}
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button
              onClick={() =>
                setInterest(
                  match.id,
                  interested
                    ? "none"
                    : "interested",
                )
              }
              className={cn(
                "rounded-sm px-3.5 py-2 text-sm font-medium transition-colors",
                interested
                  ? "bg-success text-success-foreground"
                  : "bg-primary text-primary-foreground hover:bg-primary/90",
              )}
            >
              {interested
                ? "Interest registered"
                : "I'm interested"}
            </button>

            <button
              onClick={() =>
                setInterest(
                  match.id,
                  dismissed
                    ? "none"
                    : "not_relevant",
                )
              }
              className="rounded-sm border border-input px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary"
            >
              {dismissed
                ? "Restore"
                : "Not relevant"}
            </button>

            <Link
              to="/matches/$matchId"
              params={{
                matchId: match.id,
              }}
              className="ml-auto text-sm font-medium text-foreground underline-offset-4 hover:underline"
            >
              View match detail →
            </Link>
          </div>

          {ownListingTitle && (
            <p className="mt-3 text-xs text-muted-foreground">
              {ownListingLabel}:{" "}
              <span className="text-foreground/80">
                {ownListingTitle}
              </span>
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
