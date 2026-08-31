import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

import { AppShell } from "@/components/AppShell";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — Business Match" },
      {
        name: "description",
        content: "Newly discovered strong matches and mutual opportunities in your network.",
      },
      { property: "og:title", content: "Notifications — Business Match" },
      {
        property: "og:description",
        content: "Alerts for strong matches and mutual opportunities.",
      },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { currentMember, notifications, markNotificationsRead } = useStore();

  useEffect(() => {
    const t = setTimeout(() => markNotificationsRead(), 1200);
    return () => clearTimeout(t);
  }, [markNotificationsRead]);

  if (!currentMember) return <AppShell title="Notifications">{null}</AppShell>;

  return (
    <AppShell
      eyebrow="Activity"
      title="Notifications"
      description="You are alerted whenever the matching engine discovers a strong new match or a mutual opportunity involving your listings."
    >
      <div className="grid gap-3">
        {notifications.map((n) => (
          <Link
            key={n.id}
            to="/matches/$matchId"
            params={{ matchId: n.match_id }}
            className="surface-card flex flex-col gap-2 p-6 transition-colors hover:bg-surface"
          >
            <div className="flex flex-wrap items-center gap-3">
              {!n.read && <span className="size-2 rounded-full bg-brass" />}
              <h2 className="font-display text-lg font-semibold">{n.title}</h2>
              <span className="ml-auto text-xs text-muted-foreground">
                {new Date(n.created_at).toLocaleDateString()}
              </span>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">{n.body}</p>
          </Link>
        ))}
        {notifications.length === 0 && (
          <p className="surface-card p-8 text-sm text-muted-foreground">
            No strong matches yet. Publish more detailed offers and requests to improve match
            quality.
          </p>
        )}
      </div>
    </AppShell>
  );
}
