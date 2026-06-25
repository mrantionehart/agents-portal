// ============================================================================
// AGENT PORTAL 2.0 — AP2.1H — Generalized AI Chat Panel
// ============================================================================
// Companion to AP2.1C's transaction-scoped AIAssistantPanel. This
// variant accepts a NULLABLE transactionId, so it can power the
// dedicated /ai page where the agent may or may not have selected a
// specific deal.
//
// Contract:
//   - Calls Vault POST /api/ai/chat (the EXACT same endpoint Vault's
//     floating ChatWidget uses) with the agent's Bearer token.
//   - Payload: { message, context: transactionId ? { transaction_id } : {} }
//   - Streams the response identically.
//
// Constraints honored:
//   - NO new endpoints / tools / business logic
//   - NO auto-send (every prompt requires the user to click Send)
//   - Broker confirmation is required for any change — Vault enforces
// ============================================================================

"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

import { supabase } from "@/lib/supabase";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const VAULT_API_URL = (
  process.env.NEXT_PUBLIC_VAULT_API_URL ?? "https://vault.hartfeltrealestate.com/api"
).replace(/\/$/, "");

export interface AIChatPanelProps {
  /** Optional transaction context. When null, the payload omits
   *  context.transaction_id. */
  transactionId: string | null;
  /** Optional initial prompt to pre-fill the input. Used by the
   *  CommandBar to seed prompts. The user must still press Send. */
  seedPrompt?: string;
  /** Optional override of the initial greeting message. */
  greeting?: string;
}

export interface AIChatPanelHandle {
  /** Programmatically pre-fill the input. Does NOT auto-send. */
  seed: (text: string) => void;
}

const AIChatPanel = forwardRef<AIChatPanelHandle, AIChatPanelProps>(function AIChatPanel(
  { transactionId, seedPrompt, greeting },
  ref
) {
  const defaultGreeting =
    transactionId
      ? "I have this transaction's full paperwork state from Vault. Ask me what's blocking it, what's missing, or whether it's ready for broker review."
      : "Pick a transaction on the left for deal-specific help, or ask a general question about your workflow. Broker confirmation is required for every change.";

  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: greeting ?? defaultGreeting },
  ]);
  const [input, setInput] = useState(seedPrompt ?? "");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Refresh greeting when the transaction context changes.
  useEffect(() => {
    setMessages((existing) => {
      const head = existing[0];
      if (head && head.role === "assistant") {
        return [{ role: "assistant", content: greeting ?? defaultGreeting }, ...existing.slice(1)];
      }
      return existing;
    });
    // We intentionally do NOT clear the conversation history when the
    // txn changes — the user may want to compare deals in one session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactionId]);

  // Seed prompts from parent / query string. NEVER auto-sends.
  useEffect(() => {
    if (seedPrompt) {
      setInput(seedPrompt);
      inputRef.current?.focus();
    }
  }, [seedPrompt]);

  useImperativeHandle(ref, () => ({
    seed: (text: string) => {
      setInput(text);
      inputRef.current?.focus();
    },
  }));

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const userMsg = input.trim();
    if (!userMsg || busy) return;
    setMessages((m) => [...m, { role: "user", content: userMsg }]);
    setInput("");
    setBusy(true);

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      const body =
        transactionId !== null
          ? { message: userMsg, context: { transaction_id: transactionId } }
          : { message: userMsg, context: {} };

      const res = await fetch(`${VAULT_API_URL}/ai/chat`, {
        method: "POST",
        credentials: "omit",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errBody = await res.text();
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content: `Couldn't reach the assistant (HTTP ${res.status}): ${errBody.slice(0, 160)}`,
          },
        ]);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        const text = await res.text();
        setMessages((m) => [...m, { role: "assistant", content: text }]);
        return;
      }

      const decoder = new TextDecoder();
      let assistantText = "";
      setMessages((m) => [...m, { role: "assistant", content: "" }]);
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistantText += decoder.decode(value, { stream: true });
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "assistant", content: assistantText };
          return copy;
        });
      }
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: `Network error: ${err instanceof Error ? err.message : "unknown"}`,
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      id="ai-assistant"
      className="rounded-lg border border-[#1a1a2e] bg-[#11111a] flex flex-col h-[600px] max-h-[80vh]"
    >
      <header className="px-4 py-3 border-b border-[#1a1a2e] flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-[#C9A84C]" />
        <span className="text-sm font-medium text-[#F1F1F3]">HartFelt AI</span>
        <span className="ml-auto text-[10px] tracking-wider uppercase text-[#71717A]">
          {transactionId ? "transaction-scoped" : "general"}
        </span>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 text-sm">
        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.role === "user"
                ? "ml-8 rounded-md bg-[#C9A84C]/10 border border-[#C9A84C]/30 px-3 py-2 text-[#E8D5A3]"
                : "mr-8 rounded-md bg-[#0b0b10] border border-[#1a1a2e] px-3 py-2 text-[#A1A1AA] whitespace-pre-wrap"
            }
          >
            {m.content || <span className="text-[#71717A] italic">…</span>}
          </div>
        ))}
        {busy && (
          <div className="mr-8 rounded-md bg-[#0b0b10] border border-[#1a1a2e] px-3 py-2 text-[#71717A] inline-flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin" /> Thinking…
          </div>
        )}
      </div>

      <form onSubmit={send} className="border-t border-[#1a1a2e] p-3 flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={busy}
          placeholder={
            transactionId
              ? "e.g. What's blocking this deal?"
              : "e.g. What should I prioritize today?"
          }
          className="
            flex-1 min-w-0 rounded-md bg-[#0b0b10] border border-[#1a1a2e]
            px-3 py-1.5 text-sm text-[#F1F1F3] placeholder:text-[#71717A]
            focus:outline-none focus:border-[#252538]
            disabled:opacity-60
          "
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="
            rounded-md bg-[#C9A84C] text-[#0b0b10] px-3 py-1.5 text-sm font-medium
            hover:bg-[#E8D5A3]
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors duration-[180ms]
          "
        >
          Send
        </button>
      </form>

      <div className="border-t border-[#1a1a2e] px-4 py-2 text-[10px] text-[#71717A]">
        Broker confirmation is required for any change. The assistant cannot
        send envelopes, approve paperwork, or finalize the package — every
        sensitive action still flows through Vault.
      </div>
    </div>
  );
});

export default AIChatPanel;
