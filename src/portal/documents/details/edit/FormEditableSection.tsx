"use client";

// ============================================================================
// AGENT PORTAL 3.0 — Workflow 3.2.B.1 — Per-form editable section
// ============================================================================
// Client island inside the otherwise server-rendered FormDetailDrawer.
// Renders one editable row per agent-allowed required-field. Each row
// has its own Save button; on success the route refreshes and the
// drawer rehydrates with the new value + recomputed missing-fields.
//
// LOCK CONDITIONS (rendered as read-only with hint):
//   • UPL L4 review lock — broker_review_status ∈ {submitted, approved}
//   • snapshot unavailable — current value cannot be seeded (degraded
//     network); editor disabled to avoid PATCHing with no baseline
// ============================================================================

import { useMemo, useState } from "react";
import { AlertCircle, Lock, Pencil, Save } from "lucide-react";

import type { EditableField, TransactionSnapshot } from "../types";
import { resolveCurrentValue } from "./value-resolver";
import { useFormFieldPatch } from "./use-form-field-patch";

const LOCKED_REVIEW_STATUSES: ReadonlySet<string> = new Set([
  "submitted",
  "approved",
]);

export interface FormEditableSectionProps {
  transactionId: string;
  editableFields: EditableField[];
  snapshot: TransactionSnapshot | null;
  snapshotError: string | null;
}

export default function FormEditableSection({
  transactionId,
  editableFields,
  snapshot,
  snapshotError,
}: FormEditableSectionProps) {
  const reviewLocked = useMemo(
    () => LOCKED_REVIEW_STATUSES.has(snapshot?.broker_review_status ?? ""),
    [snapshot?.broker_review_status]
  );
  const { submit, saving, pendingPath } = useFormFieldPatch({
    transactionId,
  });

  if (editableFields.length === 0) {
    return null;
  }

  return (
    <section>
      <h3 className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[#71717A] mb-2">
        <Pencil className="h-3 w-3" />
        Editable fields ({editableFields.length})
      </h3>

      {snapshotError && (
        <ErrorRow text={`Couldn't load current values (${snapshotError}). Editing disabled.`} />
      )}

      {reviewLocked && (
        <LockHint text="Review submitted — waiting on broker. Editing locked." />
      )}

      <ul className="space-y-2 text-sm">
        {editableFields.map((f) => {
          const current = resolveCurrentValue(snapshot, f.transaction_path);
          return (
            <EditableRow
              key={f.transaction_path}
              field={f}
              currentValue={current}
              disabled={
                reviewLocked ||
                Boolean(snapshotError) ||
                (saving && pendingPath !== f.transaction_path)
              }
              isSaving={saving && pendingPath === f.transaction_path}
              onSave={async (value) => {
                await submit({ field: f, value });
              }}
            />
          );
        })}
      </ul>

      <p className="mt-2 text-[10px] text-[#71717A] leading-relaxed">
        Vault enforces statutory, broker-only, and review-lock rules. Saves
        write to existing PATCH /facts and PATCH /terms endpoints — broker
        confirmation is still required for the full transaction package.
      </p>
    </section>
  );
}

// ── Atoms ────────────────────────────────────────────────────────────

interface EditableRowProps {
  field: EditableField;
  currentValue: unknown;
  disabled: boolean;
  isSaving: boolean;
  onSave: (value: unknown) => Promise<void>;
}

function EditableRow({
  field,
  currentValue,
  disabled,
  isSaving,
  onSave,
}: EditableRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<string>(formatForInput(currentValue, field.inputType));
  const [boolDraft, setBoolDraft] = useState<boolean>(currentValue === true);
  const [error, setError] = useState<string | null>(null);

  const handleStartEdit = () => {
    setDraft(formatForInput(currentValue, field.inputType));
    setBoolDraft(currentValue === true);
    setError(null);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setError(null);
  };

  const handleSave = async () => {
    setError(null);
    let next: unknown = draft;
    if (field.inputType === "number") {
      if (draft.trim() === "") {
        next = null;
      } else {
        const n = Number(draft);
        if (!Number.isFinite(n)) {
          setError("Must be a number");
          return;
        }
        next = n;
      }
    } else if (field.inputType === "boolean") {
      next = boolDraft;
    } else if (field.inputType === "date") {
      next = draft.trim() === "" ? null : draft;
    } else {
      next = draft;
    }
    try {
      await onSave(next);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  };

  return (
    <li className="rounded-md border border-[#1a1a2e] bg-[#0b0b10] px-3 py-2">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[#F1F1F3] text-xs font-medium">
            {field.label}
          </div>
          <div className="mt-0.5 text-[10px] text-[#71717A] font-mono truncate">
            {field.transaction_path}
          </div>

          {isEditing ? (
            <div className="mt-2 space-y-2">
              {field.inputType === "boolean" ? (
                <select
                  value={boolDraft ? "true" : "false"}
                  onChange={(e) => setBoolDraft(e.target.value === "true")}
                  disabled={isSaving}
                  className="w-full rounded-md border border-[#1a1a2e] bg-[#11111a] text-[#F1F1F3] text-xs px-2 py-1.5"
                >
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              ) : (
                <input
                  type={
                    field.inputType === "number"
                      ? "number"
                      : field.inputType === "date"
                      ? "date"
                      : "text"
                  }
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  disabled={isSaving}
                  inputMode={field.inputType === "number" ? "decimal" : undefined}
                  className="w-full rounded-md border border-[#1a1a2e] bg-[#11111a] text-[#F1F1F3] text-xs px-2 py-1.5"
                />
              )}
              {error && (
                <div className="text-[11px] text-rose-300 inline-flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> {error}
                </div>
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1 rounded-md border border-emerald-700/40 bg-emerald-900/30 text-emerald-200 text-[11px] px-2 py-1 hover:bg-emerald-900/50 disabled:opacity-60"
                >
                  <Save className="h-3 w-3" />
                  {isSaving ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="text-[11px] text-[#A1A1AA] hover:text-[#F1F1F3] disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-1 flex items-center justify-between gap-2">
              <div className="text-[#A1A1AA] text-xs">
                {formatForDisplay(currentValue, field.inputType)}
              </div>
              <button
                type="button"
                onClick={handleStartEdit}
                disabled={disabled}
                className="
                  shrink-0 inline-flex items-center gap-1 text-[11px]
                  text-[#E8D5A3] hover:underline disabled:opacity-60
                  disabled:hover:no-underline disabled:cursor-not-allowed
                "
                aria-label={`Edit ${field.label}`}
              >
                <Pencil className="h-3 w-3" />
                {disabled ? "Locked" : "Edit"}
              </button>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function LockHint({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-amber-700/40 bg-amber-900/20 px-3 py-2 text-[11px] text-amber-200 leading-relaxed inline-flex items-start gap-1.5 mb-2">
      <Lock className="h-3 w-3 mt-0.5 shrink-0" />
      <span>{text}</span>
    </div>
  );
}

function ErrorRow({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-rose-700/40 bg-rose-900/20 px-3 py-2 text-[11px] text-rose-200 leading-relaxed mb-2">
      {text}
    </div>
  );
}

// ── value formatting ────────────────────────────────────────────────

function formatForDisplay(value: unknown, type: EditableField["inputType"]): string {
  if (value === null || value === undefined || value === "") return "—";
  if (type === "boolean") return value === true ? "Yes" : value === false ? "No" : "—";
  if (type === "number") return typeof value === "number" ? String(value) : String(value);
  if (type === "date") return typeof value === "string" ? value : "—";
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function formatForInput(value: unknown, type: EditableField["inputType"]): string {
  if (value === null || value === undefined) return "";
  if (type === "boolean") return value === true ? "true" : "false";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
