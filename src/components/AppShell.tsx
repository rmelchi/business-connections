import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/matches", label: "Matches" },
  { to: "/offers", label: "Offers" },
  { to: "/requests", label: "Requests" },
  { to: "/profile", label: "Profile" },
  { to: "/notifications", label: "Notifications" },
] as const;

export function AppShell({
  title,
  eyebrow,
  description,
  actions,
  children,
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { currentMember, signOut, notifications, loading, error } = useStore();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  // Only redirect once the session/profile load has actually settled, so a
  // protected route never flashes the wrong content mid-load.
  useEffect(() => {
    if (!loading && !currentMember) navigate({ to: "/", replace: true });
  }, [loading, currentMember, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading your workspace…
      </div>
    );
  }

  if (!currentMember) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center text-sm text-muted-foreground">
        {error ?? "Redirecting to sign in…"}
      </div>
    );
  }

  const unread = notifications.filter((n) => !n.read).length;
  const items = currentMember.role === "admin" ? [...NAV, { to: "/admin", label: "Admin" } as const] : NAV;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/80 bg-ink text-ink-foreground">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-8 px-5 lg:px-8">
          <Link to="/dashboard" className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-sm bg-brass font-display text-sm font-bold text-brass-foreground">
              BM
            </span>
            <span className="font-display text-lg font-semibold tracking-tight">
              Business Match
            </span>
          </Link>

          <nav className="hidden flex-1 items-center gap-1 lg:flex">
            {items.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "relative rounded-sm px-3 py-2 text-sm font-medium text-ink-foreground/70 transition-colors hover:text-ink-foreground",
                  pathname.startsWith(item.to) && "text-ink-foreground",
                )}
              >
                {item.label}
                {item.label === "Notifications" && unread > 0 && (
                  <span className="ml-1.5 rounded-full bg-brass px-1.5 py-0.5 text-[10px] font-bold text-brass-foreground">
                    {unread}
                  </span>
                )}
                {pathname.startsWith(item.to) && (
                  <span className="absolute inset-x-3 -bottom-[3px] h-0.5 rounded-full bg-brass" />
                )}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="text-sm font-medium leading-tight">{currentMember.name}</div>
              <div className="text-xs text-ink-foreground/60">{currentMember.company}</div>
            </div>
            <span className="grid size-9 place-items-center rounded-full border border-ink-foreground/25 text-xs font-semibold">
              {currentMember.avatar_initials}
            </span>
            <button
              onClick={() => {
                void signOut().then(() => navigate({ to: "/", replace: true }));
              }}
              className="hidden rounded-sm border border-ink-foreground/25 px-3 py-1.5 text-xs font-medium text-ink-foreground/80 transition-colors hover:bg-ink-foreground/10 sm:block"
            >
              Sign out
            </button>
            <button
              className="rounded-sm border border-ink-foreground/25 px-3 py-1.5 text-xs lg:hidden"
              onClick={() => setOpen((v) => !v)}
            >
              Menu
            </button>
          </div>
        </div>

        {open && (
          <nav className="grid gap-1 border-t border-ink-foreground/15 px-5 py-3 lg:hidden">
            {items.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="rounded-sm px-2 py-2 text-sm text-ink-foreground/80"
              >
                {item.label}
              </Link>
            ))}
            <button
              onClick={() => {
                signOut();
                navigate({ to: "/", replace: true });
              }}
              className="rounded-sm px-2 py-2 text-left text-sm text-ink-foreground/80"
            >
              Sign out
            </button>
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-7xl px-5 py-10 lg:px-8 lg:py-14">
        <div className="flex flex-col gap-5 border-b border-border pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            {eyebrow && <p className="text-eyebrow">{eyebrow}</p>}
            <h1 className="mt-2 font-display text-3xl font-semibold text-foreground lg:text-4xl">
              {title}
            </h1>
            {description && (
              <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
        </div>
        <div className="pt-8">{children}</div>
      </main>
    </div>
  );
}
