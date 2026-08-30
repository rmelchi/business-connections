import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { AppShell } from "@/components/AppShell";
import { MatchCard } from "@/components/MatchCard";
import { STRONG_MATCH_THRESHOLD } from "@/lib/matching";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/matches/")({
  head: () => ({
    meta: [
      { title: "Matches — Business Match" },
      {
        name: "description",
        content:
          "Your requests compared against other members' offers, with scores, reasoning and mutual opportunities.",
      },
      { property: "og:title", content: "Matches — Business Match" },
      {
        property: "og:description",
        content: "Scored, explained B2B matches across the member network.",
      },
    ],
  }),
  component: MatchesPage,
});

type Filter = "all" | "mutual" | "strong" | "interested";

function MatchesPage() {
  const { currentMember, matches } = useStore();
  const [filter, setFilter] = useState<Filter>("all");
  const me = currentMember;
  if (!me) return <AppShell title="Matches">{null}</AppShell>;

  const mine = matches.filter((m) => m.requester_id === me.id || m.provider_id === me.id);
  const visible = mine.filter((m) => {
    if (filter === "mutual") return m.reciprocal;
    if (filter === "strong") return m.score >= STRONG_MATCH_THRESHOLD;
    if (filter === "interested") return m.requester_interest === "interested";
    return true;
  });

  const tabs: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: "All matches", count: mine.length },
    { key: "mutual", label: "Mutual opportunities", count: mine.filter((m) => m.reciprocal).length },
    {
      key: "strong",
      label: "Strong",
      count: mine.filter((m) => m.score >= STRONG_MATCH_THRESHOLD).length,
    },
    {
      key: "interested",
      label: "Interested",
      count: mine.filter((m) => m.requester_interest === "interested").length,
    },
  ];

  return (
    <AppShell
      eyebrow="Matching engine"
      title="Matches"
      description="Each of your requests is scored against every active offer in the network: semantic similarity 60%, industry and category 15%, geography 10%, structured criteria 10%, recency 5%, plus a reciprocity bonus."
    >
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={
              filter === t.key
                ? "rounded-full bg-ink px-4 py-2 text-sm font-medium text-ink-foreground"
                : "rounded-full border border-input px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary"
            }
          >
            {t.label} <span className="opacity-60">({t.count})</span>
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-4">
        {visible.map((m) => (
          <MatchCard key={m.id} match={m} perspective={me.id} />
        ))}
        {visible.length === 0 && (
          <p className="surface-card p-8 text-sm text-muted-foreground">
            Nothing here yet. Publish a request to start matching.
          </p>
        )}
      </div>
    </AppShell>
  );
}
