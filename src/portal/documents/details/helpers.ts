// ============================================================================
// AGENT PORTAL 3.0 — Workflow 3.2.A — Form detail drawer helpers
// ============================================================================
// Pure functions only. No fetch, no DOM, no DB.
// Filters pre-loaded data to one form's scope.
// ============================================================================

import type { DocumentRow, RequirementRow } from "../types";
import type {
  MissingFieldsItem,
  MissingFieldsReport,
  StatutoryFieldSummary,
  TimelineEvent,
} from "./types";

/** Whether the caller can see the broker-only drawer sections. Mirrors
 *  Vault's `requireBrokerTier:true` gate on /history, /envelope,
 *  /pdf-download. Keep in sync with vault/src/lib/paperwork/route-helpers.ts:37
 *  (BROKER_TIER_ROLES). */
const BROKER_TIER = new Set(["broker", "admin", "office_manager"]);

export function isBrokerTier(role: string | null | undefined): boolean {
  if (!role) return false;
  return BROKER_TIER.has(role);
}

/** Resolve a raw `?form=` value to a form_id that exists in the current
 *  documents scope. Unknown / cross-tenant / malformed values return
 *  null — the drawer stays closed. This is the cross-tenant safety
 *  bound for the drawer route. */
export function parseFormId(
  raw: string | undefined | null,
  documents: ReadonlyArray<DocumentRow>
): string | null {
  if (!raw || typeof raw !== "string") return null;
  if (raw.length === 0 || raw.length > 64) return null;
  // form_id must match exactly one of the loaded DocumentRow form_ids.
  // We do NOT do prefix / case-insensitive matching — that would weaken
  // the tenant boundary.
  const exact = documents.find((d) => d.form_id === raw);
  return exact ? exact.form_id : null;
}

/** Filter the de-duped missing-fields report to items that block this
 *  form_id. Order: statutory first, then high → info. */
export function filterMissingFieldsForForm(
  report: MissingFieldsReport | null,
  formId: string
): MissingFieldsItem[] {
  if (!report || !Array.isArray(report.items)) return [];
  const items = report.items.filter(
    (it) => Array.isArray(it.blocks_forms) && it.blocks_forms.includes(formId)
  );
  return [...items].sort((a, b) => severityWeight(a.severity) - severityWeight(b.severity));
}

/** Filter audit + review timeline events to those tagged with the given
 *  form_instance_id (audit events only; review events are
 *  transaction-level and surface in the workspace, not the drawer). */
export function filterHistoryForFormInstance(
  events: ReadonlyArray<TimelineEvent> | null,
  formInstanceId: string | null
): TimelineEvent[] {
  if (!events) return [];
  if (!formInstanceId) {
    // No instance materialized yet → no audit history scoped to this form.
    return [];
  }
  return events.filter(
    (e) =>
      e.kind === "audit" &&
      typeof e.form_instance_id === "string" &&
      e.form_instance_id === formInstanceId
  );
}

/** Build the statutory-fields list for the drawer. Pulls from the
 *  rule-engine requirement's required_fields, keeping only those marked
 *  statutory, and flags each as satisfied if its transaction_path appears
 *  in the report's `satisfied_statutory_paths`. */
export function extractStatutoryFields(
  requirement: RequirementRow | null,
  report: MissingFieldsReport | null
): StatutoryFieldSummary[] {
  if (!requirement?.required_fields) return [];
  const satisfied = new Set(report?.satisfied_statutory_paths ?? []);
  const out: StatutoryFieldSummary[] = [];
  for (const spec of requirement.required_fields) {
    if (!spec?.transaction_path) continue;
    const sev = spec.severity ?? "";
    if (!sev.startsWith("statutory_")) continue;
    out.push({
      transaction_path: spec.transaction_path,
      severity: sev,
      completer_role: spec.completer_role ?? "",
      satisfied: satisfied.has(spec.transaction_path),
    });
  }
  return out;
}

/** Lower = higher priority. Statutory > high > medium > low > info. */
export function severityWeight(severity: string | undefined | null): number {
  const s = severity ?? "";
  if (s.startsWith("statutory_")) return 0;
  if (s === "high") return 1;
  if (s === "medium") return 2;
  if (s === "low") return 3;
  return 4; // info / unknown
}

export function humanSeverity(severity: string | undefined | null): string {
  const s = severity ?? "";
  if (s.startsWith("statutory_")) return "Statutory";
  if (s === "high") return "High";
  if (s === "medium") return "Medium";
  if (s === "low") return "Low";
  return "Info";
}

export function severityTone(
  severity: string | undefined | null
): "warn" | "info" | "muted" {
  const s = severity ?? "";
  if (s.startsWith("statutory_") || s === "high") return "warn";
  if (s === "medium" || s === "low") return "info";
  return "muted";
}

/** Build the canonical drawer URL preserving the current tab. */
export function formDrawerHref(
  transactionId: string,
  formId: string
): string {
  return `/workspace/${transactionId}?tab=documents&form=${encodeURIComponent(formId)}`;
}

/** URL to close the drawer (stay on documents tab). */
export function formDrawerCloseHref(transactionId: string): string {
  return `/workspace/${transactionId}?tab=documents`;
}

/** Build a per-completer-role label (e.g. "Agent · Buyer", "Party · Seller"). */
export function completerRoleLabel(role: string | undefined | null): string {
  if (!role) return "—";
  if (role === "agent") return "Agent";
  if (role === "broker") return "Broker";
  if (role === "buyer" || role === "co_buyer") return "Party · Buyer";
  if (role === "seller" || role === "co_seller") return "Party · Seller";
  if (role === "landlord" || role === "co_landlord") return "Party · Landlord";
  if (role === "tenant" || role === "co_tenant") return "Party · Tenant";
  return role;
}
