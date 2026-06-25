// ============================================================================
// AGENT PORTAL 2.0 — AP2.1C — Inline AI Assistant
// ============================================================================
// Thin client component over Vault's EXISTING POST /api/ai/chat endpoint.
// Identical payload contract Vault's own floating ChatWidget uses:
//   { message, context: { transaction_id } }
//
// NO new chat logic. NO new tools. NO new endpoints. The Portal forwards
// the agent's Bearer token; Vault enforces every gate + tool allowlist
// exactly as before.
// ============================================================================

"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

import { supabase } from "@/lib/supabase";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const VAULT_API_URL =
  (process.env.NEXT_PUBLIC_VAULT_API_URL ?? "https://vault.hartfeltrealestate.com/api").replace(/\/$/, "");

export default function AIAssistantPanel({ transactionId }: { transactionId: string }) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "I have this transaction's full paperwork state from Vault. Ask me what's blocking it, give me a value to update, or ask if it's ready for broker review. Broker confirmation is required for every write.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const userMsg = input.trim();
    if (!userMsg || busy) return;
    setMessages((m) => [...m, { role: "user", content: userMsg }]);
    setInput("");
    setBusy(true);

    try {
      // Forward the agent's Bearer token to Vault's /api/ai/chat.
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      const res = await fetch(`${VAULT_API_URL}/ai/chat`, {
        method: "POST",
        credentials: "omit",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message: userMsg,
          context: { transaction_id: transactionId },
        }),
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
      className="rounded-lg border border-[#1a1a2e] bg-[#11111a] flex flex-col h-[520px]"
    >
      <header className="px-4 py-3 border-b border-[#1a1a2e] flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-[#C9A84C]" />
        <span className="text-sm font-medium text-[#F1F1F3]">Deal Copilot</span>
        <span className="ml-auto text-[10px] tracking-wider uppercase text-[#71717A]">
          transaction-scoped
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
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={busy}
          placeholder="e.g. What's blocking this deal?"
          className="
            flex-1 rounded-md bg-[#0b0b10] border border-[#1a1a2e]
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
        Broker confirmation is required for any change. This assistant cannot send envelopes or finalize the package.
      </div>
    </div>
  );
}
