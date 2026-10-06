import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { supabase } from "@/integrations/supabase/client";
import { computeMatches, STRONG_MATCH_THRESHOLD } from "./matching";
import type {
  InterestState,
  Match,
  Member,
  Notification,
  Offer,
  Request,
} from "./types";

type ListingDraft = Omit<
  Offer,
  "id" | "member_id" | "kind" | "created_at" | "updated_at" | "embedding"
> & { expires_at?: string | null };

interface StoreValue {
  members: Member[];
  offers: Offer[];
  requests: Request[];
  matches: Match[];
  notifications: Notification[];
  currentMember: Member | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password?: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  addOffer: (draft: ListingDraft) => Promise<void>;
  addRequest: (draft: ListingDraft) => Promise<void>;
  updateOffer: (id: string, draft: ListingDraft) => Promise<boolean>;
  updateRequest: (id: string, draft: ListingDraft) => Promise<boolean>;
  toggleListingStatus: (
    kind: "offer" | "request",
    id: string,
  ) => Promise<void>;
  setInterest: (matchId: string, state: InterestState) => Promise<void>;
  markNotificationsRead: () => Promise<void>;
  refreshNetwork: () => Promise<void>;
  memberById: (id: string) => Member | undefined;
  offerById: (id: string) => Offer | undefined;
  requestById: (id: string) => Request | undefined;
}

const StoreContext = createContext<StoreValue | null>(null);

type DirectoryRow = {
  id: string;
  wildapricot_contact_id: string;
  name: string;
  company: string;
  title: string;
  industry: string;
  geography: string;
  bio: string;
  membership_level: string;
  membership_status: Member["membership_status"];
  matching_enabled: boolean;
  avatar_initials: string;
  last_synced_at: string;
};

const toMember = (
  row: DirectoryRow,
  assignedRole: Member["role"] = "member",
): Member => ({
  id: row.id,
  wildapricot_contact_id: row.wildapricot_contact_id,
  name: row.name,
  company: row.company,
  title: row.title,
  industry: row.industry,
  geography: row.geography,
  bio: row.bio,
  membership_level: row.membership_level,
  membership_status: row.membership_status,
  role:
    assignedRole === "admin" && row.membership_status === "active"
      ? "admin"
      : "member",
  assigned_role: assignedRole,
  matching_enabled: row.matching_enabled,
  last_synced_at: row.last_synced_at,
  avatar_initials: row.avatar_initials,
});

/* eslint-disable @typescript-eslint/no-explicit-any */
const toOffer = (row: any): Offer => ({
  kind: "offer",
  id: row.id,
  member_id: row.member_id,
  title: row.title,
  description: row.description,
  category: row.category,
  industry: row.industry,
  geography: row.geography,
  product_service: row.product_service,
  audience: row.audience,
  keywords: row.keywords ?? [],
  status: row.status,
  created_at: row.created_at,
  updated_at: row.updated_at,
  embedding: null,
});

const toRequest = (row: any): Request => ({
  ...(toOffer(row) as unknown as Request),
  kind: "request",
  expires_at: row.expires_at ?? null,
});
/* eslint-enable @typescript-eslint/no-explicit-any */

export function StoreProvider({ children }: { children: ReactNode }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [feedback, setFeedback] = useState<Record<string, InterestState>>({});
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [currentMember, setCurrentMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const persistedRef = useRef<string>("");

  const loadNetwork = useCallback(async (profileId: string | null) => {
    const [dir, off, req] = await Promise.all([
      supabase.from("member_directory").select("*"),
      supabase
        .from("offers")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("requests")
        .select("*")
        .order("created_at", { ascending: false }),
    ]);

    if (dir.error) throw dir.error;
    if (off.error) throw off.error;
    if (req.error) throw req.error;

    const { data: roleRows } = await supabase
      .from("member_roles")
      .select("profile_id, role");

    const roleMap = new Map<string, Member["role"]>(
      (roleRows ?? []).map((r) => [
        r.profile_id,
        r.role as Member["role"],
      ]),
    );

    const mapped = (dir.data as DirectoryRow[]).map((row) =>
      toMember(row, roleMap.get(row.id) ?? "member"),
    );

    setMembers(mapped);
    setOffers((off.data ?? []).map(toOffer));
    setRequests((req.data ?? []).map(toRequest));

    if (profileId) {
      const { data: own } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", profileId)
        .maybeSingle();

      const base = mapped.find((m) => m.id === profileId) ?? null;

      setCurrentMember(
        base
          ? {
              ...base,
              ...(own?.email ? { email: own.email } : {}),
              ...(own?.phone ? { phone: own.phone } : {}),
            }
          : null,
      );

      const [fb, nt] = await Promise.all([
        supabase
          .from("match_feedback")
          .select("match_id, interest")
          .eq("profile_id", profileId),
        supabase
          .from("notifications")
          .select("*")
          .eq("profile_id", profileId)
          .order("created_at", { ascending: false }),
      ]);

      setFeedback(
        Object.fromEntries(
          (fb.data ?? []).map((f) => [
            f.match_id,
            f.interest as InterestState,
          ]),
        ),
      );

      setNotifications(
        (nt.data ?? []).map((n) => ({
          id: n.id,
          member_id: n.profile_id,
          match_id: n.match_id ?? "",
          title: n.title,
          body: n.body,
          created_at: n.created_at,
          read: n.read,
        })),
      );
    } else {
      setCurrentMember(null);
      setFeedback({});
      setNotifications([]);
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      setError(null);

      const { data: auth } = await supabase.auth.getUser();

      if (!auth.user) {
        setMembers([]);
        setOffers([]);
        setRequests([]);
        setCurrentMember(null);
        setNotifications([]);
        setFeedback({});
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("auth_user_id", auth.user.id)
        .maybeSingle();

      await loadNetwork(profile?.id ?? null);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not load your workspace.",
      );
    } finally {
      setLoading(false);
    }
  }, [loadNetwork]);

  useEffect(() => {
    void refresh();

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (
        event === "SIGNED_IN" ||
        event === "SIGNED_OUT" ||
        event === "USER_UPDATED"
      ) {
        void refresh();
      }
    });

    return () => sub.subscription.unsubscribe();
  }, [refresh]);

  const computed = useMemo(
    () => computeMatches({ members, offers, requests }),
    [members, offers, requests],
  );

  const matches = useMemo(
    () =>
      computed.map((m) => ({
        ...m,
        requester_interest:
          feedback[m.id] ?? m.requester_interest ?? "none",
      })),
    [computed, feedback],
  );

  useEffect(() => {
    if (!currentMember || computed.length === 0) return;

    const mine = computed.filter(
      (m) =>
        m.requester_id === currentMember.id ||
        m.provider_id === currentMember.id,
    );

    if (mine.length === 0) return;

    const signature = `${currentMember.id}:${mine
      .map((m) => `${m.id}@${m.score.toFixed(4)}`)
      .join(",")}`;

    if (persistedRef.current === signature) return;
    persistedRef.current = signature;

    void (async () => {
      const { error: matchError } = await supabase
        .from("matches")
        .upsert(
          mine.map((m) => ({
            id: m.id,
            request_id: m.request_id,
            offer_id: m.offer_id,
            requester_id: m.requester_id,
            provider_id: m.provider_id,
            score: m.score,
            factors: JSON.parse(JSON.stringify(m.factors)),
            explanation: m.explanation,
            request_excerpt: m.request_excerpt,
            offer_excerpt: m.offer_excerpt,
            reciprocal: m.reciprocal,
            reciprocal_match_id: m.reciprocal_match_id ?? null,
            engine: "deterministic-v1",
          })),
          { onConflict: "id" },
        );

      if (matchError) return;

      const strong = mine.filter(
        (m) => m.score >= STRONG_MATCH_THRESHOLD,
      );

      if (strong.length > 0) {
        await supabase.from("notifications").upsert(
          strong.map((m) => {
            const outbound =
              m.requester_id === currentMember.id;

            const other = members.find(
              (x) =>
                x.id ===
                (outbound ? m.provider_id : m.requester_id),
            );

            return {
              id: `nt_${currentMember.id}_${m.id}`,
              profile_id: currentMember.id,
              match_id: m.id,
              title: m.reciprocal
                ? `Mutual opportunity with ${
                    other?.company ?? "a member"
                  }`
                : `New strong match — ${Math.round(
                    m.score * 100,
                  )}%`,
              body: m.explanation,
            };
          }),
          {
            onConflict: "id",
            ignoreDuplicates: true,
          },
        );
      }

      const { data: nt } = await supabase
        .from("notifications")
        .select("*")
        .eq("profile_id", currentMember.id)
        .order("created_at", { ascending: false });

      setNotifications(
        (nt ?? []).map((n) => ({
          id: n.id,
          member_id: n.profile_id,
          match_id: n.match_id ?? "",
          title: n.title,
          body: n.body,
          created_at: n.created_at,
          read: n.read,
        })),
      );
    })();
  }, [computed, currentMember, members]);

  const signIn = useCallback(
    async (
      email: string,
      password?: string,
    ): Promise<string | null> => {
      setError(null);
      const address = email.trim().toLowerCase();

      try {
        if (password) {
          const { error: signInError } =
            await supabase.auth.signInWithPassword({
              email: address,
              password,
            });

          if (signInError) {
            return "Email or password is incorrect. If you have never signed in here, activate your account first.";
          }

          await refresh();
          return null;
        }

        const { provisionDemoAccount, DEMO_ACCOUNTS } =
          await import("./auth.functions");

        if (!(DEMO_ACCOUNTS as readonly string[]).includes(address)) {
          return "Please enter your password. First time here? Activate your account below.";
        }

        const creds = await provisionDemoAccount({
          data: { email: address },
        });

        const { error: signInError } =
          await supabase.auth.signInWithPassword(creds);

        if (signInError) throw signInError;

        await refresh();
        return null;
      } catch (e) {
        return e instanceof Error
          ? e.message
          : "Sign-in failed.";
      }
    },
    [refresh],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setCurrentMember(null);
    persistedRef.current = "";
  }, []);

  const insertListing = useCallback(
    async (
      table: "offers" | "requests",
      draft: ListingDraft,
    ) => {
      if (!currentMember) return;

      const base = {
        member_id: currentMember.id,
        title: draft.title,
        description: draft.description,
        category: draft.category,
        industry: draft.industry,
        geography: draft.geography,
        product_service: draft.product_service,
        audience: draft.audience,
        keywords: draft.keywords,
        status: draft.status,
      };

      if (table === "offers") {
        const { data, error: insertError } = await supabase
          .from("offers")
          .insert(base)
          .select()
          .single();

        if (insertError) {
          setError(insertError.message);
          return;
        }

        setOffers((prev) => [toOffer(data), ...prev]);
        return;
      }

      const { data, error: insertError } = await supabase
        .from("requests")
        .insert({
          ...base,
          expires_at: draft.expires_at ?? null,
        })
        .select()
        .single();

      if (insertError) {
        setError(insertError.message);
        return;
      }

      setRequests((prev) => [toRequest(data), ...prev]);
    },
    [currentMember],
  );

  const addOffer = useCallback(
    (draft: ListingDraft) =>
      insertListing("offers", draft),
    [insertListing],
  );

  const addRequest = useCallback(
    (draft: ListingDraft) =>
      insertListing("requests", draft),
    [insertListing],
  );

  const updateListing = useCallback(
    async (
      kind: "offer" | "request",
      id: string,
      draft: ListingDraft,
    ): Promise<boolean> => {
      if (!currentMember) return false;

      setError(null);

      const table =
        kind === "offer" ? "offers" : "requests";

      const base = {
        title: draft.title,
        description: draft.description,
        category: draft.category,
        industry: draft.industry,
        geography: draft.geography,
        product_service: draft.product_service,
        audience: draft.audience,
        keywords: draft.keywords,
        status: draft.status,
        updated_at: new Date().toISOString(),
      };

      const payload =
        kind === "request"
          ? {
              ...base,
              expires_at: draft.expires_at ?? null,
            }
          : base;

      const { data, error: updateError } = await supabase
        .from(table)
        .update(payload)
        .eq("id", id)
        .eq("member_id", currentMember.id)
        .select()
        .single();

      if (updateError) {
        setError(updateError.message);
        return false;
      }

      if (kind === "offer") {
        setOffers((prev) =>
          prev.map((item) =>
            item.id === id ? toOffer(data) : item,
          ),
        );
      } else {
        setRequests((prev) =>
          prev.map((item) =>
            item.id === id ? toRequest(data) : item,
          ),
        );
      }

      // The listing content has changed, so allow the current
      // member's recalculated matches to be persisted again.
      persistedRef.current = "";

      return true;
    },
    [currentMember],
  );

  const updateOffer = useCallback(
    (id: string, draft: ListingDraft) =>
      updateListing("offer", id, draft),
    [updateListing],
  );

  const updateRequest = useCallback(
    (id: string, draft: ListingDraft) =>
      updateListing("request", id, draft),
    [updateListing],
  );

  const toggleListingStatus = useCallback(
    async (
      kind: "offer" | "request",
      id: string,
    ) => {
      const table =
        kind === "offer" ? "offers" : "requests";

      const list: {
        id: string;
        status: "active" | "inactive";
      }[] = kind === "offer" ? offers : requests;

      const current = list.find((l) => l.id === id);

      if (!current) return;

      const status =
        current.status === "active"
          ? "inactive"
          : "active";

      const { error: updateError } = await supabase
        .from(table)
        .update({ status })
        .eq("id", id);

      if (updateError) {
        setError(updateError.message);
        return;
      }

      const patch = <
        T extends {
          id: string;
          status: "active" | "inactive";
          updated_at: string;
        },
      >(
        rows: T[],
      ) =>
        rows.map((l) =>
          l.id === id
            ? {
                ...l,
                status,
                updated_at: new Date().toISOString(),
              }
            : l,
        );

      if (kind === "offer") {
        setOffers((p) => patch(p));
      } else {
        setRequests((p) => patch(p));
      }

      persistedRef.current = "";
    },
    [offers, requests],
  );

  const setInterest = useCallback(
    async (
      matchId: string,
      state: InterestState,
    ) => {
      if (!currentMember) return;

      setFeedback((prev) => ({
        ...prev,
        [matchId]: state,
      }));

      const { error: fbError } = await supabase
        .from("match_feedback")
        .upsert(
          {
            match_id: matchId,
            profile_id: currentMember.id,
            interest: state,
          },
          {
            onConflict: "match_id,profile_id",
          },
        );

      if (fbError) setError(fbError.message);
    },
    [currentMember],
  );

  const markNotificationsRead = useCallback(async () => {
    if (!currentMember) return;

    setNotifications((prev) =>
      prev.map((n) => ({
        ...n,
        read: true,
      })),
    );

    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("profile_id", currentMember.id);
  }, [currentMember]);

  const value: StoreValue = {
    members,
    offers,
    requests,
    matches,
    notifications,
    currentMember,
    loading,
    error,
    signIn,
    signOut,
    addOffer,
    addRequest,
    updateOffer,
    updateRequest,
    toggleListingStatus,
    setInterest,
    markNotificationsRead,
    refreshNetwork: refresh,
    memberById: (id) =>
      members.find((m) => m.id === id),
    offerById: (id) =>
      offers.find((o) => o.id === id),
    requestById: (id) =>
      requests.find((r) => r.id === id),
  };

  return (
    <StoreContext.Provider value={value}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);

  if (!ctx) {
    throw new Error(
      "useStore must be used within StoreProvider",
    );
  }

  return ctx;
}
