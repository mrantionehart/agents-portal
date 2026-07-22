// ============================================================================
// RELEASE.002B — Portal 2.0 Contact Support experience
// ============================================================================
// UI-ONLY. Surfaces the ALREADY-VERIFIED support flow inside Portal 2.0:
//
//   this component ──POST /api/support──▶ proxyToVault() ──▶ Vault
//                     /api/support/requests ──▶ support_requests + outbox
//
// It does NOT persist, email, or write anywhere itself. It posts the four
// form fields the existing endpoint expects ({ name, email, subject, message })
// and renders the result. Agent name + email are supplied read-only by the
// caller (the Settings server component reads them from the session).
//
// No new routes, no API changes, no backend changes.
// ============================================================================

"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  CheckCircle2,
  LifeBuoy,
  Loader2,
  X,
} from "lucide-react";

interface ContactSupportProps {
  /** From the authenticated session — shown read-only, never editable. */
  agentName: string | null;
  agentEmail: string | null;
}

type Status = "idle" | "submitting" | "success" | "error";

const SUCCESS_COPY =
  "Your support request has been received. Our team has been notified and will review your request shortly.";

export default function ContactSupport({
  agentName,
  agentEmail,
}: ContactSupportProps) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [validationMsg, setValidationMsg] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const titleId = useId();
  const descId = useId();

  // Read-only identity. Fall back to the email-local part if no display name.
  const displayName =
    (agentName && agentName.trim()) ||
    (agentEmail ? agentEmail.split("@")[0] : "");
  const email = agentEmail ?? "";

  const submitting = status === "submitting";

  const resetForm = useCallback(() => {
    setSubject("");
    setMessage("");
    setStatus("idle");
    setErrorMsg("");
    setValidationMsg(null);
  }, []);

  const close = useCallback(() => {
    if (submitting) return; // never close mid-flight
    setOpen(false);
  }, [submitting]);

  // On open: focus the first field. On close: reset + return focus to trigger.
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => subjectRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
    resetForm();
    triggerRef.current?.focus();
  }, [open, resetForm]);

  // Escape to close + focus trap while open.
  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
        return;
      }
      if (e.key !== "Tab") return;

      const root = dialogRef.current;
      if (!root) return;
      const focusables = Array.from(
        root.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);

      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return; // double-submit guard

    const s = subject.trim();
    const m = message.trim();
    if (!s || !m) {
      setValidationMsg("Please enter both a subject and a message.");
      return;
    }
    setValidationMsg(null);
    setErrorMsg("");
    setStatus("submitting");

    try {
      const res = await fetch("/api/support", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: displayName, email, subject: s, message: m }),
      });

      if (!res.ok) {
        // Surface the API's own error cleanly; never a stack trace.
        let apiMsg = "We couldn't submit your request. Please try again.";
        try {
          const data = await res.json();
          if (data && typeof data.error === "string" && data.error.trim()) {
            apiMsg = data.error;
          }
        } catch {
          /* non-JSON error body — keep the friendly fallback */
        }
        setErrorMsg(apiMsg);
        setStatus("error");
        return;
      }

      setStatus("success");
    } catch {
      // Network/transport failure — never swallowed.
      setErrorMsg(
        "Network error — please check your connection and try again."
      );
      setStatus("error");
    }
  }

  const inputBase =
    "w-full rounded-md border border-[#1a1a2e] bg-[#0b0b10] px-3 py-2 text-sm " +
    "text-[#F1F1F3] placeholder:text-[#71717A] " +
    "focus:outline-none focus:border-[#C9A84C]/60 focus:ring-1 focus:ring-[#C9A84C]/40 " +
    "transition-colors duration-[180ms]";

  const readonlyBase =
    "w-full rounded-md border border-[#1a1a2e] bg-[#050507] px-3 py-2 text-sm " +
    "text-[#A1A1AA] cursor-not-allowed select-none";

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        data-testid="contact-support-trigger"
        className={
          "inline-flex items-center gap-1.5 rounded-md border border-[#C9A84C]/40 " +
          "bg-[#C9A84C]/15 px-3 py-1.5 text-sm font-medium text-[#E8D5A3] " +
          "hover:bg-[#C9A84C]/25 focus:outline-none focus-visible:ring-2 " +
          "focus-visible:ring-[#C9A84C]/50 transition-colors duration-[180ms]"
        }
      >
        <LifeBuoy className="h-4 w-4" aria-hidden />
        Contact Support
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4"
            role="presentation"
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
              onClick={close}
              aria-hidden
            />

            {/* Dialog */}
            <div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              aria-describedby={descId}
              className="
                relative z-[101] w-full sm:max-w-lg
                max-h-[92vh] overflow-y-auto
                rounded-t-2xl sm:rounded-2xl
                border border-[#252538] bg-[#11111a]
                shadow-[0_12px_32px_rgba(0,0,0,0.5)]
              "
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3 border-b border-[#1a1a2e] px-5 py-4">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    aria-hidden
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#252538] bg-[#0b0b10]"
                  >
                    <LifeBuoy className="h-4 w-4 text-[#C9A84C]" />
                  </span>
                  <h2
                    id={titleId}
                    className="text-base font-semibold text-[#F1F1F3] truncate"
                  >
                    Contact Support
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={close}
                  disabled={submitting}
                  aria-label="Close"
                  className="
                    -mr-1 rounded-md p-1.5 text-[#A1A1AA]
                    hover:bg-white/[0.04] hover:text-[#F1F1F3]
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A84C]/50
                    disabled:opacity-40 disabled:cursor-not-allowed
                    transition-colors duration-[180ms]
                  "
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>

              {status === "success" ? (
                <div className="px-5 py-8 text-center" data-testid="contact-support-success">
                  <CheckCircle2
                    className="mx-auto h-10 w-10 text-emerald-400"
                    aria-hidden
                  />
                  <p className="mt-3 text-sm font-medium text-[#F1F1F3]">
                    Request received
                  </p>
                  <p className="mx-auto mt-1 max-w-sm text-sm text-[#A1A1AA] leading-relaxed">
                    {SUCCESS_COPY}
                  </p>
                  <button
                    type="button"
                    onClick={close}
                    className="
                      mt-5 inline-flex items-center gap-1.5 rounded-md
                      border border-[#252538] bg-[#0b0b10] px-4 py-2
                      text-sm text-[#F1F1F3] hover:bg-[#1a1a25]
                      focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A84C]/50
                      transition-colors duration-[180ms]
                    "
                  >
                    Done
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4" noValidate>
                  <p id={descId} className="text-xs text-[#71717A] leading-relaxed">
                    Send a question or issue to the HartFelt team. We&apos;ll
                    review it and follow up.
                  </p>

                  {/* Read-only identity */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="cs-name"
                        className="block text-xs font-medium text-[#A1A1AA] mb-1"
                      >
                        Name
                      </label>
                      <input
                        id="cs-name"
                        type="text"
                        value={displayName}
                        readOnly
                        aria-readonly="true"
                        tabIndex={-1}
                        className={readonlyBase}
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="cs-email"
                        className="block text-xs font-medium text-[#A1A1AA] mb-1"
                      >
                        Email
                      </label>
                      <input
                        id="cs-email"
                        type="email"
                        value={email}
                        readOnly
                        aria-readonly="true"
                        tabIndex={-1}
                        className={readonlyBase}
                      />
                    </div>
                  </div>

                  {/* Subject */}
                  <div>
                    <label
                      htmlFor="cs-subject"
                      className="block text-xs font-medium text-[#A1A1AA] mb-1"
                    >
                      Subject <span className="text-[#C9A84C]" aria-hidden>*</span>
                    </label>
                    <input
                      id="cs-subject"
                      ref={subjectRef}
                      name="subject"
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      required
                      aria-required="true"
                      maxLength={200}
                      disabled={submitting}
                      placeholder="What do you need help with?"
                      className={inputBase}
                    />
                  </div>

                  {/* Message */}
                  <div>
                    <label
                      htmlFor="cs-message"
                      className="block text-xs font-medium text-[#A1A1AA] mb-1"
                    >
                      Message <span className="text-[#C9A84C]" aria-hidden>*</span>
                    </label>
                    <textarea
                      id="cs-message"
                      name="message"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      required
                      aria-required="true"
                      rows={5}
                      maxLength={5000}
                      disabled={submitting}
                      placeholder="Describe your question or issue…"
                      className={inputBase + " resize-y min-h-[96px]"}
                    />
                  </div>

                  {/* Validation (client) */}
                  {validationMsg && (
                    <p
                      role="alert"
                      className="text-xs text-amber-300"
                      data-testid="contact-support-validation"
                    >
                      {validationMsg}
                    </p>
                  )}

                  {/* API / network error */}
                  {status === "error" && errorMsg && (
                    <div
                      role="alert"
                      data-testid="contact-support-error"
                      className="flex items-start gap-2 rounded-md border border-rose-700/40 bg-rose-900/20 px-3 py-2 text-xs text-rose-200"
                    >
                      <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={close}
                      disabled={submitting}
                      className="
                        rounded-md border border-transparent px-3 py-2 text-sm
                        text-[#A1A1AA] hover:bg-white/[0.04] hover:text-[#F1F1F3]
                        focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A84C]/50
                        disabled:opacity-40 disabled:cursor-not-allowed
                        transition-colors duration-[180ms]
                      "
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      aria-busy={submitting}
                      className="
                        inline-flex items-center gap-1.5 rounded-md
                        border border-[#C9A84C]/40 bg-[#C9A84C]/15 px-4 py-2
                        text-sm font-medium text-[#E8D5A3]
                        hover:bg-[#C9A84C]/25
                        focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A84C]/50
                        disabled:opacity-50 disabled:cursor-not-allowed
                        transition-colors duration-[180ms]
                      "
                    >
                      {submitting && (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                      )}
                      {submitting ? "Submitting…" : "Submit request"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
