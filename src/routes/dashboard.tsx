import { createFileRoute, Link } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { MatchCard } from "@/components/MatchCard";
import { STRONG_MATCH_THRESHOLD } from "@/lib/matching";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Business Match" },
      {
        name: "description",
        content:
          "Your strongest matches, active requests and active offers across the member network.",
      },
      { property: "og:title", content: "Dashboard — Business Match" },
      {
        property: "og:description",
        content: "Strongest matches, active requests and offers at a glance.",
      },
    ],
  }),
  component: DashboardPage,
});

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="surface-card p-5">
      <p className="text-eyebrow">{label}</p>
      <p className="mt-2 font-display text-3xl font-semibold">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function DashboardPage() {
  const { currentMember, matches, offers, requests } = useStore();
  const me = currentMember;
  if (!me) return <AppShell title="Dashboard">{null}</AppShell>;

  const mine = matches.filter(
    (m) => m.requester_id === me.id || m.provider_id === me.id,
  );
  const top = mine.filter((m) => m.requester_interest !== "not_relevant").slice(0, 4);
  const myOffers = offers.filter((o) => o.member_id === me.id);
  const myRequests = requests.filter((r) => r.member_id === me.id);
  const mutual = mine.filter((m) => m.reciprocal).length;

  return (
    <AppShell
      eyebrow={`Welcome back, ${me.name.split(" ")[0]}`}
      title="Find the right business opportunity within your network."
      description="Matches are recalculated whenever you or another member publishes an offer or request."
      actions={
        <>
          <Link
            to="/offers"
            search={{ new: true }}
            className="rounded-sm bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Add offer
          </Link>
          <Link
            to="/requests"
            search={{ new: true }}
            className="rounded-sm border border-input px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-secondary"
          >
            Add request
          </Link>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Strong matches"
          value={mine.filter((m) => m.score >= STRONG_MATCH_THRESHOLD).length}
          hint={`${mine.length} total candidates`}
        />
        <Stat label="Mutual opportunities" value={mutual} hint="Both sides need each other" />
        <Stat
          label="Active requests"
          value={myRequests.filter((r) => r.status === "active").length}
          hint={`${myRequests.length} published`}
        />
        <Stat
          label="Active offers"
          value={myOffers.filter((o) => o.status === "active").length}
          hint={`${myOffers.length} published`}
        />
      </div>

      <section className="mt-12">
        <div className="flex items-end justify-between">
          <h2 className="font-display text-2xl font-semibold">Strongest matches</h2>
          <Link to="/matches" className="text-sm font-medium underline-offset-4 hover:underline">
            View all matches →
          </Link>
        </div>
        <div className="mt-5 grid gap-4">
          {top.length === 0 && (
            <p className="surface-card p-8 text-sm text-muted-foreground">
              No matches yet. Publish a request describing what you're looking for.
            </p>
          )}
          {top.map((m) => (
            <MatchCard key={m.id} match={m} perspective={me.id} />
          ))}
        </div>
      </section>

      <div className="mt-12 grid gap-8 lg:grid-cols-2">
        <section>
          <div className="flex items-end justify-between">
            <h2 className="font-display text-2xl font-semibold">Active requests</h2>
            <Link to="/requests" className="text-sm font-medium underline-offset-4 hover:underline">
              Manage →
            </Link>
          </div>
          <div className="mt-4 grid gap-3">
            {myRequests.map((r) => (
              <div key={r.id} className="surface-card p-5">
                <p className="text-eyebrow">{r.category}</p>
                <h3 className="mt-1.5 font-display text-lg font-semibold">{r.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {r.geography} · {r.status === "active" ? "Active" : "Inactive"}
                  {r.expires_at
                    ? ` · expires ${new Date(r.expires_at).toLocaleDateString()}`
                    : ""}
                </p>
              </div>
            ))}
            {myRequests.length === 0 && (
              <p className="surface-card p-6 text-sm text-muted-foreground">No requests yet.</p>
            )}
          </div>
        </section>

        <section>
          <div className="flex items-end justify-between">
            <h2 className="font-display text-2xl font-semibold">Active offers</h2>
            <Link to="/offers" className="text-sm font-medium underline-offset-4 hover:underline">
              Manage →
            </Link>
          </div>
          <div className="mt-4 grid gap-3">
            {myOffers.map((o) => (
              <div key={o.id} className="surface-card p-5">
                <p className="text-eyebrow">{o.category}</p>
                <h3 className="mt-1.5 font-display text-lg font-semibold">{o.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {o.geography} · {o.status === "active" ? "Active" : "Inactive"}
                </p>
              </div>
            ))}
            {myOffers.length === 0 && (
              <p className="surface-card p-6 text-sm text-muted-foreground">No offers yet.</p>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
