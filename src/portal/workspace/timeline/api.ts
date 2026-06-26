// ============================================================================
// AGENT PORTAL 3.0 — Workflow 3.3.1 — Timeline fetcher (broker-only)
// ============================================================================
// Server-only. Fetches Vault's BROKER-ONLY
//   GET /api/paperwork/transactions/[id]/history?limit=50
// when the caller is broker / admin / office_manager. Skipped entirely
// for agent role — the agent timeline is composed purely from already-
// loaded snapshot signals (compose-timeline.ts handles the degraded
// path).
//
// Soft-fails: any non-OK response or network error returns
// { kind: 'error', message } so the composer can render a degraded
// banner. Never throws.
// ============================================================================

import "server-only";

import { isBrokerTier } from "../../documents/details/helpers";
import { toSafeTimelineCard } from "./safe-history-event";
import type { RawHistoryEvent, TimelineCard } from "./types";

const VAULT_API_URL = (
  process.env.NEXT_PUBLIC_VAULT_API_URL ??
  "https://vault.hartfeltrealestate.com/api"
).replace(/\/$/, "");

const HISTORY_LIMIT = 50;

export type FetchTimelineResult =
  | { kind: "broker"; cards: TimelineCard[] }
  | { kind: "skip" }            // agent — by design, never call /history
  | { kind: "error"; message: string };

export interface FetchTimelineInput {
  accessToken: string;
  transactionId: string;
  callerRole: string | null | undefined;
}

export async function fetchTimelineHistorySafely(
  input: FetchTimelineInput
): Promise<FetchTimelineResult> {
  // Hard role gate. /history would 403 for agents — defense-in-depth on
  // top of Vault's authoritative gate.
  if (!isBrokerTier(input.callerRole)) {
    return { kind: "skip" };
  }
  try {
    const res = await fetch(
      `${VAULT_API_URL}/paperwork/transactions/${input.transactionId}/history?limit=${HISTORY_LIMIT}`,
      {
        headers: {
          Authorization: `Bearer ${input.accessToken}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      }
    );
    if (!res.ok) {
      const body = await res.text().catch(() => res.statusText);
      return { kind: "error", message: trimMessage(body) };
    }
    const body = (await res.json()) as { events?: RawHistoryEvent[] };
    const events = Array.isArray(body?.events) ? body.events : [];
    const cards: TimelineCard[] = [];
    for (const raw of events) {
      const card = toSafeTimelineCard(raw, { transactionId: input.transactionId });
      if (card) cards.push(card);
    }
    return { kind: "broker", cards };
  } catch (err) {
    return {
      kind: "error",
      message: err instanceof Error ? err.message : "Network error",
    };
  }
}

function trimMessage(body: string): string {
  if (typeof body !== "string") return "";
  const s = body.trim().replace(/\s+/g, " ");
  return s.length > 200 ? s.slice(0, 197) + "…" : s;
}
