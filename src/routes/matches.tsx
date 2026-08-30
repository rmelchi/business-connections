import { createFileRoute, Outlet } from "@tanstack/react-router";

// Layout route: children render at /matches (index) and /matches/$matchId.
export const Route = createFileRoute("/matches")({
  component: () => <Outlet />,
});
