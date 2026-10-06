import {
  createFileRoute,
  Link,
  useParams,
} from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { MutualBadge, ScoreDial } from "@/components/MatchCard";
import { scoreLabel } from "@/lib/matching";
import {
  useStore,
  type MutualInterestContact,
} from "@/lib/store";
import type { InterestState } from "@/lib/types";

export const Route = createFileRoute("/matches/$matchId")({
  head: () => ({
    meta: [
      { title: "Match detail — Business Match" },
      {
        name: "description",
        content:
          "Why this match scored, what each side published, and how to register interest.",
      },
      {
        property: "og:title",
        content: "Match detail — Business Match",
      },
      {
        property: "og:description",
        content:
          "Scoring breakdown and mutual-interest workflow for a member match.",
      },
    ],
  }),
  component: MatchDetailPage,
});

function MatchDetailPage() {
  const { matchId } = useParams({
    from: "/matches/$matchId",
  });

  const {
    matches,
    memberById,
    offerById,
    requestById,
    setInterest,
    getMutualInterestContact,
    currentMember,
  } = useStore();

  const match = matches.find((m) => m.id === matchId);

  const [contact, setContact] =
    useState<MutualInterestContact | null>(null);

  const [checkingContact, setCheckingContact] =
    useState(false);

  const loadContactState = useCallback(async () => {
    if (!match || !currentMember) return;

    setCheckingContact(true);

    try {
      const result = await getMutualInterestContact(match.id);
      setContact(result);
    } finally {
      setCheckingContact(false);
    }
  }, [
    match?.id,
    currentMember?.id,
    getMutualInterestContact,
  ]);

  useEffect(() => {
    void loadContactState();
  }, [loadContactState]);

  if (!currentMember || !match) {
    return (
      <AppShell title="Match not found" eyebrow="Matches">
        <p className="surface-card p-8 text-sm text-muted-foreground">
          This match no longer exists.{" "}
          <Link to="/matches" className="underline">
            Back to matches
          </Link>
        </p>
      </AppShell>
    );
  }

  const outbound =
    match.requester_id === currentMember.id;

  const counterpart = memberById(
    outbound
      ? match.provider_id
      : match.requester_id,
  )!;

  const offer = offerById(match.offer_id)!;
  const request = requestById(match.request_id)!;

  const interested =
    match.requester_interest === "interested";

  const mutualInterest =
    contact?.mutual_interest === true;

  const handleInterest = async (
    state: InterestState,
  ) => {
    await setInterest(match.id, state);
    await loadContactState();
  };

  return (
    <AppShell
      eyebrow={`${scoreLabel(match.score)} match`}
      title={offer.title}
      description={`${counterpart.company} · ${counterpart.geography}`}
      actions={
        <button
          onClick={() =>
            void handleInterest(
              interested ? "none" : "interested",
            )
          }
          className={
            interested
              ? "rounded-sm bg-success px-4 py-2.5 text-sm font-semibold text-success-foreground"
              : "rounded-sm bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          }
        >
          {interested
            ? "Interest registered"
            : "I'm interested"}
        </button>
      }
    >
      <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
        <div className="grid gap-6">
          <section className="surface-card p-6">
            <div className="flex items-start gap-5">
              <ScoreDial
                score={match.score}
                size={72}
              />

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  {match.reciprocal && <MutualBadge />}
                  <span className="text-eyebrow">
                    Why this match exists
                  </span>
                </div>

                <p className="mt-2 text-[15px] leading-relaxed">
                  {match.explanation}
                </p>

                {match.reciprocal && (
                  <p className="mt-3 rounded-md bg-surface p-3.5 text-sm leading-relaxed text-muted-foreground">
                    This is a{" "}
                    <strong className="text-foreground">
                      Mutual Opportunity
                    </strong>
                    : your request matches{" "}
                    {counterpart.company}'s offer, and their
                    request matches your offer. Reciprocal
                    pairs receive a scoring bonus because
                    both sides have a reason to respond.
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="surface-card p-6">
            <h2 className="font-display text-xl font-semibold">
              Score breakdown
            </h2>

            <div className="mt-4 grid gap-4">
              {match.factors.map((f) => (
                <div key={f.label}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-medium">
                      {f.label}{" "}
                      <span className="text-muted-foreground">
                        · {Math.round(f.weight * 100)}%
                        weight
                      </span>
                    </span>

                    <span className="font-semibold">
                      {Math.round(f.score * 100)}%
                    </span>
                  </div>

                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-brass"
                      style={{
                        width: `${Math.round(
                          f.score * 100,
                        )}%`,
                      }}
                    />
                  </div>

                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {f.detail}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <div className="grid gap-4 md:grid-cols-2">
            <section className="surface-card p-6">
              <p className="text-eyebrow">
                The request
              </p>

              <h3 className="mt-1.5 font-display text-lg font-semibold">
                {request.title}
              </h3>

              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {request.description}
              </p>

              <dl className="mt-4 grid gap-1 text-xs text-muted-foreground">
                <div>
                  Industry · {request.industry}
                </div>
                <div>
                  Geography · {request.geography}
                </div>
                <div>
                  {request.audience.toUpperCase()} ·{" "}
                  {request.product_service}
                </div>
              </dl>
            </section>

            <section className="surface-card p-6">
              <p className="text-eyebrow">
                The offer
              </p>

              <h3 className="mt-1.5 font-display text-lg font-semibold">
                {offer.title}
              </h3>

              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {offer.description}
              </p>

              <dl className="mt-4 grid gap-1 text-xs text-muted-foreground">
                <div>
                  Industry · {offer.industry}
                </div>
                <div>
                  Geography · {offer.geography}
                </div>
                <div>
                  {offer.audience.toUpperCase()} ·{" "}
                  {offer.product_service}
                </div>
              </dl>
            </section>
          </div>
        </div>

        <aside className="grid content-start gap-6">
          <section className="surface-card p-6">
            <p className="text-eyebrow">
              {outbound
                ? "Offering member"
                : "Requesting member"}
            </p>

            <div className="mt-3 flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-full bg-ink text-sm font-semibold text-ink-foreground">
                {counterpart.avatar_initials}
              </span>

              <div>
                <p className="font-medium">
                  {counterpart.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {counterpart.title}
                </p>
              </div>
            </div>

            <dl className="mt-4 grid gap-2 text-sm">
              <div>
                <dt className="text-eyebrow">
                  Company
                </dt>
                <dd>{counterpart.company}</dd>
              </div>

              <div>
                <dt className="text-eyebrow">
                  Geography
                </dt>
                <dd>{counterpart.geography}</dd>
              </div>

              <div>
                <dt className="text-eyebrow">
                  Membership
                </dt>
                <dd className="capitalize">
                  {counterpart.membership_level} ·{" "}
                  {counterpart.membership_status}
                </dd>
              </div>
            </dl>
          </section>

          <section className="surface-card p-6">
            <p className="text-eyebrow">
              Contact details
            </p>

            {checkingContact ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Checking mutual interest…
              </p>
            ) : mutualInterest ? (
              <div className="mt-3 grid gap-2 text-sm">
                <div className="rounded-md bg-success/10 p-3">
                  <p className="font-semibold text-success">
                    Mutual interest
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Both members have independently
                    expressed interest. Contact details are
                    now available.
                  </p>
                </div>

                {contact?.counterpart_name && (
                  <p className="font-medium">
                    {contact.counterpart_name}
                  </p>
                )}

                {contact?.counterpart_company && (
                  <p className="text-muted-foreground">
                    {contact.counterpart_company}
                  </p>
                )}

                {contact?.counterpart_email && (
                  <a
                    className="underline underline-offset-4"
                    href={`mailto:${contact.counterpart_email}`}
                  >
                    {contact.counterpart_email}
                  </a>
                )}

                {contact?.counterpart_phone && (
                  <a
                    className="underline underline-offset-4"
                    href={`tel:${contact.counterpart_phone}`}
                  >
                    {contact.counterpart_phone}
                  </a>
                )}

                {!contact?.counterpart_email &&
                  !contact?.counterpart_phone && (
                    <p className="text-xs text-muted-foreground">
                      Mutual interest has been confirmed,
                      but no email or phone number is
                      available for this member.
                    </p>
                  )}
              </div>
            ) : (
              <div className="mt-3">
                <p
                  className="select-none text-sm blur-[5px]"
                  aria-hidden
                >
                  name@company.com · +00 000 000 000
                </p>

                {interested ? (
                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                    Your interest has been registered.
                    Contact details will remain protected
                    until {counterpart.name.split(" ")[0]}{" "}
                    also expresses interest in this match.
                  </p>
                ) : (
                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                    Contact details are protected until
                    both sides independently register
                    interest. Register your interest to
                    begin the introduction process.
                  </p>
                )}
              </div>
            )}
          </section>

          <section className="surface-card p-6">
            <p className="text-eyebrow">
              Your decision
            </p>

            <div className="mt-3 grid gap-2">
              <button
                onClick={() =>
                  void handleInterest(
                    interested
                      ? "none"
                      : "interested",
                  )
                }
                className={
                  interested
                    ? "rounded-sm bg-success px-4 py-2.5 text-sm font-semibold text-success-foreground"
                    : "rounded-sm bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                }
              >
                {interested
                  ? "Interest registered"
                  : "I'm interested"}
              </button>

              <button
                onClick={() =>
                  void handleInterest(
                    match.requester_interest ===
                      "not_relevant"
                      ? "none"
                      : "not_relevant",
                  )
                }
                className="rounded-sm border border-input px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary"
              >
                Not relevant
              </button>
            </div>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
