// ============================================================================
// TRANSACTION ASSISTANT 4.0E.2 — Draft Picker
// ============================================================================
// A minimal, native-to-the-AI-tab menu of the 10 draft types, grouped by
// audience. Selecting one calls onSelect(draft_type) — the panel sends the
// EXPLICIT draft_type (never a faked prompt). Navigation/selection only; this
// component never calls the assistant or sends anything.
// ============================================================================

"use client";

import { useEffect, useRef, useState } from "react";
import { FileText } from "lucide-react";

import type { DraftType } from "./assistant-types";
import { DRAFT_MENU } from "./assistant-view";

export interface DraftPickerProps {
  onSelect: (type: DraftType) => void;
  disabled?: boolean;
}

export default function DraftPicker({ onSelect, disabled }: DraftPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  // close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pick(type: DraftType) {
    setOpen(false);
    onSelect(type);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        data-testid="draft-picker-button"
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-1 rounded-md border border-[#252538] bg-[#0b0b10] px-2.5 py-1.5 text-xs text-[#C7C7CC] hover:text-[#F1F1F3] hover:border-[#C9A84C]/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <FileText className="h-3.5 w-3.5 text-[#C9A84C]" /> Draft…
      </button>

      {open && (
        <div
          role="menu"
          data-testid="draft-picker-menu"
          className="absolute bottom-full mb-1 left-0 z-20 w-64 max-h-[320px] overflow-y-auto rounded-md border border-[#252538] bg-[#11111a] py-1 shadow-lg"
        >
          {DRAFT_MENU.map((g) => (
            <div key={g.group}>
              <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-[#71717A]">{g.group}</div>
              {g.items.map((it) => (
                <button
                  key={it.type}
                  type="button"
                  role="menuitem"
                  onClick={() => pick(it.type)}
                  data-testid={`draft-option-${it.type}`}
                  className="block w-full text-left px-3 py-1.5 text-xs text-[#C7C7CC] hover:bg-[#C9A84C]/10 hover:text-[#F1F1F3]"
                >
                  {it.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
