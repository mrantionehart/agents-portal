// ============================================================================
// AGENT PORTAL 3.0 — Workflow 3.2.B.1 — Current-value resolver
// ============================================================================
// Pure function. Given a TransactionSnapshot (facts + terms loaded from
// Vault's GET /paperwork/transactions/[id]) and a transaction_path,
// return the current value to seed the InlineEditableField.
//
// Recognizes the same prefixes resolveTransactionPath() does in Vault:
//   facts.<key>          → snapshot.facts[key].value
//   terms.<a>.<b>...     → nested lookup under snapshot.terms
//   facts_hearsay.<key>  → never resolved (quarantine — display "—")
//   txn.<col> / parties.* → not in scope for 3.2.B.1 editor
// ============================================================================

import type { TransactionSnapshot } from "../types";

export function resolveCurrentValue(
  snapshot: TransactionSnapshot | null,
  path: string
): unknown {
  if (!snapshot || !path) return null;

  if (path.startsWith("facts.")) {
    const key = path.slice("facts.".length);
    const fact = snapshot.facts?.[key];
    if (!fact) return null;
    // We intentionally return ONLY the value, not the wrapper state.
    // State is a separate concern surfaced by the drawer header.
    return (fact as { value?: unknown }).value ?? null;
  }

  if (path.startsWith("terms.")) {
    const termPath = path.slice("terms.".length);
    const v = readNested(snapshot.terms ?? {}, termPath);
    return v === undefined ? null : v;
  }

  // facts_hearsay and other prefixes intentionally return null in the
  // 3.2.B.1 editor. The drawer header surfaces statutory state separately.
  return null;
}

function readNested(root: unknown, path: string): unknown {
  let cur: unknown = root;
  for (const k of path.split(".")) {
    if (cur === null || cur === undefined) return null;
    if (typeof cur !== "object") return null;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur;
}
