// ============================================================================
// Slice 2 Phase 3B-3.5 · useSigningPackageStatus hook
// ============================================================================
// Thin client hook wrapping fetchSigningPackageStatus. Returns a stable
// discriminated union so callers can render the correct experience for
// each result kind (200, 401, 403, 404, 502, invalid_response,
// unexpected_status) without deriving state from a plain error string.
// ============================================================================

"use client";

import { useEffect, useState } from "react";

import {
  fetchSigningPackageStatus,
  type FetchPackageStatusResult,
} from "@/lib/signing/package-status-client";

export type UseSigningPackageStatusState =
  | { readonly phase: "loading" }
  | { readonly phase: "ready"; readonly result: FetchPackageStatusResult };

export function useSigningPackageStatus(packageId: string | undefined): UseSigningPackageStatusState {
  const [state, setState] = useState<UseSigningPackageStatusState>({ phase: "loading" });

  useEffect(() => {
    if (!packageId) {
      setState({ phase: "ready", result: { ok: false, kind: "invalid_response", httpStatus: 400 } });
      return;
    }
    let cancelled = false;
    setState({ phase: "loading" });
    fetchSigningPackageStatus(packageId).then((result) => {
      if (!cancelled) setState({ phase: "ready", result });
    });
    return () => {
      cancelled = true;
    };
  }, [packageId]);

  return state;
}
