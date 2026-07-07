// ============================================================================
// PAPERWORK.3B — API client for deployed PAPERWORK.3A routes
// ============================================================================
// Six functions wrapping the agent-facing paperwork routes. All calls go
// through authFetch (lib/supabase.ts) which handles Bearer + session-race +
// 8s timeout. Broker-only routes (approve, reject, promote, recompute) are
// intentionally NOT exposed here — those belong in PAPERWORK.3C.

import { authFetch } from "./supabase";
import { VAULT_API_URL } from "./vault-client";
import type {
  TransactionRow,
  TransactionPartyRow,
  FormRequirement,
  FormInstanceRow,
  MissingFieldsReport,
  TransactionFact,
  TransactionFactState,
  TransactionIntelligence,
  TransactionTerms,
} from "./paperworkTypes";

const PAPERWORK_BASE = `${VAULT_API_URL}/paperwork`;

class PaperworkApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function unwrap<T>(res: Response): Promise<T> {
  const text = await res.text();
  const body = text ? (() => { try { return JSON.parse(text); } catch { return text; } })() : null;
  if (!res.ok) {
    const msg =
      (typeof body === "object" && body && "error" in body && typeof (body as { error: unknown }).error === "string"
        ? (body as { error: string }).error
        : null) || `Request failed: ${res.status}`;
    throw new PaperworkApiError(res.status, msg, body);
  }
  return body as T;
}

export interface TransactionReviewResponse {
  transaction: TransactionRow;
  parties: TransactionPartyRow[];
}

export interface TransactionFormsResponse {
  requirements: FormRequirement[];
  instances: FormInstanceRow[];
}

export interface PatchFactResponse {
  fact: TransactionFact;
  intelligence: TransactionIntelligence;
  affected_form_ids: string[];
}

export interface PatchTermResponse {
  terms: TransactionTerms;
  intelligence: TransactionIntelligence;
  affected_form_ids: string[];
}

export interface SubmitReviewResponse {
  transaction: TransactionRow;
}

export const paperworkApi = {
  async getTransactionReview(transactionId: string): Promise<TransactionReviewResponse> {
    const res = await authFetch(`${PAPERWORK_BASE}/transactions/${transactionId}`);
    return unwrap<TransactionReviewResponse>(res);
  },

  async getTransactionForms(transactionId: string): Promise<TransactionFormsResponse> {
    const res = await authFetch(`${PAPERWORK_BASE}/transactions/${transactionId}/forms`);
    return unwrap<TransactionFormsResponse>(res);
  },

  async getTransactionMissingFields(transactionId: string): Promise<MissingFieldsReport> {
    const res = await authFetch(`${PAPERWORK_BASE}/transactions/${transactionId}/missing-fields`);
    return unwrap<MissingFieldsReport>(res);
  },

  async patchTransactionFact(
    transactionId: string,
    body: { key: string; value: unknown; new_state: TransactionFactState; note?: string }
  ): Promise<PatchFactResponse> {
    const res = await authFetch(`${PAPERWORK_BASE}/transactions/${transactionId}/facts`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return unwrap<PatchFactResponse>(res);
  },

  async patchTransactionTerm(
    transactionId: string,
    body: { path: string; value: unknown }
  ): Promise<PatchTermResponse> {
    const res = await authFetch(`${PAPERWORK_BASE}/transactions/${transactionId}/terms`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return unwrap<PatchTermResponse>(res);
  },

  async patchTransactionParty(
    transactionId: string,
    body: {
      field: "name" | "email" | "phone" | "mailing_address";
      value: unknown;
      role?: string;
      party_id?: string;
    }
  ): Promise<{ party: unknown; forms_recomputed: boolean; transaction_id: string }> {
    const res = await authFetch(
      `${PAPERWORK_BASE}/agents/transactions/${transactionId}/parties`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
    return unwrap<{ party: unknown; forms_recomputed: boolean; transaction_id: string }>(res);
  },

  async submitTransactionForReview(transactionId: string): Promise<SubmitReviewResponse> {
    const res = await authFetch(`${PAPERWORK_BASE}/transactions/${transactionId}/submit-review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    return unwrap<SubmitReviewResponse>(res);
  },
};

export { PaperworkApiError };
