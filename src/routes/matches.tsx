import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";

export const Route = createFileRoute("/matches")({
  component: () => <Outlet />,
});

// Layout route: children render at /matches (index) and /matches/$matchId.
export const _unused = useRouterState;
