import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { useStore } from "@/lib/store";
import { STRONG_MATCH_THRESHOLD } from "@/lib/matching";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Business Match" },
      {
        name: "description",
        content:
          "Association overview: members, membership status, listings and matching statistics.",
      },
      { property: "og:title", content: "Admin — Business Match" },
      {
        property: "og:description",
        content: "Network statistics and member administration.",
      },
    ],
  }),
  component: AdminPage,
});

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="surface-card p-6">
      <p className="text-eyebrow">{label}</p>
      <p className="mt-2 font-display text-4xl font-semibold text-foreground">{value}</p>
      {hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function AdminPage() {
  const { currentMember, members, offers, requests, matches } = useStore();

  if (!currentMember) return <AppShell title="Admin">{null}</AppShell>;

  if (currentMember.role !== "admin") {
    return (
      <AppShell title="Admin" eyebrow="Restricted">
        <p className="surface-card p-8 text-sm text-muted-foreground">
          This area is available to association administrators only.
        </p>
      </AppShell>
    );
  }

  const activeMembers = members.filter((m) => m.membership_status === "active");
  const strong = matches.filter((m) => m.score >= STRONG_MATCH_THRESHOLD);
  const mutual = matches.filter((m) => m.reciprocal);

  return (
    <AppShell
      eyebrow="Association administration"
      title="Admin dashboard"
      description="Network health across membership, published listings and matching output. Membership records are mirrored from WildApricot."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Members"
          value={members.length}
          hint={`${activeMembers.length} active · ${members.length - activeMembers.length} inactive`}
        />
        <Stat
          label="Offers"
          value={offers.length}
          hint={`${offers.filter((o) => o.status === "active").length} active`}
        />
        <Stat
          label="Requests"
          value={requests.length}
          hint={`${requests.filter((r) => r.status === "active").length} active`}
        />
        <Stat
          label="Matches"
          value={matches.length}
          hint={`${strong.length} strong · ${mutual.length} mutual`}
        />
      </div>

      <div className="surface-card mt-8 overflow-hidden">
        <div className="border-b border-border px-6 py-5">
          <h2 className="font-display text-lg font-semibold">Members</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Identity and status synchronized from WildApricot. Lapsed members keep their listings
            but are excluded from matching.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="bg-surface text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-6 py-3 font-semibold">Member</th>
                <th className="px-6 py-3 font-semibold">Contact ID</th>
                <th className="px-6 py-3 font-semibold">Level</th>
                <th className="px-6 py-3 font-semibold">Status</th>
                <th className="px-6 py-3 font-semibold">Matching</th>
                <th className="px-6 py-3 font-semibold">Offers</th>
                <th className="px-6 py-3 font-semibold">Requests</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-t border-border">
                  <td className="px-6 py-4">
                    <div className="font-medium text-foreground">{m.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {m.company} · {m.geography}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-muted-foreground">
                    {m.wildapricot_contact_id}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">{m.membership_level}</td>
                  <td className="px-6 py-4">
                    <span
                      className={
                        m.membership_status === "active"
                          ? "rounded-full bg-success/12 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-success"
                          : "rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                      }
                    >
                      {m.membership_status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {m.matching_enabled ? "Enabled" : "Disabled"}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {offers.filter((o) => o.member_id === m.id).length}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {requests.filter((r) => r.member_id === m.id).length}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="surface-card mt-6 overflow-hidden">
        <div className="border-b border-border px-6 py-5">
          <h2 className="font-display text-lg font-semibold">Top matches network-wide</h2>
        </div>
        <div className="divide-y divide-border">
          {[...matches]
            .sort((a, b) => b.score - a.score)
            .slice(0, 8)
            .map((m) => (
              <div key={m.id} className="flex flex-wrap items-center gap-4 px-6 py-4 text-sm">
                <span className="font-display text-base font-semibold">
                  {Math.round(m.score * 100)}%
                </span>
                {m.reciprocal && (
                  <span className="rounded-full bg-brass/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-brass">
                    Mutual
                  </span>
                )}
                <span className="text-muted-foreground">{m.explanation}</span>
              </div>
            ))}
          {matches.length === 0 && (
            <p className="px-6 py-8 text-sm text-muted-foreground">No matches computed yet.</p>
          )}
        </div>
      </div>
    </AppShell>
  );
}
