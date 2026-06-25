// ============================================================================
// AGENT PORTAL 2.0 — AP2.1H — /ai page shell
// ============================================================================
// Two-column layout: left = quick prompts + recent transactions; right
// = AIChatPanel. Reads ?txn=<uuid> + ?seed=<text> from the URL so the
// Command Bar can deep-link the agent into a pre-configured chat.
//
// All data comes from the EXISTING Vault /api/platform/workspace
// endpoint. No new endpoints. No new tools. No writes.
// ============================================================================

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronDown, Layers, Sparkles, Zap } from "lucide-react";

import AIChatPanel, { type AIChatPanelHandle } from "./AIChatPanel";
import { visibleQuickPrompts } from "./quick-prompts";
import { stageLabel } from "../workspace/helpers";
import type { WorkspaceCard } from "../workspace/types";

export default function AIShell({ workspaceCards }: { workspaceCards: WorkspaceCard[] }) {
  const search = useSearchParams();
  const initialTxn = search?.get("txn") ?? null;
  const initialSeed = search?.get("seed") ?? null;

  const [selectedTxnId, setSelectedTxnId] = useState<string | null>(initialTxn);
  const [seedPrompt, setSeedPrompt] = useState<string | null>(initialSeed);
  const chatRef = useRef<AIChatPanelHandle | null>(null);

  // If the URL changes while we're on the page, re-sync (rare; happens
  // when CommandBar fires a navigation while the page is already mounted).
  useEffect(() => {
    const t = search?.get("txn") ?? null;
    const s = search?.get("seed") ?? null;
    if (t !== selectedTxnId) setSelectedTxnId(t);
    if (s !== seedPrompt) setSeedPrompt(s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const selectedTxn = useMemo(
    () => workspaceCards.find((c) => c.transaction_id === selectedTxnId) ?? null,
    [workspaceCards, selectedTxnId]
  );

  const recent = useMemo(() => workspaceCards.slice(0, 6), [workspaceCards]);
  const prompts = useMemo(() => visibleQuickPrompts(selectedTxnId !== null), [selectedTxnId]);

  function applyPrompt(text: string) {
    setSeedPrompt(text);
    chatRef.current?.seed(text);
  }

  return (
    <div>
      <header className="mb-6">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-[#C9A84C]" />
          <h1 className="text-2xl font-semibold text-[#F1F1F3]">AI Assistant</h1>
        </div>
        <p className="text-sm text-[#A1A1AA] mt-1 max-w-prose">
          Ask anything about your transactions, paperwork, or workflow.
          Optionally pick a deal to scope the conversation.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
        {/* Left column — transaction selector + quick prompts */}
        <aside className="space-y-4 lg:max-w-[260px]">
          <TransactionSelector
            cards={workspaceCards}
            selected={selectedTxn}
            onChange={(id) => setSelectedTxnId(id)}
          />

          <section className="rounded-lg border border-[#1a1a2e] bg-[#11111a] p-3">
            <h2 className="text-[10px] uppercase tracking-wider text-[#71717A] mb-2 flex items-center gap-1">
              <Zap className="h-3 w-3 text-[#C9A84C]" /> Quick prompts
            </h2>
            <ul className="space-y-1">
              {prompts.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => applyPrompt(p.prompt)}
                    className="
                      w-full text-left text-xs text-[#A1A1AA]
                      hover:text-[#F1F1F3] hover:bg-[#1a1a25]
                      rounded-md px-2 py-1.5
                      transition-colors duration-[180ms]
                    "
                  >
                    {p.label}
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {recent.length > 0 && (
            <section className="rounded-lg border border-[#1a1a2e] bg-[#11111a] p-3">
              <h2 className="text-[10px] uppercase tracking-wider text-[#71717A] mb-2 flex items-center gap-1">
                <Layers className="h-3 w-3 text-[#C9A84C]" /> Recent transactions
              </h2>
              <ul className="space-y-1">
                {recent.map((c) => {
                  const active = c.transaction_id === selectedTxnId;
                  return (
                    <li key={c.transaction_id}>
                      <button
                        type="button"
                        onClick={() => setSelectedTxnId(active ? null : c.transaction_id)}
                        className={`
                          w-full text-left text-xs rounded-md px-2 py-1.5
                          transition-colors duration-[180ms]
                          ${active
                            ? "bg-[#C9A84C]/10 text-[#E8D5A3] border border-[#C9A84C]/40"
                            : "text-[#A1A1AA] hover:text-[#F1F1F3] hover:bg-[#1a1a25] border border-transparent"
                          }
                        `}
                      >
                        <div className="truncate">{c.property_address || "(no address)"}</div>
                        <div className="text-[10px] text-[#71717A] truncate">
                          {c.client_name || "(no client)"} · {stageLabel(c.stage)}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </aside>

        {/* Main column — chat */}
        <div className="min-w-0">
          <AIChatPanel
            ref={chatRef}
            transactionId={selectedTxnId}
            seedPrompt={seedPrompt ?? undefined}
          />
        </div>
      </div>
    </div>
  );
}

// ── Transaction selector (dropdown) ─────────────────────────────────

function TransactionSelector({
  cards,
  selected,
  onChange,
}: {
  cards: WorkspaceCard[];
  selected: WorkspaceCard | null;
  onChange: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-lg border border-[#1a1a2e] bg-[#11111a] p-3">
      <h2 className="text-[10px] uppercase tracking-wider text-[#71717A] mb-2">
        Transaction context
      </h2>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="
          w-full flex items-center justify-between gap-2
          rounded-md border border-[#1a1a2e] bg-[#0b0b10]
          px-3 py-2 text-sm text-left text-[#F1F1F3]
          hover:border-[#252538]
        "
        aria-expanded={open}
      >
        <span className="min-w-0 truncate">
          {selected
            ? selected.property_address || "(no address)"
            : <span className="text-[#71717A]">No transaction selected</span>}
        </span>
        <ChevronDown className="h-3 w-3 text-[#71717A] shrink-0" />
      </button>
      {open && (
        <div className="mt-2 rounded-md border border-[#1a1a2e] bg-[#0b0b10] max-h-[260px] overflow-y-auto">
          <button
            type="button"
            onClick={() => { onChange(null); setOpen(false); }}
            className="block w-full text-left text-xs text-[#A1A1AA] hover:bg-[#1a1a25] px-3 py-1.5"
          >
            (no transaction — general questions)
          </button>
          {cards.map((c) => (
            <button
              key={c.transaction_id}
              type="button"
              onClick={() => { onChange(c.transaction_id); setOpen(false); }}
              className="block w-full text-left text-xs text-[#A1A1AA] hover:bg-[#1a1a25] hover:text-[#F1F1F3] px-3 py-1.5"
            >
              <div className="truncate">{c.property_address || "(no address)"}</div>
              <div className="text-[10px] text-[#71717A] truncate">
                {c.client_name || "(no client)"} · {stageLabel(c.stage)}
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
