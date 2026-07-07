// ============================================================================
// TRANSACTION OS 3.3B.3B — ReviewStep
// ============================================================================
// Read-only summary of everything collected in the WizardSession. NO create
// button, NO API, NO orchestration — creation is 3.3B.3D. Purely displays the
// session so the agent can confirm before the (future) Create step.
// ============================================================================

"use client";

import {
  isLeaseType,
  transactionTypeLabel,
} from "./transaction-types";
import { partyRoleLabel } from "./party-roles";
import type { WizardSession } from "./wizard-session";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="text-xs text-[#71717A]">{label}</span>
      <span className="text-sm text-[#F1F1F3] text-right">{value || "—"}</span>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-[#1a1a2e] bg-[#0b0b10] p-4">
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#A1A1AA]">
        {title}
      </h3>
      <div className="divide-y divide-[#1a1a2e]">{children}</div>
    </section>
  );
}

export interface ReviewStepProps {
  session: WizardSession;
}

export default function ReviewStep({ session }: ReviewStepProps) {
  const { property, parties, dates } = session;
  const lease = isLeaseType(session.transaction_type);
  const propertyLine = [property.city, property.state, property.zip]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="space-y-4" data-testid="wizard-review">
      <Section title="Transaction Type">
        <Row
          label="Type"
          value={transactionTypeLabel(session.transaction_type)}
        />
      </Section>

      <Section title="Property">
        <Row label="Address" value={property.address ?? ""} />
        <Row label="City / State / ZIP" value={propertyLine} />
        <Row label="Year Built" value={property.year_built ?? ""} />
        <Row label="HOA" value={property.has_hoa ? "Yes" : "No"} />
      </Section>

      <Section title="Important Dates">
        {lease ? (
          <>
            <Row label="Lease Start" value={dates.lease_start ?? ""} />
            <Row label="Lease End" value={dates.lease_end ?? ""} />
          </>
        ) : (
          <>
            <Row label="Contract Date" value={dates.contract_date ?? ""} />
            <Row label="Closing Date" value={dates.closing_date ?? ""} />
          </>
        )}
      </Section>

      <Section title={`Clients & Parties (${parties.length})`}>
        {parties.length === 0 ? (
          <Row label="Parties" value="" />
        ) : (
          parties.map((p, i) => (
            <Row
              key={i}
              label={partyRoleLabel(p.role) || `Party ${i + 1}`}
              value={
                [p.name || p.company, p.email].filter(Boolean).join(" · ") +
                (p.signature_required !== false ? " · signs" : "")
              }
            />
          ))
        )}
      </Section>
    </div>
  );
}
