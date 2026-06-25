// ============================================================================
// AGENT PORTAL 2.0 — AP2.1E — Home Dashboard pure helpers
// ============================================================================
// All derivations are pure: input = WorkspaceCard[] (from Vault) + maybe
// a clock/name; output = display data. Zero business logic — buckets
// are presentational categorizations, not paperwork-state computations.
// ============================================================================

import type { WorkspaceCard } from "../workspace/types";

// ── Greeting + summary ──────────────────────────────────────────────

export type Greeting = "Good morning" | "Good afternoon" | "Good evening";

/** Time-of-day greeting. Hour is passed in so tests are deterministic. */
export function greetingFor(hourOfDay: number): Greeting {
  if (hourOfDay < 12) return "Good morning";
  if (hourOfDay < 17) return "Good afternoon";
  return "Good evening";
}

/** First name (or "there" if no name is on file). */
export function firstName(fullName: string | null | undefined): string {
  if (!fullName) return "there";
  const trimmed = fullName.trim();
  if (!trimmed) return "there";
  return trimmed.split(/\s+/)[0];
}

/** Date string for the header — e.g. "Wednesday, June 25". */
export function formatToday(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/** Build the one-line summary based on the workspace cards. */
export function summarySentence(cards: WorkspaceCard[]): string {
  if (cards.length === 0) {
    return "You don't have any active transactions today.";
  }
  const c = bucketCounts(cards);
  const parts: string[] = [];

  if (c.needs_attention > 0) {
    parts.push(
      `${c.needs_attention} ${plural(c.needs_attention, "transaction", "transactions")} that ${
        c.needs_attention === 1 ? "needs" : "need"
      } attention`
    );
  }
  if (c.ready_for_review > 0) {
    parts.push(
      `${c.ready_for_review} ${plural(c.ready_for_review, "package", "packages")} ready for broker review`
    );
  }
  if (c.ready_for_signature > 0) {
    parts.push(
      `${c.ready_for_signature} ${plural(c.ready_for_signature, "package", "packages")} ready for signature preparation`
    );
  }
  if (c.waiting_on_parties > 0) {
    parts.push(
      `${c.waiting_on_parties} ${plural(c.waiting_on_parties, "transaction", "transactions")} waiting on a party disclosure`
    );
  }

  if (parts.length === 0) {
    return "All your transactions are quiet right now — nothing urgent.";
  }

  // Join with "and" for natural reading; cap at 2 phrases for readability.
  const capped = parts.slice(0, 2);
  return `You have ${joinNaturally(capped)}.`;
}

function plural(n: number, singular: string, pluralWord: string) {
  return n === 1 ? singular : pluralWord;
}

function joinNaturally(arr: string[]): string {
  if (arr.length === 0) return "";
  if (arr.length === 1) return arr[0];
  if (arr.length === 2) return `${arr[0]} and ${arr[1]}`;
  return `${arr.slice(0, -1).join(", ")}, and ${arr[arr.length - 1]}`;
}

// ── Priority buckets ────────────────────────────────────────────────

export interface BucketCounts {
  needs_attention: number;
  ready_for_review: number;
  ready_for_signature: number;
  waiting_on_parties: number;
}

/** Categorize the cards into the 4 documented priority buckets.
 *  A card may appear in multiple buckets (e.g. an awaiting-statutory
 *  card counts both as "Needs Attention" and "Waiting on Parties"). */
export function bucketCounts(cards: WorkspaceCard[]): BucketCounts {
  const out: BucketCounts = {
    needs_attention: 0,
    ready_for_review: 0,
    ready_for_signature: 0,
    waiting_on_parties: 0,
  };
  for (const c of cards) {
    if (
      c.next_action === "request_party_attestation" ||
      c.next_action === "continue_collection"
    ) {
      out.needs_attention += 1;
    }
    if (c.next_action === "request_party_attestation") {
      out.waiting_on_parties += 1;
    }
    if (c.readiness_tier === "ready_for_review") {
      out.ready_for_review += 1;
    }
    if (c.readiness_tier === "ready_for_signature") {
      out.ready_for_signature += 1;
    }
  }
  return out;
}

// ── Today's Transactions ordering ───────────────────────────────────

/** Priority for "Today's Transactions" — lower wins.
 *
 *  1. request_party_attestation
 *  2. continue_collection
 *  3. ready_for_review
 *  4. ready_for_signature
 *  5. everything else
 *
 *  Within a priority bucket, lower readiness scores come first (the
 *  deals that need the most work bubble up). */
export function priorityBucket(card: WorkspaceCard): number {
  if (card.next_action === "request_party_attestation") return 1;
  if (card.next_action === "continue_collection") return 2;
  if (card.readiness_tier === "ready_for_review") return 3;
  if (card.readiness_tier === "ready_for_signature") return 4;
  return 5;
}

/** Sort copy of cards by priorityBucket then readiness ASC. */
export function prioritizeForToday(cards: WorkspaceCard[]): WorkspaceCard[] {
  return [...cards].sort((a, b) => {
    const pa = priorityBucket(a);
    const pb = priorityBucket(b);
    if (pa !== pb) return pa - pb;
    return a.readiness_score - b.readiness_score;
  });
}
