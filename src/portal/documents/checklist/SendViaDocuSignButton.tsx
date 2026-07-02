// ============================================================================
// AGENT.SIGN.2C — "Send via My DocuSign" per-row action
// ============================================================================
// Sends a single form for signature from the agent's OWN connected DocuSign
// account (Vault route generates-if-needed → flattens → sends). After a
// successful send shows Sent + envelope id + sent time + a "View in DocuSign"
// link. When the agent hasn't connected, links to Settings instead.
// Download Envelope Package remains the fallback (in the action bar).
// ============================================================================

"use client";

import { useState } from "react";
import { CheckCircle2, ExternalLink, Loader2, PenLine } from "lucide-react";

import { authFetch } from "@/lib/supabase";
import { VAULT_API_URL } from "@/lib/vault-client";

interface Props {
  transactionId: string;
  formInstanceId: string;
  formId: string;
  connected: boolean;
  onSent?: () => void;
}

export default function SendViaDocuSignButton({
  transactionId,
  formInstanceId,
  formId,
  connected,
  onSent,
}: Props) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<{ envelopeId: string; sentAt: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!connected) {
    return (
      <a
        href="/settings"
        title="Connect your DocuSign in Settings to send"
        className="inline-flex items-center gap-1 rounded-md border border-[#252538] bg-[#11111a] px-2 py-1 text-[11px] text-[#71717A] hover:text-[#A1A1AA]"
      >
        <PenLine className="h-3 w-3" /> Connect DocuSign
      </a>
    );
  }

  if (sent) {
    return (
      <span className="inline-flex items-center gap-2 text-[11px] text-emerald-300">
        <CheckCircle2 className="h-3 w-3" />
        Sent · {sent.envelopeId.slice(0, 8)}…
        {sent.sentAt ? ` · ${new Date(sent.sentAt).toLocaleString()}` : ""}
        <a
          href={`https://apps.docusign.com/send/documents/details/${sent.envelopeId}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-0.5 text-[#E8D5A3] hover:underline"
        >
          View in DocuSign <ExternalLink className="h-3 w-3" />
        </a>
      </span>
    );
  }

  const send = async () => {
    setSending(true);
    setError(null);
    try {
      const res = await authFetch(
        `${VAULT_API_URL}/paperwork/agents/transactions/${transactionId}/documents/${formInstanceId}/send`,
        { method: "POST" }
      );
      const body = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        setError(
          res.status === 409
            ? "Connect DocuSign in Settings first."
            : body?.error || "Send failed."
        );
        return;
      }
      setSent({ envelopeId: body.envelope_id, sentAt: body.sent_at });
      onSent?.();
    } catch {
      setError("Send failed.");
    } finally {
      setSending(false);
    }
  };

  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => void send()}
        disabled={sending}
        title={`Send ${formId} from your DocuSign`}
        className="inline-flex items-center gap-1 rounded-md border border-teal-500/40 bg-teal-500/10 px-2 py-1 text-[11px] text-teal-300 hover:bg-teal-500/20 disabled:opacity-50"
      >
        {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <PenLine className="h-3 w-3" />}
        Send via My DocuSign
      </button>
      {error && <span className="text-[10px] text-rose-300">{error}</span>}
    </span>
  );
}
