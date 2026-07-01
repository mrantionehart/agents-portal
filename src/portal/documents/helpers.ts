// ============================================================================
// AGENT PORTAL 2.1 — R4 — Documents helpers
// ============================================================================
// Pure functions: merge Vault's (requirements, instances) into a single
// DocumentRow list, derive counts, format labels. No DB, no DOM,
// no fetch.
// ============================================================================

import type {
  DocumentCounts,
  DocumentRow,
  FormInstanceRow,
  RequirementRow,
} from "./types";
import type { FormInstanceStatus } from "./shared-types";

/** Build a per-form Vault deep-link. The Vault paperwork package
 *  page hosts the form detail; agents click through there to see /
 *  edit / sign as their role permits. We anchor on form_id so the
 *  link survives instance re-creation. */
export function buildOpenInVaultUrl(
  vaultBase: string,
  transactionId: string,
  formId: string
): string {
  const base = vaultBase.replace(/\/$/, "");
  return `${base}/paperwork/transactions/${transactionId}#form-${encodeURIComponent(
    formId
  )}`;
}

/** Compute the upper-bound count of missing required fields. Without
 *  drilling into per-field completion (which the Documents panel
 *  doesn't need), we use the rule-engine spec's required_fields count
 *  as the cap when no instance exists, and assume zero when the form
 *  is `signed`/`sent`. For `in_progress`/`ready`/`blocked` we surface
 *  the spec count as a hint — the broker drilldown in Vault has the
 *  precise list. */
export function deriveMissingFieldsCount(
  req: RequirementRow | null,
  instance: FormInstanceRow | null
): number | null {
  // If the form is signed/sent/voided, no missing fields are surfaced
  // here — the lifecycle has moved past the data-collection phase.
  if (instance) {
    const s = instance.status;
    if (s === "signed" || s === "sent" || s === "voided" || s === "ready") {
      return 0;
    }
  }
  const required = (req?.required_fields ?? []).filter((f) => f?.required !== false);
  return required.length;
}

/** Resolve the unified status for a (requirement, instance) pair. */
export function resolveStatus(
  req: RequirementRow | null,
  instance: FormInstanceRow | null
): FormInstanceStatus | "not_started" {
  if (instance) {
    const s = instance.status as FormInstanceStatus | string;
    // Known statuses pass through; anything unknown becomes
    // "in_progress" rather than leaking a stale label.
    if (
      s === "recommended" ||
      s === "required" ||
      s === "blocked" ||
      s === "in_progress" ||
      s === "ready" ||
      s === "sent" ||
      s === "signed" ||
      s === "voided"
    ) {
      return s;
    }
    return "in_progress";
  }
  return "not_started";
}

/** Merge Vault's two arrays into one DocumentRow list. Rule-engine
 *  requirements list is authoritative; instances attach by form_id.
 *  Stable order — preserves rule-engine order. */
export function mergeDocuments(input: {
  vaultBase: string;
  transactionId: string;
  requirements: RequirementRow[];
  instances: FormInstanceRow[];
}): DocumentRow[] {
  const byFormId = new Map<string, FormInstanceRow>();
  for (const inst of input.instances) {
    if (!inst?.form_id) continue;
    // Take the most-recent instance per form_id (the rule engine
    // permits revisions over time; promote() makes one per form).
    const prev = byFormId.get(inst.form_id);
    if (!prev || (inst.updated_at && (!prev.updated_at || inst.updated_at > prev.updated_at))) {
      byFormId.set(inst.form_id, inst);
    }
  }

  const rows: DocumentRow[] = [];
  for (const req of input.requirements) {
    if (!req?.form_id) continue;
    const inst = byFormId.get(req.form_id) ?? null;
    const status = resolveStatus(req, inst);
    const signed_at =
      inst && (status === "signed" || status === "sent") && inst.completed_at
        ? inst.completed_at
        : null;
    rows.push({
      form_id: req.form_id,
      form_revision: req.form_revision ?? inst?.form_revision ?? null,
      form_category: req.form_category ?? inst?.form_category ?? null,
      reason: req.reason ?? null,
      status,
      missing_fields_count: deriveMissingFieldsCount(req, inst),
      has_envelope: Boolean(inst?.envelope_id),
      signed_at,
      updated_at: inst?.updated_at ?? inst?.created_at ?? null,
      has_instance: inst !== null,
      open_in_vault_url: buildOpenInVaultUrl(
        input.vaultBase,
        input.transactionId,
        req.form_id
      ),
      form_instance_id: inst?.id ?? null,
      downloadable: isRowDownloadable(status, inst),
    });
    byFormId.delete(req.form_id);
  }

  // Any orphan instance (had a row in DB but the rule engine no longer
  // emits this form) — surface it so a broker can tell at a glance.
  for (const inst of byFormId.values()) {
    const status = resolveStatus(null, inst);
    rows.push({
      form_id: inst.form_id,
      form_revision: inst.form_revision ?? null,
      form_category: inst.form_category ?? null,
      reason: null,
      status,
      missing_fields_count: 0,
      has_envelope: Boolean(inst.envelope_id),
      signed_at:
        status === "signed" || status === "sent"
          ? inst.completed_at ?? null
          : null,
      updated_at: inst.updated_at ?? inst.created_at ?? null,
      has_instance: true,
      open_in_vault_url: buildOpenInVaultUrl(
        input.vaultBase,
        input.transactionId,
        inst.form_id
      ),
      form_instance_id: inst.id,
      downloadable: isRowDownloadable(status, inst),
    });
  }

  return rows;
}

/** AGENT.DOCS.1 — UI-side hint for the row's Download button. Only
 *  the download endpoint on Vault is authoritative — this just decides
 *  whether to render the button at all. */
function isRowDownloadable(
  status: FormInstanceStatus | "not_started",
  instance: FormInstanceRow | null
): boolean {
  if (!instance) return false;
  if (status === "voided") return false;
  if (status === "ready") return true;
  if (status === "signed") return true;
  return false;
}

/** Compute the header roll-ups. */
export function documentCounts(rows: DocumentRow[]): DocumentCounts {
  let ready = 0;
  let blocked = 0;
  let signed = 0;
  let in_progress = 0;
  let not_started = 0;
  let needs_attention = 0;
  for (const r of rows) {
    switch (r.status) {
      case "ready":
        ready += 1;
        break;
      case "blocked":
        blocked += 1;
        needs_attention += 1;
        break;
      case "signed":
      case "sent":
        signed += 1;
        break;
      case "in_progress":
        in_progress += 1;
        if ((r.missing_fields_count ?? 0) > 0) needs_attention += 1;
        break;
      case "not_started":
      case "recommended":
      case "required":
        not_started += 1;
        if ((r.missing_fields_count ?? 0) > 0) needs_attention += 1;
        break;
    }
  }
  return {
    total: rows.length,
    ready,
    blocked,
    signed,
    in_progress,
    not_started,
    needs_attention,
  };
}

// ── Display ─────────────────────────────────────────────────────────

export function statusLabel(s: DocumentRow["status"]): string {
  switch (s) {
    case "ready":
      return "Ready";
    case "blocked":
      return "Blocked";
    case "signed":
      return "Signed";
    case "sent":
      return "Sent";
    case "in_progress":
      return "In Progress";
    case "voided":
      return "Voided";
    case "recommended":
      return "Recommended";
    case "required":
      return "Required";
    case "not_started":
      return "Not Started";
    default:
      return "Unknown";
  }
}

/** Returns one of: ok | info | warn | muted — drives the badge color. */
export function statusTone(
  s: DocumentRow["status"]
): "ok" | "info" | "warn" | "muted" {
  if (s === "signed" || s === "sent") return "ok";
  if (s === "blocked") return "warn";
  if (s === "ready") return "info";
  if (s === "in_progress") return "info";
  return "muted";
}

export function missingFieldsCopy(
  count: number | null,
  status: DocumentRow["status"]
): string | null {
  if (count == null) return null;
  if (count <= 0) return null;
  if (status === "blocked") {
    return `${count} required field${count === 1 ? "" : "s"} blocked on party attestation`;
  }
  return `${count} required field${count === 1 ? "" : "s"} outstanding`;
}

export function envelopeCopy(row: DocumentRow): string | null {
  if (!row.has_envelope) return null;
  if (row.status === "signed") return "Envelope signed";
  if (row.status === "sent") return "Envelope sent — awaiting signatures";
  return "Envelope present";
}

export function relativeUpdated(iso: string | null, now: Date = new Date()): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function categoryLabel(c: string | null): string {
  if (!c) return "—";
  if (c === "lease") return "Lease";
  if (c === "purchase") return "Purchase";
  if (c === "listing") return "Listing";
  if (c === "buyer_rep") return "Buyer Rep";
  if (c === "addendum") return "Addendum";
  if (c === "disclosure") return "Disclosure";
  return c;
}
