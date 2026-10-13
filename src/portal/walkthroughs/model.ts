// ============================================================================
// LEASE-WALKTHROUGH-1 — walkthrough edit model (Agent Portal)
// ============================================================================
// Pure, immutable edit helpers over the answers document Vault returns, plus
// the derived state the panel renders. Separate from the component so it can
// be tested — and deliberately NARROW.
//
// WHAT IS NOT HERE, and must never be:
//   • the checklist — it arrives as `catalogue` from the API, so Vault is the
//     only place an item is defined and EASE and this client cannot drift;
//   • validation — Vault's validateAnswers() is the authority and rejects
//     unknown keys;
//   • signer eligibility and order — resolved server-side, including which
//     /sigN/ anchor each signer gets.
//
// What IS duplicated with EASE is the handful of immutable state transitions
// below. That is UI mechanics, not business rules: if they drifted, the worst
// case is one client's buttons feeling different, not the two producing
// different documents.
// ============================================================================

export type Rating = "good" | "fair" | "damaged" | "na";

export interface CatalogueItem {
  key: string;
  label: string;
}
export interface CatalogueSection {
  key: string;
  label: string;
  items: CatalogueItem[];
}
export interface Catalogue {
  sections: CatalogueSection[];
  ratings: { value: Rating; label: string }[];
  representations: string[];
  utilities: { value: string; label: string }[];
  utility_statuses: string[];
}

export interface ItemObservation {
  rating: Rating;
  notes?: string;
}

export interface Draft {
  schema_version: number;
  mode: "move_in" | "move_out";
  representation: string;
  walkthrough_on: string | null;
  attendees: string[];
  property: { address: string; city: string; state: string; zip: string };
  sections: Record<
    string,
    { items: Record<string, ItemObservation>; additional?: { label: string; rating: Rating; notes?: string }[] }
  >;
  keys: { label: string; issued: number; returned: number; notes?: string }[];
  utilities: Record<string, { status: string; account?: string; notes?: string }>;
  meters: { label: string; reading: string; read_on?: string; notes?: string }[];
  existing_damage: { location: string; description: string; photo_document_ids?: string[] }[];
  comments: string;
  photo_document_ids: string[];
  signer_party_ids: string[];
}

export interface SignerCandidate {
  party_id: string | null;
  role: string;
  role_label: string;
  name: string;
  email: string;
  selected: boolean;
  blocked: string | null;
}

function withSection(
  draft: Draft,
  sectionKey: string,
  mutate: (s: Draft["sections"][string]) => Draft["sections"][string],
): Draft {
  const current = draft.sections[sectionKey] ?? { items: {} };
  const next = mutate(current);
  // A rejected edit returns the SAME draft so React skips the re-render of an
  // 80-row checklist.
  if (next === current) return draft;
  return { ...draft, sections: { ...draft.sections, [sectionKey]: next } };
}

/** Set a rating, or CLEAR it when the same rating is chosen again. An agent
 *  who mis-clicks must be able to get back to not-observed, which is a
 *  different statement from any rating. */
export function toggleRating(
  draft: Draft,
  sectionKey: string,
  itemKey: string,
  rating: Rating,
): Draft {
  const existing = draft.sections[sectionKey]?.items?.[itemKey];
  if (existing?.rating !== rating) {
    return withSection(draft, sectionKey, (s) => ({
      ...s,
      items: { ...s.items, [itemKey]: { ...s.items[itemKey], rating } },
    }));
  }
  return withSection(draft, sectionKey, (s) => {
    const items = { ...s.items };
    const notes = items[itemKey]?.notes;
    delete items[itemKey];
    // The PDF renders notes beside a rating, so a note with no rating would
    // silently vanish. Keep it visible as "na".
    if (notes) items[itemKey] = { rating: "na", notes };
    return { ...s, items };
  });
}

export function setItemNote(
  draft: Draft,
  sectionKey: string,
  itemKey: string,
  notes: string,
): Draft {
  return withSection(draft, sectionKey, (s) => {
    const rating: Rating = s.items[itemKey]?.rating ?? "na";
    return { ...s, items: { ...s.items, [itemKey]: { rating, notes } } };
  });
}

export function addAdditional(draft: Draft, sectionKey: string, label: string): Draft {
  const trimmed = label.trim();
  if (!trimmed) return draft;
  return withSection(draft, sectionKey, (s) => ({
    ...s,
    additional: [...(s.additional ?? []), { label: trimmed, rating: "na" as Rating }],
  }));
}

export function removeAdditional(draft: Draft, sectionKey: string, index: number): Draft {
  return withSection(draft, sectionKey, (s) => {
    const list = [...(s.additional ?? [])];
    if (!list[index]) return s;
    list.splice(index, 1);
    return { ...s, additional: list };
  });
}

export function setScalar(
  draft: Draft,
  patch: Partial<Pick<Draft, "walkthrough_on" | "representation" | "comments">>,
): Draft {
  return { ...draft, ...patch };
}

export function toggleSigner(draft: Draft, partyId: string): Draft {
  const has = draft.signer_party_ids.includes(partyId);
  return {
    ...draft,
    signer_party_ids: has
      ? draft.signer_party_ids.filter((id) => id !== partyId)
      : [...draft.signer_party_ids, partyId],
  };
}

export interface Progress {
  rated: number;
  total: number;
  damaged: number;
  complete: boolean;
}

/** Live counter between saves, computed against the SERVER's catalogue.
 *  Agent-added rooms are excluded, matching Vault's summarizeProgress — so
 *  adding a room to a finished walkthrough cannot un-finish it. */
export function progressOf(draft: Draft, catalogue: Catalogue): Progress {
  let rated = 0;
  let damaged = 0;
  let total = 0;
  for (const section of catalogue.sections) {
    for (const item of section.items) {
      total += 1;
      const obs = draft.sections[section.key]?.items?.[item.key];
      if (!obs?.rating) continue;
      rated += 1;
      if (obs.rating === "damaged") damaged += 1;
    }
  }
  return { rated, total, damaged, complete: total > 0 && rated === total };
}

export function sectionProgress(
  draft: Draft,
  section: CatalogueSection,
): { rated: number; total: number; damaged: number } {
  let rated = 0;
  let damaged = 0;
  for (const item of section.items) {
    const obs = draft.sections[section.key]?.items?.[item.key];
    if (!obs?.rating) continue;
    rated += 1;
    if (obs.rating === "damaged") damaged += 1;
  }
  return { rated, total: section.items.length, damaged };
}

/** Why Send is unavailable, in the order an agent should fix them. A UI
 *  affordance only — the server refuses independently, and a client check is
 *  never what protects anything. */
export function sendBlockers(input: {
  draft: Draft;
  catalogue: Catalogue;
  candidates: SignerCandidate[];
  generated: boolean;
  status: string;
}): string[] {
  if (input.status === "sent") return ["Already sent for signature."];
  if (input.status === "signed") return ["Already signed."];

  const out: string[] = [];
  if (progressOf(input.draft, input.catalogue).rated === 0) {
    out.push("Record at least one condition.");
  }
  if (!input.draft.walkthrough_on) out.push("Set the walkthrough date.");

  const chosen = input.draft.signer_party_ids;
  const usable = input.candidates.filter(
    (c) =>
      c.blocked === null &&
      c.party_id != null &&
      (chosen.length === 0 || chosen.includes(c.party_id)),
  );
  if (usable.length === 0) {
    out.push(
      chosen.length === 0
        ? "Choose at least one signer."
        : "None of the chosen signers can be emailed — check their name and email.",
    );
  }
  if (!input.generated) out.push("Generate the PDF first.");
  return out;
}

/** A walkthrough is a LEASE artifact. Offering one on a purchase is noise. */
export function shouldOfferWalkthroughs(transactionType: string | null | undefined): boolean {
  if (!transactionType) return false;
  return /lease|rent/i.test(transactionType);
}

/** One OPEN walkthrough per mode at a time — the accidental-duplicate guard,
 *  mirroring the create route. A signed one does not block a re-inspection;
 *  the server still demands confirm_new for that. */
export function startableModes(
  existing: readonly { mode: string; status: string }[],
): ("move_in" | "move_out")[] {
  const open = new Set(
    existing.filter((w) => w.status !== "signed" && w.status !== "voided").map((w) => w.mode),
  );
  return (["move_in", "move_out"] as const).filter((m) => !open.has(m));
}
