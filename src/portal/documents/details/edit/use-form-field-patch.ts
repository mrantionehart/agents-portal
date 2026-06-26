"use client";

// ============================================================================
// AGENT PORTAL 3.0 — Workflow 3.2.B.1 — Client hook: patch one field
// ============================================================================
// Thin wrapper around the existing paperworkApi.patchTransactionFact /
// patchTransactionTerm. On success, calls router.refresh() so the
// server-rendered drawer re-hydrates with fresh data (new fact value,
// new missing-fields list, new form status). No optimistic UI in
// 3.2.B.1 — the next paint shows the saved value.
// ============================================================================

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

import { paperworkApi } from "@/lib/paperworkApi";
import type { EditableField } from "../types";

export interface UseFormFieldPatchOptions {
  transactionId: string;
}

export interface PatchSubmission {
  field: EditableField;
  value: unknown;
}

export interface UseFormFieldPatchReturn {
  submit: (input: PatchSubmission) => Promise<void>;
  /** Whether ANY field is currently saving. */
  saving: boolean;
  /** True while React is replaying the route refresh after a PATCH. */
  refreshing: boolean;
  /** The path of the most-recently-saving field; null when idle. */
  pendingPath: string | null;
}

export function useFormFieldPatch(
  opts: UseFormFieldPatchOptions
): UseFormFieldPatchReturn {
  const router = useRouter();
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [refreshing, startTransition] = useTransition();

  const submit = useCallback(
    async ({ field, value }: PatchSubmission) => {
      setPendingPath(field.transaction_path);
      try {
        if (field.endpoint === "facts") {
          if (!field.key) throw new Error("Editable field missing fact key.");
          await paperworkApi.patchTransactionFact(opts.transactionId, {
            key: field.key,
            value,
            new_state: "entered",
          });
        } else if (field.endpoint === "terms") {
          if (!field.termPath) throw new Error("Editable field missing terms path.");
          await paperworkApi.patchTransactionTerm(opts.transactionId, {
            path: field.termPath,
            value,
          });
        } else {
          throw new Error(`Unknown editable endpoint: ${field.endpoint}`);
        }
        // Refresh the server component tree so the drawer re-hydrates
        // with the new value + recomputed missing-fields + form status.
        startTransition(() => {
          router.refresh();
        });
      } finally {
        setPendingPath(null);
      }
    },
    [opts.transactionId, router]
  );

  return {
    submit,
    saving: pendingPath !== null,
    refreshing,
    pendingPath,
  };
}
