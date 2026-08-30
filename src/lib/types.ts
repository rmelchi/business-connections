/**
 * Domain model for Business Match.
 *
 * Ownership boundary:
 *  - WildApricot owns member identity: name, email, company, phone,
 *    membership level and membership status. Linked via `wildapricot_contact_id`.
 *  - This application owns offers, requests, embeddings, matches, match
 *    explanations, interest state and matching history.
 */

export type MembershipStatus = "active" | "lapsed" | "pending" | "suspended";
export type AudienceType = "b2b" | "b2c" | "both";
export type ListingStatus = "active" | "inactive";
export type InterestState = "none" | "interested" | "not_relevant";
export type UserRole = "member" | "admin";

/** Identity record mirrored from WildApricot. Read-only inside this app. */
export interface Member {
  id: string;
  /** External identity link — authoritative key in WildApricot. */
  wildapricot_contact_id: string;
  name: string;
  email: string;
  phone?: string;
  company: string;
  title: string;
  industry: string;
  geography: string;
  /** App-owned narrative field. */
  bio: string;
  membership_level: string;
  membership_status: MembershipStatus;
  role: UserRole;
  /** Derived: lapsed members are excluded from matching but keep their data. */
  matching_enabled: boolean;
  last_synced_at: string;
  avatar_initials: string;
}

/** Shared structured criteria used by both offers and requests. */
export interface ListingBase {
  id: string;
  member_id: string;
  title: string;
  description: string;
  category: string;
  industry: string;
  geography: string;
  product_service: "product" | "service" | "both";
  audience: AudienceType;
  keywords: string[];
  status: ListingStatus;
  created_at: string;
  updated_at: string;
  /** Placeholder for a future semantic embedding vector. */
  embedding: number[] | null;
}

export type Offer = ListingBase & { kind: "offer" };
export type Request = ListingBase & {
  kind: "request";
  /** Optional expiration; expired requests stop matching. */
  expires_at?: string | null;
};

export interface MatchFactor {
  label: string;
  weight: number;
  score: number;
  detail: string;
}

export interface Match {
  id: string;
  request_id: string;
  offer_id: string;
  requester_id: string;
  provider_id: string;
  score: number;
  factors: MatchFactor[];
  explanation: string;
  request_excerpt: string;
  offer_excerpt: string;
  /** True when the counterpart also has a matching request/offer pair. */
  reciprocal: boolean;
  reciprocal_match_id?: string;
  requester_interest: InterestState;
  provider_interest: InterestState;
  created_at: string;
}

export interface Notification {
  id: string;
  member_id: string;
  match_id: string;
  title: string;
  body: string;
  created_at: string;
  read: boolean;
}
