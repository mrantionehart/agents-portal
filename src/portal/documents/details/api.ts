// ============================================================================
// AGENT PORTAL 3.0 — Workflow 3.2.A — Form detail drawer fetcher
// ============================================================================
// Server-only. Parallel-fetches the per-form detail from Vault. Three
// endpoints are queried; the broker-only two are SKIPPED when the
// caller is an agent (Vault would return 403). All errors degrade
// gracefully so one bad section does not collapse the whole drawer.
// ============================================================================

import "server-only";

import type {
  EnvelopeBundle,
  FormDetailBundle,
  MissingFieldsItem,
  MissingFieldsReport,
  TimelineEvent,
  TransactionSnapshot,
} from "./types";
import type { DocumentRow, RequirementRow } from "../types";
import {
  extractStatutoryFields,
  filterHistoryForFormInstance,
  filterMissingFieldsForForm,
  isBrokerTier,
} from "./helpers";
import { deriveAgentEditableFields } from "./edit/editable-fields";

const VAULT_API_URL = (
  process.env.NEXT_PUBLIC_VAULT_API_URL ?? "https://vault.hartfeltrealestate.com/api"
).replace(/\/$/, "");

export interface FetchFormDetailInput {
  accessToken: string;
  transactionId: string;
  /** form_instances row id, when the form is materialized. Used to
   *  scope the broker-only envelope + history requests. */
  formInstanceId: string | null;
  callerRole: string | null | undefined;
  /** The DocumentRow for the form being inspected — already loaded by
   *  the parent /forms fetch. */
  document: DocumentRow;
  /** The rule-engine RequirementRow for this form (already loaded with
   *  /forms). Used to derive the statutory-fields list. */
  requirement: RequirementRow | null;
}

export async function fetchFormDetail(
  input: FetchFormDetailInput
): Promise<FormDetailBundle> {
  const broker = isBrokerTier(input.callerRole);

  // Workflow 3.2.B.1 — snapshot is fetched for ALL callers (agent OR
  // broker) because the editor needs current values to seed inputs.
  // /paperwork/transactions/[id] is agent-allowed.
  const [missingResult, envelopeResult, historyResult, snapshotResult] =
    await Promise.all([
      safeFetchMissing(input),
      broker && input.formInstanceId
        ? safeFetchEnvelope(input.accessToken, input.formInstanceId)
        : Promise.resolve<SafeResult<EnvelopeBundle>>({ kind: "skip" }),
      broker
        ? safeFetchHistory(input.accessToken, input.transactionId)
        : Promise.resolve<SafeResult<TimelineEvent[]>>({ kind: "skip" }),
      safeFetchTransactionSnapshot(input.accessToken, input.transactionId),
    ]);

  const missingReport: MissingFieldsReport | null =
    missingResult.kind === "ok" ? missingResult.value : null;

  const missing: MissingFieldsItem[] = filterMissingFieldsForForm(
    missingReport,
    input.document.form_id
  );
  const statutory_fields = extractStatutoryFields(input.requirement, missingReport);

  const envelope: EnvelopeBundle | null =
    envelopeResult.kind === "ok" ? envelopeResult.value : null;

  const history: TimelineEvent[] | null =
    historyResult.kind === "ok"
      ? filterHistoryForFormInstance(historyResult.value, input.formInstanceId)
      : null;

  // Workflow 3.2.B.1 — derive agent-editable fields from the rule-engine
  // requirement. Pure server-side classification — no values mutated.
  const editable_fields = deriveAgentEditableFields(input.requirement);

  const snapshot: TransactionSnapshot | null =
    snapshotResult.kind === "ok" ? snapshotResult.value : null;

  return {
    missing,
    statutory_count_total: missingReport?.statutory_count ?? 0,
    statutory_fields,
    envelope,
    history,
    broker_only_gated: !broker,
    errors: {
      missing: missingResult.kind === "error" ? missingResult.message : null,
      envelope: envelopeResult.kind === "error" ? envelopeResult.message : null,
      history: historyResult.kind === "error" ? historyResult.message : null,
      snapshot: snapshotResult.kind === "error" ? snapshotResult.message : null,
    },
    editable_fields,
    snapshot,
  };
}

// ── Per-endpoint fetchers ────────────────────────────────────────────

type SafeResult<T> =
  | { kind: "ok"; value: T }
  | { kind: "error"; status: number; message: string }
  | { kind: "skip" };

async function safeFetchMissing(
  input: FetchFormDetailInput
): Promise<SafeResult<MissingFieldsReport>> {
  try {
    const res = await fetch(
      `${VAULT_API_URL}/paperwork/transactions/${input.transactionId}/missing-fields`,
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
      return { kind: "error", status: res.status, message: trimMessage(body) };
    }
    const body = (await res.json()) as MissingFieldsReport;
    return { kind: "ok", value: body };
  } catch (err) {
    return {
      kind: "error",
      status: 500,
      message: err instanceof Error ? err.message : "Network error",
    };
  }
}

async function safeFetchEnvelope(
  accessToken: string,
  formInstanceId: string
): Promise<SafeResult<EnvelopeBundle>> {
  try {
    const res = await fetch(
      `${VAULT_API_URL}/paperwork/form-instances/${formInstanceId}/envelope`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      }
    );
    if (res.status === 404) {
      // Form instance has no envelope yet — not an error.
      return { kind: "ok", value: { envelope: null, signed_url: null, history: [] } };
    }
    if (!res.ok) {
      const body = await res.text().catch(() => res.statusText);
      return { kind: "error", status: res.status, message: trimMessage(body) };
    }
    const body = (await res.json()) as EnvelopeBundle;
    return { kind: "ok", value: body };
  } catch (err) {
    return {
      kind: "error",
      status: 500,
      message: err instanceof Error ? err.message : "Network error",
    };
  }
}

async function safeFetchTransactionSnapshot(
  accessToken: string,
  transactionId: string
): Promise<SafeResult<TransactionSnapshot>> {
  try {
    const res = await fetch(
      `${VAULT_API_URL}/paperwork/transactions/${transactionId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      }
    );
    if (!res.ok) {
      const body = await res.text().catch(() => res.statusText);
      return { kind: "error", status: res.status, message: trimMessage(body) };
    }
    const body = (await res.json()) as {
      transaction?: {
        facts?: Record<string, unknown> | null;
        terms?: Record<string, unknown> | null;
        broker_review_status?: string | null;
      };
      parties?: Array<Record<string, unknown>> | null;
    };
    const txn = body?.transaction ?? null;
    return {
      kind: "ok",
      value: {
        facts: (txn?.facts as Record<string, unknown> | null) ?? null,
        terms: (txn?.terms as Record<string, unknown> | null) ?? null,
        parties: (body?.parties ?? null) as TransactionSnapshot["parties"],
        broker_review_status: (txn?.broker_review_status as TransactionSnapshot["broker_review_status"]) ?? null,
      },
    };
  } catch (err) {
    return {
      kind: "error",
      status: 500,
      message: err instanceof Error ? err.message : "Network error",
    };
  }
}

async function safeFetchHistory(
  accessToken: string,
  transactionId: string
): Promise<SafeResult<TimelineEvent[]>> {
  try {
    const res = await fetch(
      `${VAULT_API_URL}/paperwork/transactions/${transactionId}/history?limit=50`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      }
    );
    if (!res.ok) {
      const body = await res.text().catch(() => res.statusText);
      return { kind: "error", status: res.status, message: trimMessage(body) };
    }
    const body = (await res.json()) as {
      events?: TimelineEvent[];
    };
    return { kind: "ok", value: Array.isArray(body?.events) ? body.events : [] };
  } catch (err) {
    return {
      kind: "error",
      status: 500,
      message: err instanceof Error ? err.message : "Network error",
    };
  }
}

function trimMessage(body: string): string {
  if (typeof body !== "string") return "";
  const stripped = body.trim().replace(/\s+/g, " ");
  return stripped.length > 240 ? stripped.slice(0, 237) + "…" : stripped;
}
