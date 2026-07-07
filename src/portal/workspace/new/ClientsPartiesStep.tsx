// ============================================================================
// TRANSACTION OS 3.3B.3B — ClientsPartiesStep
// ============================================================================
// Add / edit / remove party rows. Roles restricted to the 14 existing
// transaction_parties roles. Each row: role, name, company, email, phone,
// signature-required. Pure UI — writes the whole array back via onChange. No
// API, no persistence (materialization into real transaction_parties is
// 3.3B.3D via the agent party endpoint).
// ============================================================================

"use client";

import { Plus, Trash2, Users } from "lucide-react";

import { TextField, SelectField, CheckboxField } from "./fields";
import { PARTY_ROLE_OPTIONS } from "./party-roles";
import type { WizardPartyDraft } from "./wizard-session";

export interface ClientsPartiesStepProps {
  parties: WizardPartyDraft[];
  onChange: (parties: WizardPartyDraft[]) => void;
}

const EMPTY_PARTY: WizardPartyDraft = { signature_required: true };

export default function ClientsPartiesStep({
  parties,
  onChange,
}: ClientsPartiesStepProps) {
  const addParty = () => onChange([...parties, { ...EMPTY_PARTY }]);

  const updateParty = (index: number, patch: Partial<WizardPartyDraft>) =>
    onChange(parties.map((p, i) => (i === index ? { ...p, ...patch } : p)));

  const removeParty = (index: number) =>
    onChange(parties.filter((_, i) => i !== index));

  return (
    <div className="space-y-4">
      {parties.length === 0 && (
        <div className="rounded-lg border border-dashed border-[#252538] py-8 text-center">
          <Users className="mx-auto h-6 w-6 text-[#52525b]" />
          <p className="mt-2 text-sm text-[#A1A1AA]">No parties added yet</p>
          <p className="text-xs text-[#71717A]">
            Add the buyer, seller, or other parties to this transaction.
          </p>
        </div>
      )}

      {parties.map((party, i) => (
        <div
          key={i}
          className="rounded-lg border border-[#1a1a2e] bg-[#0b0b10] p-4"
          data-testid={`party-row-${i}`}
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-[#71717A]">
              Party {i + 1}
            </span>
            <button
              type="button"
              onClick={() => removeParty(i)}
              aria-label={`Remove party ${i + 1}`}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[#A1A1AA] hover:bg-red-500/10 hover:text-red-400 transition-colors duration-[180ms]"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove
            </button>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SelectField
                label="Role"
                value={party.role ?? ""}
                onChange={(v) => updateParty(i, { role: v })}
                options={PARTY_ROLE_OPTIONS.map((r) => ({ value: r.id, label: r.label }))}
                placeholder="Select a role…"
              />
              <TextField
                label="Name"
                value={party.name ?? ""}
                onChange={(v) => updateParty(i, { name: v })}
                placeholder="Full name"
              />
            </div>

            <TextField
              label="Company"
              value={party.company ?? ""}
              onChange={(v) => updateParty(i, { company: v })}
              placeholder="Company / organization (optional)"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TextField
                label="Email"
                type="email"
                value={party.email ?? ""}
                onChange={(v) => updateParty(i, { email: v })}
                placeholder="party@email.com"
              />
              <TextField
                label="Phone"
                type="tel"
                value={party.phone ?? ""}
                onChange={(v) => updateParty(i, { phone: v })}
                placeholder="(555) 123-4567"
              />
            </div>

            <CheckboxField
              label="Signature required"
              checked={party.signature_required !== false}
              onChange={(v) => updateParty(i, { signature_required: v })}
            />
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addParty}
        className="inline-flex items-center gap-1.5 rounded-md border border-[#C9A84C]/40 bg-[#C9A84C]/15 px-3 py-1.5 text-sm font-medium text-[#E8D5A3] hover:bg-[#C9A84C]/25 transition-colors duration-[180ms]"
      >
        <Plus className="h-4 w-4" />
        Add Party
      </button>
    </div>
  );
}
