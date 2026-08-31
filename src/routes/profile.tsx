import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { useStore } from "@/lib/store";
import { WILDAPRICOT_OWNED_FIELDS } from "@/lib/wildapricot";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Business Match" },
      {
        name: "description",
        content:
          "Your member profile. Identity and membership data is synchronized from WildApricot.",
      },
      { property: "og:title", content: "Profile — Business Match" },
      {
        property: "og:description",
        content: "Member identity, membership status and business details.",
      },
    ],
  }),
  component: ProfilePage,
});

function Field({
  label,
  value,
  readOnly,
}: {
  label: string;
  value: string;
  readOnly?: boolean;
}) {
  return (
    <div className="border-b border-border py-4 last:border-0">
      <div className="flex items-center gap-2">
        <p className="text-eyebrow">{label}</p>
        {readOnly && (
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Synced
          </span>
        )}
      </div>
      <p className="mt-1.5 text-[15px] text-foreground">{value || "—"}</p>
    </div>
  );
}

function ProfilePage() {
  const { currentMember, offers, requests } = useStore();
  const me = currentMember;
  if (!me) return <AppShell title="Profile">{null}</AppShell>;

  const myOffers = offers.filter((o) => o.member_id === me.id).length;
  const myRequests = requests.filter((r) => r.member_id === me.id).length;

  return (
    <AppShell
      eyebrow="Member identity"
      title="Profile"
      description="Name, email, company and membership data are owned by WildApricot and shown read-only here. Your business narrative and listings are owned by Business Match."
    >
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="surface-card p-6 lg:p-8">
          <h2 className="font-display text-lg font-semibold">Identity & membership</h2>
          <div className="mt-2">
            <Field label="WildApricot Contact ID" value={me.wildapricot_contact_id} readOnly />
            <Field label="Name" value={me.name} readOnly />
            <Field label="Email" value={me.email} readOnly />
            <Field label="Phone" value={me.phone ?? ""} readOnly />
            <Field label="Company" value={me.company} readOnly />
            <Field label="Membership level" value={me.membership_level} readOnly />
            <Field label="Membership status" value={me.membership_status} readOnly />
            <Field label="Title" value={me.title} />
            <Field label="Industry" value={me.industry} />
            <Field label="Geography" value={me.geography} />
            <Field label="Bio" value={me.bio} />
          </div>
        </div>

        <div className="grid gap-6 self-start">
          <div className="surface-card p-6">
            <p className="text-eyebrow">Matching eligibility</p>
            <p className="mt-2 font-display text-2xl font-semibold">
              {me.matching_enabled ? "Enabled" : "Disabled"}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {me.matching_enabled
                ? "Your active listings participate in matching across the network."
                : "Membership is not active, so your listings are excluded from matching. Nothing has been deleted — matching resumes when membership is renewed."}
            </p>
          </div>

          <div className="surface-card p-6">
            <p className="text-eyebrow">Your listings</p>
            <div className="mt-3 grid grid-cols-2 gap-4">
              <div>
                <p className="font-display text-3xl font-semibold">{myOffers}</p>
                <p className="text-xs text-muted-foreground">Offers</p>
              </div>
              <div>
                <p className="font-display text-3xl font-semibold">{myRequests}</p>
                <p className="text-xs text-muted-foreground">Requests</p>
              </div>
            </div>
          </div>

          <div className="surface-card p-6">
            <p className="text-eyebrow">Synchronization</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Last synced {new Date(me.last_synced_at).toLocaleString()}. Fields marked{" "}
              <span className="font-medium text-foreground">Synced</span> are maintained in
              WildApricot: {WILDAPRICOT_OWNED_FIELDS.join(", ")}. Edit them in the association
              member portal.
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
