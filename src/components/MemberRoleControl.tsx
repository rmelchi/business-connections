import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { useStore } from "@/lib/store";
import type { Member } from "@/lib/types";

/**
 * Promote/demote control shown next to each member in the Admin table.
 * The server re-verifies the acting admin, the target's WildApricot status
 * and the last-admin rule — this UI only makes the intent clear.
 */
export function MemberRoleControl({
  member,
  isSelf,
  adminCount,
  onChanged,
}: {
  member: Member;
  isSelf: boolean;
  adminCount: number;
  onChanged: () => void;
}) {
  const { refreshNetwork } = useStore();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = member.assigned_role === "admin";
  const nextRole: Member["role"] = isAdmin ? "member" : "admin";
  const lastAdmin = isAdmin && adminCount <= 1;
  const notActive = member.membership_status !== "active";
  const blocked = isAdmin ? lastAdmin : notActive;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const { setMemberRole } = await import("@/lib/roles.functions");
      await setMemberRole({
        data: { profileId: member.id, role: nextRole, reason: reason.trim() || undefined },
      });
      setOpen(false);
      setReason("");
      await refreshNetwork();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The role change could not be saved.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        disabled={blocked}
        onClick={() => setOpen(true)}
        className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-foreground transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40"
        title={
          lastAdmin
            ? "The last remaining administrator cannot be demoted."
            : notActive && !isAdmin
              ? "Only active WildApricot members can be promoted."
              : undefined
        }
      >
        {isAdmin ? "Demote to member" : "Make admin"}
      </button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isAdmin ? `Demote ${member.name}?` : `Make ${member.name} an administrator?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isAdmin
                ? "They will lose access to the admin dashboard, WildApricot synchronization and role management. Their listings, matches and membership record are untouched."
                : "They will gain full access to the admin dashboard, WildApricot synchronization and role management. Membership identity stays owned by WildApricot."}
              {isSelf && isAdmin && " You are demoting your own account."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <label className="text-eyebrow" htmlFor="role-reason">
              Reason (optional)
            </label>
            <Input
              id="role-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Recorded in the role change log"
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              {busy ? "Saving…" : isAdmin ? "Demote" : "Promote"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
