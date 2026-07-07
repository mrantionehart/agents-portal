// ============================================================================
// TRANSACTION OS 3.3B.3B — TransactionTypeStep
// ============================================================================
// Selectable card grid over the 7 canonical transaction types. Writes the
// chosen canonical id to WizardSession.transaction_type. Pure UI — no API,
// no routing, no persistence, no validation.
// ============================================================================

"use client";

import { Check } from "lucide-react";

import {
  TRANSACTION_TYPE_OPTIONS,
  type CanonicalTransactionType,
} from "./transaction-types";

export interface TransactionTypeStepProps {
  value: string | null;
  onSelect: (type: CanonicalTransactionType) => void;
}

export default function TransactionTypeStep({
  value,
  onSelect,
}: TransactionTypeStepProps) {
  return (
    <fieldset>
      <legend className="text-sm font-medium text-[#E4E4E7] mb-3">
        What kind of transaction is this?
      </legend>
      <div
        role="radiogroup"
        aria-label="Transaction type"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
      >
        {TRANSACTION_TYPE_OPTIONS.map((t) => {
          const Icon = t.icon;
          const selected = value === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onSelect(t.id)}
              className={`
                flex items-start gap-3 rounded-xl border p-4 text-left transition-colors duration-[180ms]
                ${selected
                  ? "border-[#C9A84C]/50 bg-[#C9A84C]/10"
                  : "border-[#1a1a2e] bg-[#0b0b10] hover:border-[#252538] hover:bg-white/[0.02]"
                }
              `}
            >
              <span
                className={`
                  mt-0.5 inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg
                  ${selected ? "bg-[#C9A84C]/20 text-[#E8D5A3]" : "bg-white/[0.04] text-[#A1A1AA]"}
                `}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5">
                  <span
                    className={`text-sm font-semibold ${selected ? "text-[#F1F1F3]" : "text-[#E4E4E7]"}`}
                  >
                    {t.label}
                  </span>
                  {selected && <Check className="h-3.5 w-3.5 text-[#C9A84C]" />}
                </span>
                <span className="mt-0.5 block text-xs text-[#71717A]">
                  {t.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
