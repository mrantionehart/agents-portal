// ============================================================================
// AGENT PORTAL 3.0 — Workflow 3.1 — Compliance tab
// ============================================================================
// Placeholder. The unified `compliance-summary` endpoint ships in
// Workflow 3.3 (Vault-side). It will return: compliance_score (0–100),
// ready_for_closing, ready_for_commission, blockers[] (kind + severity
// + reason), required/optional form roll-ups, party_attestations,
// broker_review object, envelope_status, violations[].
//
// READ-ONLY. No close-transaction, no broker-approve, no override.
// ============================================================================

import { ShieldCheck } from "lucide-react";

export default function ComplianceTab() {
  return (
    <section className="rounded-lg border border-[#1a1a2e] bg-[#11111a] p-5">
      <h2 className="text-xs uppercase tracking-wider text-[#71717A] mb-3 inline-flex items-center gap-1.5">
        <ShieldCheck className="h-3.5 w-3.5 text-[#C9A84C]" />
        Compliance
      </h2>

      <div className="rounded-md border border-[#1a1a2e] bg-[#0b0b10] py-8 px-5">
        <p className="text-sm text-[#A1A1AA] mb-3">
          Compliance review surface arrives with Workflow 3.3. The Vault
          rule engine + missing-field aggregator + party-attestation
          ledger already exist; this tab will mount the unified
          <code className="text-[#E8D5A3] mx-1">compliance-summary</code>
          endpoint when it ships.
        </p>
        <p className="text-xs text-[#71717A] mb-2">When live, this tab will show:</p>
        <ul className="text-xs text-[#A1A1AA] space-y-1 list-disc list-inside">
          <li>Required Florida forms (per rule engine)</li>
          <li>Optional Florida forms</li>
          <li>Missing forms + missing required fields</li>
          <li>Blocked fields (statutory attestation pending)</li>
          <li>Party attestations table (per role)</li>
          <li>Broker review status + last action</li>
          <li>Envelope status (sent / signed / voided)</li>
          <li>Ready-for-closing badge</li>
          <li>Commission-eligibility badge</li>
          <li>Broker notes (read-only here; broker writes in Vault)</li>
          <li>Violations list</li>
        </ul>
      </div>

      <p className="mt-3 text-[10px] text-[#71717A] leading-relaxed">
        Read-only placeholder. No approval or override actions are issued
        from the Agent Portal — all gates live in Vault.
      </p>
    </section>
  );
}
