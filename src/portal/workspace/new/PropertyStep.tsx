// ============================================================================
// TRANSACTION OS 3.3B.3B — PropertyStep
// ============================================================================
// Property details form: address, city, state, zip, year built, HOA. No
// address lookup / autocomplete yet (out of scope). Pure UI — writes patches
// to WizardSession.property via onChange. No API, no persistence.
// ============================================================================

"use client";

import { TextField, CheckboxField } from "./fields";
import type { WizardPropertyDraft } from "./wizard-session";

export interface PropertyStepProps {
  property: WizardPropertyDraft;
  onChange: (patch: Partial<WizardPropertyDraft>) => void;
}

export default function PropertyStep({ property, onChange }: PropertyStepProps) {
  return (
    <div className="space-y-4">
      <TextField
        label="Property Address"
        value={property.address ?? ""}
        onChange={(v) => onChange({ address: v })}
        placeholder="123 Main Street"
        required
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <TextField
          label="City"
          value={property.city ?? ""}
          onChange={(v) => onChange({ city: v })}
          placeholder="City"
        />
        <TextField
          label="State"
          value={property.state ?? ""}
          onChange={(v) => onChange({ state: v })}
          placeholder="FL"
        />
        <TextField
          label="ZIP"
          value={property.zip ?? ""}
          onChange={(v) => onChange({ zip: v })}
          placeholder="33101"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
        <TextField
          label="Year Built"
          type="number"
          value={property.year_built ?? ""}
          onChange={(v) => onChange({ year_built: v })}
          placeholder="1998"
        />
        <div className="pb-2.5">
          <CheckboxField
            label="Property has an HOA"
            checked={!!property.has_hoa}
            onChange={(v) => onChange({ has_hoa: v })}
          />
        </div>
      </div>
    </div>
  );
}
