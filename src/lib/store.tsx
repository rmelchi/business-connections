import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { demoMembers, demoOffers, demoRequests } from "./demo-data";
import { computeMatches, STRONG_MATCH_THRESHOLD } from "./matching";
import type {
  InterestState,
  Match,
  Member,
  Notification,
  Offer,
  Request,
} from "./types";

const SESSION_KEY = "bm.session.member";

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
  signIn: (email: string) => boolean;
  signOut: () => void;
  addOffer: (draft: ListingDraft) => void;
  addRequest: (draft: ListingDraft) => void;
  toggleListingStatus: (kind: "offer" | "request", id: string) => void;
  setInterest: (matchId: string, state: InterestState) => void;
  markNotificationsRead: () => void;
  memberById: (id: string) => Member | undefined;
  offerById: (id: string) => Offer | undefined;
  requestById: (id: string) => Request | undefined;
}

const StoreContext = createContext<StoreValue | null>(null);

const newId = (prefix: string) =>
  `${prefix}_${Math.random().toString(36).slice(2, 9)}`;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [members] = useState<Member[]>(demoMembers);
  const [offers, setOffers] = useState<Offer[]>(demoOffers);
  const [requests, setRequests] = useState<Request[]>(demoRequests);
  const [interest, setInterestMap] = useState<Record<string, InterestState>>({});
  const [readNotifications, setReadNotifications] = useState(false);
  const [currentMemberId, setCurrentMemberId] = useState<string | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(SESSION_KEY);
    if (stored) setCurrentMemberId(stored);
  }, []);

  const computed = useMemo(
    () => computeMatches({ members, offers, requests }),
    [members, offers, requests],
  );

  const matches = useMemo(
    () =>
      computed.map((m) => ({
        ...m,
        requester_interest: interest[m.id] ?? "none",
      })),
    [computed, interest],
  );

  const currentMember = useMemo(
    () => members.find((m) => m.id === currentMemberId) ?? null,
    [members, currentMemberId],
  );

  const notifications = useMemo<Notification[]>(() => {
    if (!currentMember) return [];
    return matches
      .filter(
        (m) =>
          m.score >= STRONG_MATCH_THRESHOLD &&
          (m.requester_id === currentMember.id || m.provider_id === currentMember.id),
      )
      .map((m) => {
        const outbound = m.requester_id === currentMember.id;
        const other = members.find(
          (x) => x.id === (outbound ? m.provider_id : m.requester_id),
        );
        return {
          id: `nt_${m.id}`,
          member_id: currentMember.id,
          match_id: m.id,
          title: m.reciprocal
            ? `Mutual opportunity with ${other?.company ?? "a member"}`
            : `New strong match — ${Math.round(m.score * 100)}%`,
          body: m.explanation,
          created_at: m.created_at,
          read: readNotifications,
        };
      });
  }, [matches, members, currentMember, readNotifications]);

  const signIn = useCallback(
    (email: string) => {
      const found = members.find(
        (m) => m.email.toLowerCase() === email.trim().toLowerCase(),
      );
      if (!found) return false;
      setCurrentMemberId(found.id);
      window.localStorage.setItem(SESSION_KEY, found.id);
      return true;
    },
    [members],
  );

  const signOut = useCallback(() => {
    setCurrentMemberId(null);
    window.localStorage.removeItem(SESSION_KEY);
  }, []);

  const addOffer = useCallback(
    (draft: ListingDraft) => {
      if (!currentMemberId) return;
      const now = new Date().toISOString();
      setOffers((prev) => [
        {
          ...draft,
          kind: "offer",
          id: newId("of"),
          member_id: currentMemberId,
          created_at: now,
          updated_at: now,
          embedding: null,
        } as Offer,
        ...prev,
      ]);
    },
    [currentMemberId],
  );

  const addRequest = useCallback(
    (draft: ListingDraft) => {
      if (!currentMemberId) return;
      const now = new Date().toISOString();
      setRequests((prev) => [
        {
          ...draft,
          kind: "request",
          id: newId("rq"),
          member_id: currentMemberId,
          created_at: now,
          updated_at: now,
          embedding: null,
          expires_at: draft.expires_at ?? null,
        } as Request,
        ...prev,
      ]);
    },
    [currentMemberId],
  );

  const toggleListingStatus = useCallback((kind: "offer" | "request", id: string) => {
    const flip = <T extends { id: string; status: "active" | "inactive"; updated_at: string }>(
      list: T[],
    ) =>
      list.map((l) =>
        l.id === id
          ? {
              ...l,
              status: l.status === "active" ? ("inactive" as const) : ("active" as const),
              updated_at: new Date().toISOString(),
            }
          : l,
      );
    if (kind === "offer") setOffers((p) => flip(p));
    else setRequests((p) => flip(p));
  }, []);

  const setInterest = useCallback((matchId: string, state: InterestState) => {
    setInterestMap((prev) => ({ ...prev, [matchId]: state }));
  }, []);

  const value: StoreValue = {
    members,
    offers,
    requests,
    matches,
    notifications,
    currentMember,
    signIn,
    signOut,
    addOffer,
    addRequest,
    toggleListingStatus,
    setInterest,
    markNotificationsRead: () => setReadNotifications(true),
    memberById: (id) => members.find((m) => m.id === id),
    offerById: (id) => offers.find((o) => o.id === id),
    requestById: (id) => requests.find((r) => r.id === id),
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
