// ============================================================================
// AGENT PORTAL 3.0 — Workflow 3.2.A — Form detail drawer
// ============================================================================
// Server-rendered right-side panel. Pure presentation — receives a
// preloaded FormDetailBundle from the page. No client JS, no buttons
// with handlers, no fetches.
//
// Sections (in order):
//   1. Header — form code + revision + category + status
//   2. Missing fields — agent-visible, filtered to this form
//   3. Statutory disclosures — agent-visible, read-only
//   4. Envelope — broker-only (gated by role)
//   5. Generated PDF — broker-only
//   6. Audit history — broker-only, filtered to this form_instance_id
//   7. Footer — Open in Vault + Close drawer
//
// All broker-only sections render a neutral "broker access only" hint
// for agents — never a 403 noise card.
// ============================================================================

import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileSignature,
  Lock,
  Mail,
  Shield,
  X,
} from "lucide-react";

import type { DocumentRow } from "../types";
import {
  categoryLabel,
  envelopeCopy,
  relativeUpdated,
  statusLabel,
  statusTone,
} from "../helpers";
import type { FormDetailBundle } from "./types";
import {
  completerRoleLabel,
  formDrawerCloseHref,
  humanSeverity,
  severityTone,
} from "./helpers";
import FormEditableSection from "./edit/FormEditableSection";

export interface FormDetailDrawerProps {
  transactionId: string;
  document: DocumentRow;
  /** Optional form_instances.id — when present, broker sections can
   *  scope envelope / audit to this specific instance. */
  formInstanceId: string | null;
  detail: FormDetailBundle;
  /** The broker-confirmation copy line shown in the footer, mirroring
   *  the AI panel disclaimer. */
}

export default function FormDetailDrawer({
  transactionId,
  document,
  formInstanceId,
  detail,
}: FormDetailDrawerProps) {
  const closeHref = formDrawerCloseHref(transactionId);
  const tone = statusTone(document.status);

  return (
    <aside
      aria-label={`Form detail: ${document.form_id}`}
      className="
        fixed right-0 top-0 bottom-0 z-40 w-full max-w-md
        border-l border-[#1a1a2e] bg-[#0b0b10] overflow-y-auto
        shadow-2xl shadow-black/40
      "
    >
      {/* Header */}
      <header className="sticky top-0 bg-[#0b0b10] border-b border-[#1a1a2e] px-5 py-4 z-10">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <h2 className="text-base font-semibold text-[#F1F1F3]">
                {document.form_id}
              </h2>
              {document.form_revision && (
                <span className="text-[10px] text-[#71717A]">
                  {document.form_revision}
                </span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-2 flex-wrap text-[11px]">
              <StatusPill label={statusLabel(document.status)} tone={tone} />
              {document.form_category && (
                <span className="text-[10px] text-[#71717A] uppercase tracking-wide">
                  {categoryLabel(document.form_category)}
                </span>
              )}
              {document.status === "blocked" && (
                <span
                  className="inline-flex items-center gap-1 text-[10px] text-amber-200/80"
                  title="Blocked on party attestation"
                >
                  <Lock className="h-2.5 w-2.5" /> Blocked
                </span>
              )}
            </div>
            {document.reason && (
              <p className="mt-2 text-[11px] text-[#A1A1AA] leading-relaxed">
                {document.reason}
              </p>
            )}
          </div>
          <Link
            href={closeHref}
            aria-label="Close form detail"
            className="
              shrink-0 inline-flex items-center justify-center
              rounded-md border border-[#1a1a2e] bg-[#11111a]
              h-7 w-7 text-[#A1A1AA] hover:text-[#F1F1F3]
              transition-colors duration-[180ms]
            "
          >
            <X className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      <div className="px-5 py-4 space-y-5">
        {/* Section: Editable fields (Workflow 3.2.B.1, agent + broker) */}
        <FormEditableSection
          transactionId={transactionId}
          editableFields={detail.editable_fields}
          snapshot={detail.snapshot}
          snapshotError={detail.errors.snapshot}
        />

        {/* Section: Missing fields */}
        <Section title="Missing fields">
          {detail.errors.missing && (
            <ErrorRow text={`Couldn't load missing fields (${detail.errors.missing}).`} />
          )}
          {detail.missing.length === 0 && !detail.errors.missing ? (
            <EmptyRow text="No outstanding required fields for this form." />
          ) : (
            <ul className="space-y-2 text-sm">
              {detail.missing.map((m) => (
                <li
                  key={m.transaction_path}
                  className="rounded-md border border-[#1a1a2e] bg-[#0b0b10] px-3 py-2"
                >
                  <div className="flex items-start gap-2">
                    <SeverityBadge severity={m.severity} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[#F1F1F3] text-xs font-medium truncate">
                        {m.label ?? m.transaction_path}
                      </div>
                      {m.prompt && (
                        <div className="mt-0.5 text-[11px] text-[#A1A1AA] leading-relaxed">
                          {m.prompt}
                        </div>
                      )}
                      <div className="mt-1 text-[10px] text-[#71717A]">
                        {completerRoleLabel(m.completer_role)} ·{" "}
                        <span className="font-mono">{m.transaction_path}</span>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Section: Statutory disclosures */}
        <Section
          title="Statutory disclosures"
          icon={<Shield className="h-3 w-3 text-[#71717A]" />}
        >
          {detail.statutory_fields.length === 0 ? (
            <EmptyRow text="No statutory disclosures bound to this form." />
          ) : (
            <ul className="space-y-2 text-sm">
              {detail.statutory_fields.map((s) => (
                <li
                  key={s.transaction_path}
                  className="rounded-md border border-[#1a1a2e] bg-[#0b0b10] px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    {s.satisfied ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300/90 shrink-0" />
                    ) : (
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-300/90 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-[#F1F1F3] text-xs font-mono truncate">
                        {s.transaction_path}
                      </div>
                      <div className="mt-0.5 text-[10px] text-[#71717A]">
                        {humanSeverity(s.severity)} ·{" "}
                        {s.satisfied
                          ? "Attested via party portal"
                          : "Awaiting party portal attestation"}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-[10px] text-[#71717A] leading-relaxed">
            Statutory facts can only be promoted to attested via the party
            portal. Vault enforces this at the database trigger; brokers
            issue invites from the paperwork package.
          </p>
        </Section>

        {/* Section: Envelope (broker-only) */}
        <Section
          title="Envelope"
          icon={<Mail className="h-3 w-3 text-[#71717A]" />}
        >
          {detail.broker_only_gated ? (
            <BrokerOnlyHint text="Envelope detail is broker-only. The form's envelope state is visible in the Vault paperwork package." />
          ) : detail.errors.envelope ? (
            <ErrorRow text={`Couldn't load envelope (${detail.errors.envelope}).`} />
          ) : !detail.envelope || !detail.envelope.envelope ? (
            <EmptyRow
              text={
                envelopeCopy(document) ??
                "No envelope on this form yet. Brokers send envelopes from the Vault paperwork package."
              }
            />
          ) : (
            <EnvelopeCard bundle={detail.envelope} />
          )}
        </Section>

        {/* Section: Generated / signed PDF (broker-only) */}
        <Section
          title="Documents"
          icon={<FileSignature className="h-3 w-3 text-[#71717A]" />}
        >
          {detail.broker_only_gated ? (
            <BrokerOnlyHint text="Generated and signed PDF links are broker-only." />
          ) : !detail.envelope?.signed_url && !document.signed_at ? (
            <EmptyRow text="No signed PDF yet." />
          ) : (
            <div className="space-y-2 text-xs">
              {detail.envelope?.signed_url && (
                <a
                  href={detail.envelope.signed_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="
                    inline-flex items-center gap-1.5 text-[#E8D5A3] hover:underline
                  "
                >
                  <ExternalLink className="h-3 w-3" />
                  Signed PDF (5-minute signed URL)
                </a>
              )}
              {document.signed_at && (
                <p className="text-[#A1A1AA]">
                  Signed {relativeUpdated(document.signed_at)}.
                </p>
              )}
            </div>
          )}
        </Section>

        {/* Section: Audit history (broker-only) */}
        <Section title="Audit history">
          {detail.broker_only_gated ? (
            <BrokerOnlyHint text="Per-form audit history is broker-only." />
          ) : detail.errors.history ? (
            <ErrorRow text={`Couldn't load history (${detail.errors.history}).`} />
          ) : !formInstanceId ? (
            <EmptyRow text="Form not yet materialized — no audit history." />
          ) : !detail.history || detail.history.length === 0 ? (
            <EmptyRow text="No recent activity on this form." />
          ) : (
            <ul className="space-y-2 text-sm">
              {detail.history.slice(0, 8).map((h) => (
                <li
                  key={h.id}
                  className="rounded-md border border-[#1a1a2e] bg-[#0b0b10] px-3 py-2"
                >
                  <div className="text-[11px] text-[#A1A1AA]">
                    <span className="font-mono">{h.field_path ?? "—"}</span>
                    {h.source && (
                      <span className="ml-1 text-[10px] text-[#71717A]">
                        · {h.source}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[10px] text-[#71717A]">
                    {relativeUpdated(h.created_at)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      {/* Footer */}
      <footer className="sticky bottom-0 bg-[#0b0b10] border-t border-[#1a1a2e] px-5 py-3">
        <div className="flex items-center justify-end gap-2">
          <Link
            href={closeHref}
            className="
              text-[11px] text-[#A1A1AA] hover:text-[#F1F1F3]
              inline-flex items-center gap-1
            "
          >
            Close
          </Link>
        </div>
        <p className="mt-2 text-[10px] text-[#71717A] leading-relaxed">
          Read-only view. Edits, generation, send, and approval are handled
          by the broker. Broker confirmation is required for every change.
        </p>
      </footer>
    </aside>
  );
}

// ── Subcomponents ────────────────────────────────────────────────────

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[#71717A] mb-2">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-[#1a1a2e] bg-[#0b0b10] px-3 py-2 text-[11px] text-[#71717A] leading-relaxed">
      {text}
    </div>
  );
}

function ErrorRow({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-rose-700/40 bg-rose-900/20 px-3 py-2 text-[11px] text-rose-200 leading-relaxed">
      {text}
    </div>
  );
}

function BrokerOnlyHint({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-[#1a1a2e] bg-[#0b0b10] px-3 py-2 text-[11px] text-[#71717A] leading-relaxed inline-flex items-start gap-1.5">
      <Lock className="h-3 w-3 mt-0.5 shrink-0" />
      <span>{text}</span>
    </div>
  );
}

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: "ok" | "info" | "warn" | "muted";
}) {
  const cls =
    tone === "ok"
      ? "bg-emerald-900/30 text-emerald-200 border-emerald-700/40"
      : tone === "warn"
      ? "bg-amber-900/30 text-amber-200 border-amber-700/40"
      : tone === "info"
      ? "bg-sky-900/30 text-sky-200 border-sky-700/40"
      : "bg-[#1a1a25] text-[#A1A1AA] border-[#252538]";
  return (
    <span
      className={`inline-block rounded-md border px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${cls}`}
    >
      {label}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const tone = severityTone(severity);
  const cls =
    tone === "warn"
      ? "bg-amber-900/30 text-amber-200 border-amber-700/40"
      : tone === "info"
      ? "bg-sky-900/30 text-sky-200 border-sky-700/40"
      : "bg-[#1a1a25] text-[#A1A1AA] border-[#252538]";
  return (
    <span
      className={`shrink-0 inline-block rounded-md border px-1.5 py-0.5 text-[9px] uppercase tracking-wide leading-tight ${cls}`}
    >
      {humanSeverity(severity)}
    </span>
  );
}

function EnvelopeCard({
  bundle,
}: {
  bundle: NonNullable<FormDetailBundle["envelope"]>;
}) {
  const e = bundle.envelope!;
  const recipients = Array.isArray(e.recipient_snapshot) ? e.recipient_snapshot : [];
  return (
    <div className="rounded-md border border-[#1a1a2e] bg-[#0b0b10] px-3 py-2 text-xs space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wide text-[#71717A]">
          Status
        </span>
        <span className="text-[#F1F1F3] font-medium">{e.status}</span>
      </div>
      {recipients.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wide text-[#71717A] mb-1">
            Recipients ({recipients.length})
          </div>
          <ul className="space-y-1 text-[11px] text-[#A1A1AA]">
            {recipients.map((r, i) => (
              <li key={`${r.email ?? ""}-${i}`} className="flex items-center gap-2">
                <span className="text-[10px] text-[#71717A] uppercase tracking-wide w-12 shrink-0">
                  {r.role ?? "—"}
                </span>
                <span className="truncate text-[#F1F1F3]">
                  {r.name ?? r.email ?? "—"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 text-[10px] text-[#71717A]">
        {e.sent_at && <span>Sent {relativeUpdated(e.sent_at)}</span>}
        {e.viewed_at && <span>Viewed {relativeUpdated(e.viewed_at)}</span>}
        {e.completed_at && <span>Completed {relativeUpdated(e.completed_at)}</span>}
        {e.declined_at && (
          <span className="text-amber-300/80">
            Declined {relativeUpdated(e.declined_at)}
          </span>
        )}
        {e.voided_at && (
          <span className="text-amber-300/80">
            Voided {relativeUpdated(e.voided_at)}
          </span>
        )}
      </div>
      {(e.decline_reason || e.void_reason) && (
        <p className="text-[11px] text-amber-200/80 leading-relaxed">
          {e.decline_reason ?? e.void_reason}
        </p>
      )}
    </div>
  );
}
