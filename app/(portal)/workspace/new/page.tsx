// ============================================================================
// TRANSACTION OS 3.3B.3A — /workspace/new (Transaction Wizard entry)
// ============================================================================
// The Agent Transaction Wizard's route. Lives inside the (portal) route group,
// so it inherits the Sidebar / TopBar / CommandBar shell from
// app/(portal)/layout.tsx automatically. This page is a thin wrapper: it
// renders the client WizardShell inside a Suspense boundary (required because
// the shell reads `?step=` via useSearchParams).
//
// The legacy single-page /transactions/new form is left UNTOUCHED. No API,
// no data fetching here.
// ============================================================================

import { Suspense } from "react";

import WizardShell from "@/src/portal/workspace/new/WizardShell";

export const dynamic = "force-dynamic";

export default function NewTransactionWizardPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-[760px] mx-auto py-16 text-center text-sm text-[#71717A]">
          Loading…
        </div>
      }
    >
      <WizardShell />
    </Suspense>
  );
}
