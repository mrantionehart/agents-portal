// ============================================================================
// PAPERWORK.3B — useTransactionReview orchestrator hook
// ============================================================================
// Promise.allSettled across the 3 GETs so a partial failure (e.g. forms 5xx)
// doesn't blank the whole page. Auto-refetch transaction + missing-fields
// after every successful PATCH (cheap; keeps badges fresh).

"use client";

import { useCallback, useEffect, useState } from "react";
import { paperworkApi, PaperworkApiError } from "../paperworkApi";
import type {
  TransactionRow,
  TransactionPartyRow,
  FormRequirement,
  FormInstanceRow,
  MissingFieldsReport,
  TransactionFactState,
} from "../paperworkTypes";

type SectionStatus = "idle" | "loading" | "ready" | "error";

interface State {
  transaction: TransactionRow | null;
  parties: TransactionPartyRow[];
  requirements: FormRequirement[];
  instances: FormInstanceRow[];
  missingFields: MissingFieldsReport | null;

  status: {
    transaction: SectionStatus;
    forms: SectionStatus;
    missingFields: SectionStatus;
  };
  errors: {
    transaction?: string;
    forms?: string;
    missingFields?: string;
  };

  // Auth + not-found state — distinct so the orchestrator can redirect
  notFound: boolean;
  unauthorized: boolean;

  // PATCH state
  patchError: string | null;
  isSubmitting: boolean;
}

const initialState: State = {
  transaction: null,
  parties: [],
  requirements: [],
  instances: [],
  missingFields: null,
  status: { transaction: "idle", forms: "idle", missingFields: "idle" },
  errors: {},
  notFound: false,
  unauthorized: false,
  patchError: null,
  isSubmitting: false,
};

export function useTransactionReview(transactionId: string | null) {
  const [state, setState] = useState<State>(initialState);

  const fetchTransaction = useCallback(async (txId: string) => {
    setState((s) => ({ ...s, status: { ...s.status, transaction: "loading" }, errors: { ...s.errors, transaction: undefined } }));
    try {
      const { transaction, parties } = await paperworkApi.getTransactionReview(txId);
      setState((s) => ({
        ...s,
        transaction,
        parties,
        status: { ...s.status, transaction: "ready" },
      }));
    } catch (err) {
      handleError(err, "transaction");
    }
  }, []);

  const fetchForms = useCallback(async (txId: string) => {
    setState((s) => ({ ...s, status: { ...s.status, forms: "loading" }, errors: { ...s.errors, forms: undefined } }));
    try {
      const { requirements, instances } = await paperworkApi.getTransactionForms(txId);
      setState((s) => ({
        ...s,
        requirements,
        instances,
        status: { ...s.status, forms: "ready" },
      }));
    } catch (err) {
      handleError(err, "forms");
    }
  }, []);

  const fetchMissing = useCallback(async (txId: string) => {
    setState((s) => ({ ...s, status: { ...s.status, missingFields: "loading" }, errors: { ...s.errors, missingFields: undefined } }));
    try {
      const report = await paperworkApi.getTransactionMissingFields(txId);
      setState((s) => ({
        ...s,
        missingFields: report,
        status: { ...s.status, missingFields: "ready" },
      }));
    } catch (err) {
      handleError(err, "missingFields");
    }
  }, []);

  function handleError(err: unknown, key: "transaction" | "forms" | "missingFields") {
    const status = err instanceof PaperworkApiError ? err.status : 0;
    const message = err instanceof Error ? err.message : "Unknown error";
    setState((s) => ({
      ...s,
      status: { ...s.status, [key]: "error" as const },
      errors: { ...s.errors, [key]: message },
      notFound: s.notFound || status === 404,
      unauthorized: s.unauthorized || status === 401,
    }));
  }

  // Initial concurrent fetch on mount.
  useEffect(() => {
    if (!transactionId) return;
    void Promise.allSettled([
      fetchTransaction(transactionId),
      fetchForms(transactionId),
      fetchMissing(transactionId),
    ]);
    // Intentionally re-run only when transactionId changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactionId]);

  // ── Mutation helpers ──────────────────────────────────────────────────

  const refetchSection = useCallback(
    async (section: "transaction" | "forms" | "missingFields") => {
      if (!transactionId) return;
      if (section === "transaction") await fetchTransaction(transactionId);
      else if (section === "forms") await fetchForms(transactionId);
      else if (section === "missingFields") await fetchMissing(transactionId);
    },
    [transactionId, fetchTransaction, fetchForms, fetchMissing]
  );

  const refetchAll = useCallback(async () => {
    if (!transactionId) return;
    await Promise.allSettled([
      fetchTransaction(transactionId),
      fetchForms(transactionId),
      fetchMissing(transactionId),
    ]);
  }, [transactionId, fetchTransaction, fetchForms, fetchMissing]);

  const patchFact = useCallback(
    async (key: string, value: unknown, new_state: TransactionFactState, note?: string) => {
      if (!transactionId) return;
      setState((s) => ({ ...s, patchError: null }));
      try {
        await paperworkApi.patchTransactionFact(transactionId, { key, value, new_state, note });
        // Refetch transaction + missing-fields after success (intelligence and
        // missing list may have changed; forms instances may have flipped status).
        await Promise.allSettled([
          fetchTransaction(transactionId),
          fetchForms(transactionId),
          fetchMissing(transactionId),
        ]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Patch failed";
        setState((s) => ({ ...s, patchError: msg }));
        throw err;
      }
    },
    [transactionId, fetchTransaction, fetchForms, fetchMissing]
  );

  const patchTerm = useCallback(
    async (path: string, value: unknown) => {
      if (!transactionId) return;
      setState((s) => ({ ...s, patchError: null }));
      try {
        await paperworkApi.patchTransactionTerm(transactionId, { path, value });
        await Promise.allSettled([
          fetchTransaction(transactionId),
          fetchForms(transactionId),
          fetchMissing(transactionId),
        ]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Patch failed";
        setState((s) => ({ ...s, patchError: msg }));
        throw err;
      }
    },
    [transactionId, fetchTransaction, fetchForms, fetchMissing]
  );

  const submitForReview = useCallback(async () => {
    if (!transactionId) return;
    setState((s) => ({ ...s, isSubmitting: true, patchError: null }));
    try {
      const { transaction } = await paperworkApi.submitTransactionForReview(transactionId);
      setState((s) => ({ ...s, transaction, isSubmitting: false }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Submit failed";
      setState((s) => ({ ...s, patchError: msg, isSubmitting: false }));
      throw err;
    }
  }, [transactionId]);

  const isLoading =
    state.status.transaction === "loading" ||
    state.status.forms === "loading" ||
    state.status.missingFields === "loading";

  return {
    ...state,
    isLoading,
    refetchSection,
    refetchAll,
    patchFact,
    patchTerm,
    submitForReview,
  };
}
