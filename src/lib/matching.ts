/**
 * Matching engine.
 *
 * The production design is: semantic embeddings (60%) + structured scoring.
 * Weighting used here mirrors that target so the scoring surface, the
 * explanation payload and the persisted match shape stay stable when a real
 * embedding service is introduced.
 *
 * To plug in a semantic backend later, implement `SemanticSimilarityProvider`
 * (e.g. a server function calling an embedding model + cosine similarity) and
 * pass it into `scorePair` / `computeMatches`. The local provider below is a
 * transparent lexical stand-in, NOT a production AI backend.
 */
import type { Match, MatchFactor, Member, Offer, Request } from "./types";

export const MATCH_WEIGHTS = {
  semantic: 0.6,
  industry: 0.15,
  geography: 0.1,
  structured: 0.1,
  recency: 0.05,
} as const;

/** Bonus applied when both directions match (A→B and B→A). */
export const RECIPROCAL_BONUS = 0.08;

export const STRONG_MATCH_THRESHOLD = 0.72;

export interface SemanticSimilarityProvider {
  /** Returns similarity in [0,1]. */
  similarity(a: Request, b: Offer): number;
}

const STOP = new Set(
  "a an the and or for of to in on with we our you your is are looking seek seeking need needs offer offers provide provides that this from as at by".split(
    " ",
  ),
);

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2 && !STOP.has(t)),
  );
}

/** Lexical stand-in for embedding cosine similarity. */
export const localSemanticProvider: SemanticSimilarityProvider = {
  similarity(request, offer) {
    const a = tokenize(
      `${request.title} ${request.description} ${request.keywords.join(" ")} ${request.category}`,
    );
    const b = tokenize(
      `${offer.title} ${offer.description} ${offer.keywords.join(" ")} ${offer.category}`,
    );
    let shared = 0;
    a.forEach((t) => {
      if (b.has(t)) shared += 1;
    });
    const denom = Math.sqrt(a.size * b.size) || 1;
    return Math.min(1, (shared / denom) * 1.9);
  },
};

function geographyScore(request: Request, offer: Offer): number {
  const r = request.geography.toLowerCase();
  const o = offer.geography.toLowerCase();
  if (r === o) return 1;
  const rt = tokenize(r);
  const ot = tokenize(o);
  let shared = 0;
  rt.forEach((t) => ot.has(t) && (shared += 1));
  if (shared) return 0.8;
  if (/global|international|worldwide|export/.test(r) || /global|international|worldwide|export/.test(o))
    return 0.7;
  return 0.35;
}

function industryScore(request: Request, offer: Offer): number {
  if (request.industry === offer.industry) return 1;
  const rt = tokenize(`${request.industry} ${request.category}`);
  const ot = tokenize(`${offer.industry} ${offer.category}`);
  let shared = 0;
  rt.forEach((t) => ot.has(t) && (shared += 1));
  return shared ? 0.75 : 0.25;
}

function structuredScore(request: Request, offer: Offer): number {
  let score = 0;
  if (
    request.audience === offer.audience ||
    request.audience === "both" ||
    offer.audience === "both"
  )
    score += 0.5;
  if (
    request.product_service === offer.product_service ||
    request.product_service === "both" ||
    offer.product_service === "both"
  )
    score += 0.3;
  const rk = new Set(request.keywords.map((k) => k.toLowerCase()));
  const overlap = offer.keywords.filter((k) => rk.has(k.toLowerCase())).length;
  score += Math.min(0.2, overlap * 0.07);
  return Math.min(1, score);
}

function recencyScore(offer: Offer): number {
  const days = (Date.now() - new Date(offer.updated_at).getTime()) / 86_400_000;
  if (days <= 14) return 1;
  if (days <= 45) return 0.75;
  if (days <= 120) return 0.5;
  return 0.25;
}

function excerpt(text: string, max = 180): string {
  return text.length <= max ? text : `${text.slice(0, max).trimEnd()}…`;
}

export function scorePair(
  request: Request,
  offer: Offer,
  provider: SemanticSimilarityProvider = localSemanticProvider,
): { score: number; factors: MatchFactor[] } {
  const semantic = provider.similarity(request, offer);
  const industry = industryScore(request, offer);
  const geography = geographyScore(request, offer);
  const structured = structuredScore(request, offer);
  const recency = recencyScore(offer);

  const factors: MatchFactor[] = [
    {
      label: "Semantic similarity",
      weight: MATCH_WEIGHTS.semantic,
      score: semantic,
      detail: "Meaning overlap between the request narrative and the offer narrative.",
    },
    {
      label: "Industry & category",
      weight: MATCH_WEIGHTS.industry,
      score: industry,
      detail: `${request.industry} · ${request.category} vs ${offer.industry} · ${offer.category}`,
    },
    {
      label: "Geography",
      weight: MATCH_WEIGHTS.geography,
      score: geography,
      detail: `${request.geography} vs ${offer.geography}`,
    },
    {
      label: "Structured criteria",
      weight: MATCH_WEIGHTS.structured,
      score: structured,
      detail: `${request.audience.toUpperCase()} / ${request.product_service} vs ${offer.audience.toUpperCase()} / ${offer.product_service}`,
    },
    {
      label: "Recency",
      weight: MATCH_WEIGHTS.recency,
      score: recency,
      detail: `Offer last updated ${new Date(offer.updated_at).toLocaleDateString()}`,
    },
  ];

  const score = factors.reduce((sum, f) => sum + f.weight * f.score, 0);
  return { score, factors };
}

function buildExplanation(
  request: Request,
  offer: Offer,
  requester: Member,
  provider: Member,
  factors: MatchFactor[],
): string {
  const top = [...factors].sort((a, b) => b.weight * b.score - a.weight * a.score)[0];
  return [
    `${requester.company} is looking for “${request.title}”, and ${provider.company} offers “${offer.title}”.`,
    `The strongest signal is ${top.label.toLowerCase()} (${Math.round(top.score * 100)}%).`,
    `Both sides operate in ${offer.industry.toLowerCase()} with ${offer.geography} coverage against a ${request.geography} requirement.`,
  ].join(" ");
}

export interface ComputeInput {
  members: Member[];
  offers: Offer[];
  requests: Request[];
  minScore?: number;
  provider?: SemanticSimilarityProvider;
}

export function computeMatches({
  members,
  offers,
  requests,
  minScore = 0.45,
  provider = localSemanticProvider,
}: ComputeInput): Match[] {
  const byId = new Map(members.map((m) => [m.id, m]));
  const now = Date.now();

  const eligibleRequests = requests.filter((r) => {
    const m = byId.get(r.member_id);
    if (!m?.matching_enabled || r.status !== "active") return false;
    if (r.expires_at && new Date(r.expires_at).getTime() < now) return false;
    return true;
  });
  const eligibleOffers = offers.filter(
    (o) => byId.get(o.member_id)?.matching_enabled && o.status === "active",
  );

  const matches: Match[] = [];
  for (const request of eligibleRequests) {
    for (const offer of eligibleOffers) {
      if (offer.member_id === request.member_id) continue;
      const { score, factors } = scorePair(request, offer, provider);
      if (score < minScore) continue;
      const requester = byId.get(request.member_id)!;
      const providerMember = byId.get(offer.member_id)!;
      matches.push({
        id: `mt_${request.id}_${offer.id}`,
        request_id: request.id,
        offer_id: offer.id,
        requester_id: request.member_id,
        provider_id: offer.member_id,
        score,
        factors,
        explanation: buildExplanation(request, offer, requester, providerMember, factors),
        request_excerpt: excerpt(request.description),
        offer_excerpt: excerpt(offer.description),
        reciprocal: false,
        requester_interest: "none",
        provider_interest: "none",
        created_at: new Date().toISOString(),
      });
    }
  }

  // Reciprocity pass: A.request↔B.offer paired with B.request↔A.offer.
  for (const m of matches) {
    const counterpart = matches.find(
      (o) => o.requester_id === m.provider_id && o.provider_id === m.requester_id,
    );
    if (counterpart) {
      m.reciprocal = true;
      m.reciprocal_match_id = counterpart.id;
      m.score = Math.min(1, m.score + RECIPROCAL_BONUS);
    }
  }

  return matches.sort((a, b) => b.score - a.score);
}

export function scoreLabel(score: number): string {
  if (score >= 0.85) return "Exceptional";
  if (score >= STRONG_MATCH_THRESHOLD) return "Strong";
  if (score >= 0.6) return "Promising";
  return "Exploratory";
}
