// ============================================================================
// AGENT PORTAL 2.0 — AP2.1H — Command Bar
// ============================================================================
// Linear/Arc-style ⌘K palette. Navigation-only + AI-prompt-seed only.
// NEVER triggers writes, never calls a mutation endpoint.
//
// Action catalog lives in src/portal/command-bar/actions.ts. Data
// (transactions + clients) is fetched lazily on first open via the
// useCommandData hook — same shape AP2.1B + AP2.1G already use, no
// new endpoints.
// ============================================================================

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ChevronRight,
  Loader2,
  Sparkles,
  Users,
  Layers,
  Compass,
} from "lucide-react";

import {
  composePalette,
  flattenActions,
  targetFor,
  type CommandAction,
  type ComposedResults,
} from "./command-bar/actions";
import { useCommandData } from "./command-bar/useCommandData";

export interface CommandBarProps {
  open: boolean;
  onClose: () => void;
}

export default function CommandBar({ open, onClose }: CommandBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [focusIdx, setFocusIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Lazily load txns + clients on first open.
  const data = useCommandData(open);

  const composed: ComposedResults = useMemo(
    () => composePalette({ query, txns: data.txns, clients: data.clients }),
    [query, data.txns, data.clients]
  );
  const flat = useMemo(() => flattenActions(composed), [composed]);

  // Reset focus when results change.
  useEffect(() => {
    setFocusIdx(0);
  }, [query, data.txns.length, data.clients.length]);

  // Reset query when bar closes; auto-focus when it opens.
  useEffect(() => {
    if (open) {
      setQuery("");
      setFocusIdx(0);
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Keyboard nav.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusIdx((i) => Math.min(i + 1, Math.max(0, flat.length - 1)));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusIdx((i) => Math.max(0, i - 1));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const action = flat[focusIdx];
        if (action) trigger(action);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, flat, focusIdx, onClose]);

  function trigger(action: CommandAction) {
    onClose();
    // Navigation-only behavior — no writes.
    router.push(targetFor(action));
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command bar"
      className="fixed inset-0 z-40 flex items-start justify-center pt-[12vh] sm:pt-[15vh] px-3 sm:px-4"
    >
      <div
        aria-hidden
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="
          relative w-full max-w-xl
          rounded-lg border border-[#252538] bg-[#11111a]
          shadow-[0_12px_32px_rgba(0,0,0,0.5)]
          max-h-[80vh] flex flex-col
        "
      >
        {/* Search input */}
        <div className="px-4 py-3 border-b border-[#252538] flex items-center gap-2 text-[#A1A1AA]">
          <Sparkles className="h-4 w-4 text-[#C9A84C]" aria-hidden />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search transactions, clients, or ask AI…"
            className="
              flex-1 min-w-0 bg-transparent outline-none
              text-sm text-[#F1F1F3] placeholder:text-[#71717A]
            "
          />
          {data.loading && (
            <Loader2 className="h-3 w-3 animate-spin text-[#71717A]" aria-hidden />
          )}
          <kbd className="text-[10px] tracking-wide text-[#71717A] border border-[#252538] rounded px-1.5 py-0.5">
            esc
          </kbd>
        </div>

        {/* Results */}
        <div className="overflow-y-auto py-2">
          <Section
            title="Navigate"
            icon={<Compass className="h-3 w-3" />}
            items={composed.nav}
            focusIdx={focusIdx}
            startIdx={0}
            onPick={trigger}
          />
          {composed.txns.length > 0 && (
            <Section
              title="Transactions"
              icon={<Layers className="h-3 w-3" />}
              items={composed.txns}
              focusIdx={focusIdx}
              startIdx={composed.nav.length}
              onPick={trigger}
            />
          )}
          {composed.clients.length > 0 && (
            <Section
              title="Clients"
              icon={<Users className="h-3 w-3" />}
              items={composed.clients}
              focusIdx={focusIdx}
              startIdx={composed.nav.length + composed.txns.length}
              onPick={trigger}
            />
          )}
          {composed.ai.length > 0 && (
            <Section
              title="AI"
              icon={<Sparkles className="h-3 w-3" />}
              items={composed.ai}
              focusIdx={focusIdx}
              startIdx={composed.nav.length + composed.txns.length + composed.clients.length}
              onPick={trigger}
            />
          )}
          {!data.loading && flat.length === 0 && (
            <div className="px-4 py-6 text-sm text-[#71717A]">
              No matches. Try a different query.
            </div>
          )}
        </div>

        {/* Safety footer */}
        <div className="px-4 py-2 border-t border-[#252538] text-[10px] text-[#71717A] flex items-center justify-between gap-3">
          <span>
            Navigation + AI seed only — no envelopes, no approvals.
          </span>
          <span className="flex items-center gap-1">
            <kbd className="border border-[#252538] rounded px-1.5">↑</kbd>
            <kbd className="border border-[#252538] rounded px-1.5">↓</kbd>
            <kbd className="border border-[#252538] rounded px-1.5">↵</kbd>
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Atoms ────────────────────────────────────────────────────────────

function Section({
  title,
  icon,
  items,
  focusIdx,
  startIdx,
  onPick,
}: {
  title: string;
  icon: React.ReactNode;
  items: CommandAction[];
  focusIdx: number;
  /** Absolute flat-list offset for items in this section. */
  startIdx: number;
  onPick: (a: CommandAction) => void;
}) {
  return (
    <section className="px-1">
      <h3 className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-[#71717A] flex items-center gap-1">
        {icon}
        {title}
      </h3>
      <ul role="listbox">
        {items.map((a, i) => {
          const idx = startIdx + i;
          const active = idx === focusIdx;
          return (
            <li key={a.id}>
              <button
                type="button"
                onMouseEnter={() => { /* keyboard wins; mouse just renders hover */ }}
                onClick={() => onPick(a)}
                role="option"
                aria-selected={active}
                className={`
                  w-full text-left rounded-md px-3 py-2 flex items-center gap-2
                  ${active
                    ? "bg-[#C9A84C]/15 text-[#E8D5A3]"
                    : "text-[#A1A1AA] hover:bg-[#1a1a25] hover:text-[#F1F1F3]"
                  }
                `}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm truncate">{a.label}</div>
                  {a.hint && (
                    <div className="text-[10px] text-[#71717A] truncate">{a.hint}</div>
                  )}
                </div>
                {a.kind === "seed-ai" ? (
                  <ArrowRight className="h-3 w-3 text-[#71717A] shrink-0" aria-hidden />
                ) : (
                  <ChevronRight className="h-3 w-3 text-[#71717A] shrink-0" aria-hidden />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
