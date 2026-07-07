// ============================================================================
// TRANSACTION OS 3.3B.3B — Wizard field primitives
// ============================================================================
// Small local input primitives so the 5 step components don't copy-paste the
// canonical portal input class 20×. Presentational + controlled only — no
// state, no persistence, no validation. Improves on the legacy /transactions/new
// inputs with real label↔input association (htmlFor/id) and aria-required.
//
// Styling matches the proven portal input class; no design-token changes.
// ============================================================================

"use client";

import { useId } from "react";

/** The canonical portal text-input class (from app/transactions/new). */
export const WIZARD_INPUT_CLASS =
  "w-full px-4 py-2.5 border border-[#1a1a2e] rounded-lg text-sm bg-transparent text-[#F1F1F3] " +
  "placeholder:text-[#52525b] focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30 focus:border-[#C9A84C]/50";

const LABEL_CLASS = "block text-sm font-medium text-[#E4E4E7] mb-1.5";

function FieldLabel({
  htmlFor,
  children,
  required,
}: {
  htmlFor: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label htmlFor={htmlFor} className={LABEL_CLASS}>
      {children}
      {required && (
        <span className="text-[#C9A84C] ml-0.5" aria-hidden>
          *
        </span>
      )}
    </label>
  );
}

export interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  id?: string;
  type?: "text" | "email" | "tel" | "date" | "number";
  placeholder?: string;
  required?: boolean;
}

export function TextField({
  label,
  value,
  onChange,
  id,
  type = "text",
  placeholder,
  required,
}: TextFieldProps) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <div>
      <FieldLabel htmlFor={fieldId} required={required}>
        {label}
      </FieldLabel>
      <input
        id={fieldId}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-required={required || undefined}
        className={WIZARD_INPUT_CLASS}
      />
    </div>
  );
}

/** Date field — the same primitive with type=date (kept explicit for clarity). */
export function DateField(props: Omit<TextFieldProps, "type">) {
  return <TextField {...props} type="date" />;
}

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<SelectOption>;
  id?: string;
  placeholder?: string;
  required?: boolean;
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  id,
  placeholder,
  required,
}: SelectFieldProps) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <div>
      <FieldLabel htmlFor={fieldId} required={required}>
        {label}
      </FieldLabel>
      <select
        id={fieldId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-required={required || undefined}
        className={WIZARD_INPUT_CLASS}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export interface CheckboxFieldProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
}

export function CheckboxField({
  label,
  checked,
  onChange,
  id,
}: CheckboxFieldProps) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <label
      htmlFor={fieldId}
      className="inline-flex items-center gap-2 text-sm text-[#E4E4E7] cursor-pointer select-none"
    >
      <input
        id={fieldId}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-[#252538] bg-transparent accent-[#C9A84C]"
      />
      {label}
    </label>
  );
}
