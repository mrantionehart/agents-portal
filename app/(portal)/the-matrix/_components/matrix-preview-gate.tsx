// ============================================================================
// Matrix broker-preview gate (client)
// ============================================================================
// The Matrix broker preview (?preview=1) is for broker-tier users only. The
// HARD boundary is server-side — the Vault /matrix-sim/preview/* endpoints are
// gateCaller({ requireBrokerTier:true }), so a non-broker is refused there and
// no answer key can leak. This client gate adds a CLEAN denial so an agent who
// reaches the preview URL sees "broker only" instead of a simulator that would
// only 403. It grants nothing on its own.
"use client";

import { type ReactNode } from "react";
import { ShieldAlert, Loader2 } from "lucide-react";

import { useAuth } from "../../../providers";
import { isBrokerTier } from "@/src/portal/nav-config";

const CARD = "rounded-lg border border-[#13231a] bg-[#0b0f0c]";

export function MatrixPreviewGate({ children }: { children: ReactNode }) {
  const { role, loading } = useAuth();

  if (loading) {
    return (
      <div className={`${CARD} flex items-center gap-3 p-6`} data-testid="matrix-preview-gate-loading">
        <Loader2 className="h-5 w-5 animate-spin text-[#22c55e]" aria-hidden="true" />
        <p className="text-sm text-[#9db3a6]">Checking access…</p>
      </div>
    );
  }

  if (!isBrokerTier(role)) {
    return (
      <div className={`${CARD} p-6`} role="alert" data-testid="matrix-preview-denied">
        <div className="flex items-center gap-2 text-amber-300">
          <ShieldAlert className="h-5 w-5" aria-hidden="true" />
          <h2 className="text-base font-semibold text-[#E6F5EC]">Broker preview is broker-only</h2>
        </div>
        <p className="mt-2 text-sm text-[#9db3a6]">
          This write-nothing preview of the Matrix quiz and practicals is available to brokers,
          admins and office managers. To practise the Matrix yourself, open it from the Matrix
          Simulator in your own portal.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
