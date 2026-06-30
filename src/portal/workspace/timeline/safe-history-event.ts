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

  // W3.4.4.1 — Commission lifecycle events. Detected by field_path
  // prefix BEFORE the source switch so they short-circuit the generic
  // broker_review handler that previously rendered them as "Broker
  // updated field". Card composer-owned labels only; raw new_value
  // is never rendered (the dispatcher already enforces a safe shape
  // per W3.4.4.0, but the mapper does not depend on it).
  if (fieldPath.startsWith("commission.")) {
    const commissionCard = mapCommissionAuditEvent(
      fieldPath,
      id,
      occurred_at,
      ctx,
      source
    );
    if (commissionCard) return commissionCard;
  }

  // W3.4.6.4 — AI Transaction Coach lifecycle events. Same precedent
  // as the commission short-circuit above: detect by `coach.` prefix
  // and emit a card with kind='coach'. The Coach trigger engine
  // (W3.4.6.2) currently writes notifications + push only — once a
  // future phase starts dispatching paperwork_audit_log rows with
  // field_path='coach.*', this mapper will render them safely
  // without parsing the underlying new_value JSON. Until then,
  // mapCoachAuditEvent returns null for any unrecognized fieldPath
  // and falls through to the generic broker_review handler.
  if (fieldPath.startsWith("coach.")) {
    const coachCard = mapCoachAuditEvent(fieldPath, id, occurred_at, ctx, source);
    if (coachCard) return coachCard;
  }

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

// ── W3.4.4.1 — commission lifecycle audit mapper ────────────────────
// Vault writes one paperwork_audit_log row per commission state
// transition (W3.4.4.0). This mapper renders them as kind='commission'
// with Agent-Portal-owned labels — NEVER from raw `notes` / `old_value`
// / `new_value` text. Only the `field_path` and (for compliance_checked)
// a high-level `verdict` enum drive the rendering.

function mapCommissionAuditEvent(
  fieldPath: string,
  id: string,
  occurred_at: string,
  ctx: { transactionId: string },
  source: string
): TimelineCard | null {
  const drillHref = `/workspace/${ctx.transactionId}?tab=commission`;
  switch (fieldPath) {
    case "commission.calculated":
      return {
        id,
        occurred_at,
        kind: "commission",
        tone: "info",
        iconName: "pencil",
        label: "Commission calculated",
        source,
        drillHref,
      };
    case "commission.compliance_checked":
      return {
        id,
        occurred_at,
        kind: "commission",
        tone: "info",
        iconName: "shield",
        label: "Commission compliance check",
        source,
        drillHref,
      };
    case "commission.approved":
      return {
        id,
        occurred_at,
        kind: "commission",
        tone: "ok",
        iconName: "check-circle-2",
        label: "Broker approved commission",
        source,
        drillHref,
      };
    case "commission.paid":
      return {
        id,
        occurred_at,
        kind: "commission",
        tone: "ok",
        iconName: "check-circle-2",
        label: "Commission paid",
        source,
        drillHref,
      };
    case "commission.pay.blocked":
      return {
        id,
        occurred_at,
        kind: "commission",
        tone: "warn",
        iconName: "alert-triangle",
        label: "Commission payment blocked",
        source,
        drillHref,
      };
    case "commission.deleted":
      return {
        id,
        occurred_at,
        kind: "commission",
        tone: "muted",
        iconName: "alert-circle",
        label: "Commission deleted",
        source,
        drillHref,
      };
    default:
      // Unknown commission.* — emit a generic safe card so the
      // event stays visible without leaking field_path internals.
      return {
        id,
        occurred_at,
        kind: "commission",
        tone: "muted",
        iconName: "list-checks",
        label: "Commission updated",
        source,
        drillHref,
      };
  }
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

// ── W3.4.6.4 — Coach lifecycle event mapper ────────────────────────
//
// Renders `coach.*` audit-log entries as kind='coach' cards. We use a
// fixed dictionary of recognized field_path suffixes so the Portal
// never has to parse the underlying new_value JSON. Unknown
// `coach.<suffix>` events fall back to a safe generic label rather
// than rendering raw data.
//
// SAFETY: this mapper writes Portal-owned label strings ONLY. The
// raw new_value JSON dispatched by the Vault Coach trigger is never
// inspected, parsed, or rendered.

const COACH_EVENT_LABELS: Record<string, string> = {
  // Emitted when the W3.4.6.2 trigger fires + a notification lands.
  "coach.recommendation_emitted": "Coach recommendation emitted",
  // Emitted if/when the agent dismisses a recommendation (future phase).
  "coach.recommendation_dismissed": "Coach recommendation dismissed",
  // Emitted if/when the agent accepts/snoozes (future phase).
  "coach.recommendation_accepted": "Coach recommendation accepted",
  "coach.recommendation_snoozed": "Coach recommendation snoozed",
};

function mapCoachAuditEvent(
  fieldPath: string,
  id: string,
  occurred_at: string,
  ctx: { transactionId: string },
  source: string
): TimelineCard | null {
  const drillHref = `/workspace/${ctx.transactionId}`;
  const label = COACH_EVENT_LABELS[fieldPath] ?? "Coach activity";
  return {
    id,
    occurred_at,
    kind: "coach",
    tone: "info",
    iconName: "list-checks",
    label,
    source,
    drillHref,
  };
}
