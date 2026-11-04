// ============================================================================
// Matrix Simulator — Certification readiness (Agent Portal)
// ============================================================================
// INFORMATIONAL ONLY. Shows the learner's separate progress across the
// knowledge quiz and the three practical modules (A Rental / B Sales /
// C Maintenance), and whether full v2 certification is READY. It NEVER grants a
// credential — Vault issues solely on the quiz + all three broker-approved
// practicals, enforced server-side. This surface only reads status.
// ============================================================================

"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, CheckCircle2, Circle, GraduationCap } from "lucide-react";

import {
  getMatrixReadiness,
  MatrixApiError,
  type MatrixReadiness as Readiness,
} from "@/lib/matrix/vault-matrix-client";
import { matrixSimulatorEnabled } from "../_lib/matrix-flags";

const CARD = "rounded-lg border border-[#13231a] bg-[#0b0f0c]";

type Phase =
  | { kind: "loading" }
  | { kind: "no_access" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: Readiness };

function StatusRow({ done, label, detail }: { done: boolean; label: string; detail?: string }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-md border border-[#13231a] bg-[#060a07] p-3">
      <div className="flex items-center gap-2">
        {done ? (
          <CheckCircle2 className="h-4 w-4 text-[#4ade80]" aria-hidden="true" />
        ) : (
          <Circle className="h-4 w-4 text-[#6b8577]" aria-hidden="true" />
        )}
        <span className="text-sm text-[#E6F5EC]">{label}</span>
      </div>
      <span
        className={`text-xs ${done ? "text-[#4ade80]" : "text-[#9db3a6]"}`}
        data-status={done ? "complete" : "pending"}
      >
        {detail ?? (done ? "Complete" : "Pending")}
      </span>
    </li>
  );
}

export function MatrixReadiness() {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });

  const load = useCallback(async () => {
    setPhase({ kind: "loading" });
    try {
      const data = await getMatrixReadiness();
      setPhase({ kind: "ready", data });
    } catch (e) {
      if (e instanceof MatrixApiError && (e as { status?: number }).status === 404) {
        setPhase({ kind: "no_access" });
        return;
      }
      setPhase({ kind: "error", message: "Could not load your certification progress." });
    }
  }, []);

  useEffect(() => {
    if (!matrixSimulatorEnabled()) return;
    void load();
  }, [load]);

  if (!matrixSimulatorEnabled()) {
    return (
      <div className={`${CARD} p-6`} data-matrix-readiness-disabled>
        <p className="text-sm text-[#9db3a6]">Certification progress is coming soon.</p>
      </div>
    );
  }
  if (phase.kind === "loading") {
    return (
      <div className={`${CARD} flex items-center justify-center p-12`} data-matrix-readiness-loading>
        <Loader2 className="h-5 w-5 animate-spin text-[#22c55e]" aria-hidden="true" />
      </div>
    );
  }
  if (phase.kind === "no_access") {
    return (
      <div className={`${CARD} p-6`} role="alert" data-matrix-readiness-no-access>
        <p className="text-sm text-[#9db3a6]">
          You&apos;re not enrolled in the Matrix certification. Ask your broker to enroll you.
        </p>
      </div>
    );
  }
  if (phase.kind === "error") {
    return (
      <div className={`${CARD} p-6`} role="alert">
        <p className="text-sm text-[#f87171]">{phase.message}</p>
      </div>
    );
  }

  const d = phase.data;
  const missing: string[] = [];
  if (!d.knowledgeQuizPassed) missing.push("Knowledge Quiz");
  for (const m of d.modules) if (!m.approved) missing.push(m.label);

  return (
    <div className="space-y-5" data-matrix-readiness>
      <header className={`${CARD} p-5`}>
        <div className="flex items-center gap-2 text-[#4ade80]">
          <GraduationCap className="h-4 w-4" aria-hidden="true" />
          <span className="text-[11px] uppercase tracking-wide">Matrix Certification · v{d.certificationVersion}</span>
        </div>
        <h2 className="mt-1 text-lg font-semibold text-[#E6F5EC]">Your certification progress</h2>
        <p className="mt-1 text-xs text-[#9db3a6]">
          Full certification requires the knowledge quiz plus all three broker-approved practicals.
          Each is scored separately. This page tracks progress only — it does not grant certification.
        </p>
      </header>

      <ul className="space-y-2">
        <StatusRow done={d.knowledgeQuizPassed} label="Knowledge Quiz (≥85%, zero critical)" />
        {d.modules.map((m) => (
          <StatusRow
            key={m.module}
            done={m.approved}
            label={m.label}
            detail={
              m.approved
                ? `Approved${m.scorePct != null ? ` · ${m.scorePct}%` : ""}`
                : "Pending broker approval"
            }
          />
        ))}
      </ul>

      <div
        className={`rounded-lg border p-5 ${
          d.certificationReady
            ? "border-green-500/30 bg-green-500/10"
            : "border-amber-500/30 bg-amber-500/10"
        }`}
        data-matrix-readiness-overall={d.certificationReady ? "ready" : "not_ready"}
      >
        <div className="text-[11px] uppercase tracking-wide text-[#E6F5EC]">
          {d.certificationReady ? "✅ Ready for certification" : "⏳ Not yet ready"}
        </div>
        {d.certificationReady ? (
          <p className="mt-1 text-sm text-[#9db3a6]">
            All requirements met. Your Broker of Record finalizes certification — issuance is
            recorded by Vault, not here.
          </p>
        ) : (
          <p className="mt-1 text-sm text-[#9db3a6]" data-matrix-readiness-missing>
            Still needed: {missing.join(", ")}.
          </p>
        )}
      </div>

      {d.issuedCredential && (
        <div className={`${CARD} p-4`} data-matrix-readiness-credential>
          <p className="text-xs text-[#9db3a6]">
            Credential on file: v{d.issuedCredential.certificationVersion}, issued{" "}
            {new Date(d.issuedCredential.issuedAt).toLocaleDateString()}. Earlier-version credentials
            remain valid.
          </p>
        </div>
      )}
    </div>
  );
}
