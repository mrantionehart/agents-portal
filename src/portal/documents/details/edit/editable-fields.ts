// ============================================================================
// AGENT PORTAL 3.0 — Workflow 3.2.B.1 — Editable-field classifier
// ============================================================================
// Pure functions. Classify a RequirementRow.required_fields[] spec into
// an EditableField (with the PATCH endpoint to call) or skip it.
//
// CLIENT MIRROR of Vault's authoritative allowlists. Mirrored verbatim
// for display-only purposes; Vault remains the final authority and
// returns 400/403 on any drift. Boundary lint tests assert the mirror
// matches Vault's source byte-for-byte.
// ============================================================================

import { STATUTORY_FACT_KEYS } from "@/lib/paperworkTypes";
import type { RequirementRow } from "../../types";
import type { EditableField } from "../types";

/** Display-only mirror of vault/src/lib/paperwork/route-helpers.ts:483
 *  TERMS_PATH_ALLOWLIST. Server is authoritative — Vault returns 400
 *  on any disallowed path. Keep this in sync; the boundary lint test
 *  reads both files and asserts equality. */
export const TERMS_PATH_ALLOWLIST_MIRROR: ReadonlyArray<RegExp> = [
  /^lease\.term\.(start_date|end_date|term_months|holdover_terms)$/,
  /^lease\.rent\.(monthly_amount|due_day_of_month|grace_period_days|late_fee_amount|returned_check_fee|where_payable)$/,
  /^lease\.deposits\.(security_deposit_amount|security_deposit_holder|advance_rent_amount|last_month_rent_collected)$/,
  /^lease\.pets\.(allowed|deposit|restrictions)$/,
  /^lease\.utilities\.(paid_by_tenant|paid_by_landlord|notes)$/,
  /^lease\.restrictions\.(smoking_allowed|business_use_allowed|subletting_allowed|alterations_allowed)$/,
  /^lease\.is_contract_to_lease$/,
];

export function isAllowedTermsPathMirror(path: string): boolean {
  if (!path || typeof path !== "string") return false;
  for (const re of TERMS_PATH_ALLOWLIST_MIRROR) {
    if (re.test(path)) return true;
  }
  return false;
}

/** Roles that may only edit via party portal — never agent. */
const PARTY_ROLES: ReadonlySet<string> = new Set([
  "seller",
  "buyer",
  "landlord",
  "tenant",
  "co_seller",
  "co_buyer",
  "co_landlord",
  "co_tenant",
]);

/** Infer an input type from a transaction_path naming convention.
 *  Heuristic only — used to pre-select the InlineEditableField variant.
 *  Server-side validation is the real gate. */
export function inferInputType(
  path: string
): "text" | "number" | "boolean" | "date" {
  const leaf = path.split(".").pop() ?? path;
  if (leaf.endsWith("_date")) return "date";
  if (
    leaf.endsWith("_amount") ||
    leaf.endsWith("_fee") ||
    leaf.endsWith("_days") ||
    leaf.endsWith("_months") ||
    leaf === "due_day_of_month" ||
    leaf.endsWith("_count") ||
    leaf === "deposit" ||
    leaf === "term_months" ||
    leaf === "monthly_amount" ||
    leaf === "year_built"
  )
    return "number";
  if (
    leaf === "allowed" ||
    leaf.endsWith("_allowed") ||
    leaf.startsWith("is_") ||
    leaf.startsWith("has_") ||
    leaf === "paid_by_tenant" ||
    leaf === "paid_by_landlord" ||
    leaf === "last_month_rent_collected"
  )
    return "boolean";
  return "text";
}

/** Convert a transaction_path leaf into a human label. */
export function pathLabel(path: string): string {
  const leaf = path.split(".").pop() ?? path;
  return leaf.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export interface ClassifyResult {
  editable: EditableField | null;
  /** Reason for being non-editable, when not editable. */
  reason: "statutory" | "party_only" | "broker_only" | "txn_col" | "party_field" | "unknown" | null;
}

/** Classify ONE required_fields spec. Returns an EditableField with
 *  endpoint+key/path when agent-editable, or null + reason otherwise. */
export function classifyField(
  spec: NonNullable<RequirementRow["required_fields"]>[number]
): ClassifyResult {
  const path = (spec?.transaction_path ?? "").trim();
  const severity = (spec?.severity ?? "").trim();
  const completer = (spec?.completer_role ?? "").trim();

  if (!path) return { editable: null, reason: "unknown" };

  // Statutory — owned by party portal, drawer's existing statutory
  // section already renders these read-only.
  if (severity.startsWith("statutory_")) {
    return { editable: null, reason: "statutory" };
  }

  // Completer role gates.
  if (PARTY_ROLES.has(completer)) {
    return { editable: null, reason: "party_only" };
  }
  if (completer === "broker") {
    return { editable: null, reason: "broker_only" };
  }

  // Path-prefix dispatch.
  if (path.startsWith("facts.")) {
    const key = path.slice("facts.".length);
    if ((STATUTORY_FACT_KEYS as ReadonlyArray<string>).includes(key)) {
      return { editable: null, reason: "statutory" };
    }
    return {
      editable: {
        transaction_path: path,
        endpoint: "facts",
        key,
        label: spec?.label ?? pathLabel(path),
        inputType: inferInputType(path),
        severity,
        completer_role: completer,
      },
      reason: null,
    };
  }

  if (path.startsWith("terms.")) {
    const termPath = path.slice("terms.".length);
    if (!isAllowedTermsPathMirror(termPath)) {
      // Vault would 400 — show as read-only to avoid a guaranteed-bad PATCH.
      return { editable: null, reason: "unknown" };
    }
    return {
      editable: {
        transaction_path: path,
        endpoint: "terms",
        termPath,
        label: spec?.label ?? pathLabel(path),
        inputType: inferInputType(path),
        severity,
        completer_role: completer,
      },
      reason: null,
    };
  }

  if (path.startsWith("txn.")) {
    return { editable: null, reason: "txn_col" };
  }
  if (path.startsWith("parties.")) {
    return { editable: null, reason: "party_field" };
  }
  return { editable: null, reason: "unknown" };
}

/** Build the per-form editable field list. Stable order = spec order. */
export function deriveAgentEditableFields(
  requirement: RequirementRow | null
): EditableField[] {
  if (!requirement?.required_fields) return [];
  const out: EditableField[] = [];
  const seen = new Set<string>();
  for (const spec of requirement.required_fields) {
    const cls = classifyField(spec);
    if (cls.editable && !seen.has(cls.editable.transaction_path)) {
      seen.add(cls.editable.transaction_path);
      out.push(cls.editable);
    }
  }
  return out;
}

/** Map a reason code to a short, user-facing line. */
export function reasonLabel(reason: ClassifyResult["reason"]): string {
  switch (reason) {
    case "statutory":
      return "Statutory — party portal only";
    case "party_only":
      return "Party portal only";
    case "broker_only":
      return "Broker only";
    case "txn_col":
      return "Edit in Vault";
    case "party_field":
      return "Broker only (party field)";
    case "unknown":
      return "Read-only";
    default:
      return "";
  }
}
