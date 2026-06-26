// ============================================================================
// AGENT PORTAL 3.0 — Workflow 3.3.1 — Safe history event mapper
// ============================================================================
// Pure function. Maps Vault's /history event payload into a safe
// TimelineCard.
//
// SAFETY CONTRACT — composer NEVER renders:
//   • notes               (broker review notes — may contain broker context)
//   • old_value           (raw value text — may contain agent client data)
//   • new_value           (raw value text — same)
//   • raw status_before / status_after strings (used only to derive label)
//   • actor_id raw uuid in the UI (formatted opaquely)
//
// Agent Portal owns every visible string in the returned TimelineCard.
//
// This module is invoked only inside the broker-tier fetcher in api.ts —
// agents never reach this code path at runtime. The mask exists as
// defense-in-depth + to keep the broker view safe from accidental leaks
// (e.g. if a Vault response shape changes).
// ============================================================================

import type { RawHistoryEvent, TimelineCard } from "./types";
import { formDrawerHref } from "../../documents/details/helpers";

/** Build a safe TimelineCard from a Vault history event. Returns null
 *  when the event lacks a parseable `created_at` or is otherwise
 *  unrecognized. */
export function toSafeTimelineCard(
  raw: RawHistoryEvent,
  ctx: { transactionId: string }
): TimelineCard | null {
  if (!raw?.created_at || !raw?.id) return null;
  const id = String(raw.id);
  const occurred_at = String(raw.created_at);

  if (raw.kind === "review") {
    return mapReviewEvent(raw, id, occurred_at);
  }
  if (raw.kind === "audit") {
    return mapAuditEvent(raw, id, occurred_at, ctx);
  }
  return null;
}

// ── audit events ────────────────────────────────────────────────────

function mapAuditEvent(
  raw: RawHistoryEvent,
  id: string,
  occurred_at: string,
  ctx: { transactionId: string }
): TimelineCard | null {
  const source = (raw.source ?? "").trim();
  const fieldPath = (raw.field_path ?? "").trim();
  const formInstanceId = raw.form_instance_id ?? null;
  const formId = pickFormIdFromInstance(formInstanceId);

  const drillHref = formId ? formDrawerHref(ctx.transactionId, formId) : undefined;

  switch (source) {
    case "system": {
      if (fieldPath === "transaction.promoted") {
        return {
          id,
          occurred_at,
          kind: "milestone",
          tone: "muted",
          iconName: "milestone",
          label: "Transaction materialized",
          source,
        };
      }
      return {
        id,
        occurred_at,
        kind: "audit",
        tone: "muted",
        iconName: "list-checks",
        label: "System update",
        detail: humanizeFieldPath(fieldPath),
        source,
      };
    }
    case "typed":
    case "agent_review": {
      return {
        id,
        occurred_at,
        kind: "audit",
        tone: "info",
        iconName: "pencil",
        label: "Field updated",
        detail: humanizeFieldPath(fieldPath),
        source,
        drillHref,
      };
    }
    case "broker_review": {
      return {
        id,
        occurred_at,
        kind: "audit",
        tone: "info",
        iconName: "pencil",
        label: "Broker updated field",
        detail: humanizeFieldPath(fieldPath),
        source,
        drillHref,
      };
    }
    case "party_portal": {
      const key = stripFactsPrefix(fieldPath);
      return {
        id,
        occurred_at,
        kind: "compliance",
        tone: "ok",
        iconName: "shield",
        label: key
          ? `Party attested: ${humanizeStatutoryKey(key)}`
          : "Party portal activity",
        source,
      };
    }
    case "pdf_generation": {
      return {
        id,
        occurred_at,
        kind: "audit",
        tone: "info",
        iconName: "file-text",
        label: formId ? `PDF generated for ${formId}` : "PDF generated",
        source,
        drillHref,
      };
    }
    case "docusign": {
      // Field path may carry the event type (e.g. "envelope.completed").
      const eventType = stripEnvelopePrefix(fieldPath);
      const tone =
        eventType === "completed"
          ? "ok"
          : eventType === "declined" || eventType === "voided"
          ? "warn"
          : "info";
      return {
        id,
        occurred_at,
        kind: "envelope",
        tone,
        iconName: "mail",
        label: envelopeLabel(eventType, formId),
        source,
        drillHref,
      };
    }
    default: {
      return {
        id,
        occurred_at,
        kind: "audit",
        tone: "muted",
        iconName: "clock",
        label: "Transaction activity",
        source: source || undefined,
        drillHref,
      };
    }
  }
}

// ── review events ───────────────────────────────────────────────────

function mapReviewEvent(
  raw: RawHistoryEvent,
  id: string,
  occurred_at: string
): TimelineCard | null {
  const action = (raw.action ?? "").trim().toLowerCase();
  // status_before / status_after are used internally for the label but
  // are NOT included in detail (composer owns every visible string).

  switch (action) {
    case "submitted":
      return {
        id,
        occurred_at,
        kind: "review",
        tone: "info",
        iconName: "hourglass",
        label: "Submitted for broker review",
      };
    case "approved":
      return {
        id,
        occurred_at,
        kind: "review",
        tone: "ok",
        iconName: "check-circle-2",
        label: "Broker approved transaction",
      };
    case "rejected":
      // NEVER include raw notes — broker may have written confidential
      // context. Label only.
      return {
        id,
        occurred_at,
        kind: "review",
        tone: "warn",
        iconName: "alert-triangle",
        label: "Broker requested revisions",
      };
    default:
      return {
        id,
        occurred_at,
        kind: "review",
        tone: "muted",
        iconName: "user-circle-2",
        label: "Broker review activity",
      };
  }
}

// ── helpers ─────────────────────────────────────────────────────────

const STATUTORY_LABELS: Record<string, string> = {
  flood_history: "Flood history",
  prior_insurance_claim: "Prior insurance claim",
  prior_fema_assistance: "Prior FEMA assistance",
  lead_paint_knowledge: "Lead paint knowledge",
  lead_paint_records: "Lead paint records",
};

function humanizeStatutoryKey(key: string): string {
  return STATUTORY_LABELS[key] ?? key.replace(/_/g, " ");
}

function humanizeFieldPath(p: string): string | undefined {
  if (!p) return undefined;
  // Safe humanization: replace dots/underscores, drop common prefixes.
  return p
    .replace(/^(facts|terms|txn|parties)\./, "")
    .replace(/_/g, " ");
}

function stripFactsPrefix(p: string): string {
  if (!p) return "";
  if (p.startsWith("facts.")) return p.slice("facts.".length);
  return p;
}

function stripEnvelopePrefix(p: string): string {
  if (!p) return "";
  if (p.startsWith("envelope.")) return p.slice("envelope.".length);
  return p;
}

function envelopeLabel(eventType: string, formId: string | null): string {
  const formPart = formId ? ` — ${formId}` : "";
  switch (eventType) {
    case "sent":
      return `Envelope sent${formPart}`;
    case "viewed":
      return `Envelope viewed${formPart}`;
    case "delivered":
      return `Envelope delivered${formPart}`;
    case "completed":
    case "signed":
      return `Envelope signed${formPart}`;
    case "declined":
      return `Envelope declined${formPart}`;
    case "voided":
      return `Envelope voided${formPart}`;
    case "":
      return `Envelope activity${formPart}`;
    default:
      return `Envelope: ${eventType}${formPart}`;
  }
}

/** form_instance_id is a UUID — we cannot derive the form code from it
 *  without an additional lookup. Returns null so the card uses the
 *  generic envelope label until W3.4 wires a richer feed. */
function pickFormIdFromInstance(_id: string | null): string | null {
  return null;
}
