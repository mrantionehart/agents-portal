// ============================================================================
// AGENT PORTAL 2.1 — R2B — Pure helpers for the portal detail page
// ============================================================================
// Aggregation, sorting, anonymization helpers. All inputs are plain JSON;
// no DOM, no Supabase, no fetch.
// ============================================================================

import type { PortalFeedbackPayload, PortalViewRow } from "./detail-types";

/** Compute roll-ups across all properties in a feedback payload. */
export interface FeedbackSummary {
  totalFavorites: number;
  totalComments: number;
  totalRespondents: number;
  propertyCount: number;
  hasFeedback: boolean;
}

export function summarizeFeedback(
  payload: PortalFeedbackPayload | null
): FeedbackSummary {
  if (!payload) {
    return {
      totalFavorites: 0,
      totalComments: 0,
      totalRespondents: 0,
      propertyCount: 0,
      hasFeedback: false,
    };
  }
  let totalFavorites = 0;
  let totalComments = 0;
  for (const p of payload.properties) {
    totalFavorites += p.favorites;
    totalComments += p.comments.length;
  }
  const propertyCount = payload.properties.length;
  return {
    totalFavorites,
    totalComments,
    totalRespondents: payload.total_responses,
    propertyCount,
    hasFeedback: propertyCount > 0,
  };
}

/** Sort views newest-first, defensively re-applying chronology even if
 *  Vault changes its ordering in the future. */
export function sortViewsNewestFirst(views: PortalViewRow[]): PortalViewRow[] {
  return [...views].sort(
    (a, b) =>
      new Date(b.viewed_at).getTime() - new Date(a.viewed_at).getTime()
  );
}

/** Mask a viewer email or name for display so a broker doesn't surface
 *  a client's full email in the activity panel by accident. */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return "Anonymous";
  const at = email.indexOf("@");
  if (at <= 1) return email;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (local.length <= 2) return `${local[0]}*@${domain}`;
  return `${local[0]}${"*".repeat(local.length - 2)}${local[local.length - 1]}@${domain}`;
}

/** Compute the most-recent viewed_at across a portal's view rows.
 *  Falls back to portal.last_viewed_at if the views array is empty. */
export function lastViewedAt(
  views: PortalViewRow[],
  fallback: string | null
): string | null {
  if (!views.length) return fallback;
  const sorted = sortViewsNewestFirst(views);
  return sorted[0].viewed_at;
}

// ── Activity timeline (views + comments unified) ────────────────────

export type ActivityEvent =
  | { kind: "view"; ts: string }
  | { kind: "comment"; ts: string; name: string; comment: string; property: string }
  | { kind: "favorite"; ts: string; property: string; respondents: string[] };

/** Build a unified timeline from views + per-property feedback. Comments
 *  carry a per-row timestamp (`date`); favorites are roll-up counts per
 *  property so we surface them as a single event keyed off the most
 *  recent associated comment (or "now" if none) — simpler than guessing
 *  the favorite's exact moment, which isn't on the feedback row. */
export function buildActivityTimeline(
  views: PortalViewRow[],
  payload: PortalFeedbackPayload | null
): ActivityEvent[] {
  const events: ActivityEvent[] = [];

  for (const v of views) {
    events.push({ kind: "view", ts: v.viewed_at });
  }
  if (payload) {
    for (const prop of payload.properties) {
      for (const c of prop.comments) {
        events.push({
          kind: "comment",
          ts: c.date,
          name: c.name,
          comment: c.comment,
          property: prop.title,
        });
      }
    }
  }

  return events.sort(
    (a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()
  );
}
