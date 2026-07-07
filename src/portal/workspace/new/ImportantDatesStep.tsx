// ============================================================================
// TRANSACTION OS 3.3B.3B — ImportantDatesStep
// ============================================================================
// Contract / closing dates for most types; lease start / end for leases.
// Fields shown/hidden by the transaction type. Pure UI — writes patches to
// WizardSession.dates. No API, no persistence, no validation (real cross-date
// rules arrive in 3.3B.3C).
// ============================================================================

"use client";

import { DateField } from "./fields";
import { isLeaseType } from "./transaction-types";
import type { WizardDatesDraft } from "./wizard-session";

export interface ImportantDatesStepProps {
  dates: WizardDatesDraft;
  transactionType: string | null;
  onChange: (patch: Partial<WizardDatesDraft>) => void;
  errors?: {
    contract_date?: string;
    closing_date?: string;
    lease_start?: string;
    lease_end?: string;
  };
}

export default function ImportantDatesStep({
  dates,
  transactionType,
  onChange,
  errors,
}: ImportantDatesStepProps) {
  const lease = isLeaseType(transactionType);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {lease ? (
        <>
          <DateField
            label="Lease Start"
            value={dates.lease_start ?? ""}
            onChange={(v) => onChange({ lease_start: v })}
            error={errors?.lease_start}
          />
          <DateField
            label="Lease End"
            value={dates.lease_end ?? ""}
            onChange={(v) => onChange({ lease_end: v })}
            error={errors?.lease_end}
          />
        </>
      ) : (
        <>
          <DateField
            label="Contract Date"
            value={dates.contract_date ?? ""}
            onChange={(v) => onChange({ contract_date: v })}
            error={errors?.contract_date}
          />
          <DateField
            label="Closing Date"
            value={dates.closing_date ?? ""}
            onChange={(v) => onChange({ closing_date: v })}
            error={errors?.closing_date}
          />
        </>
      )}
    </div>
  );
}
