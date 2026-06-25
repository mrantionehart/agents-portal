// ============================================================================
// AGENT PORTAL 2.0 — AP2.1D — Client Intelligence Panel
// ============================================================================
// Read-only display of client_profiles data for the transaction's
// client. Renders gracefully whether or not a profile exists, and never
// shows fields that don't have values. NO autofill into the transaction.
// NO writes. NO new tools.
// ============================================================================

import { Mail, MapPin, Phone, Sparkles, Target } from "lucide-react";

import type { ClientIntelligenceResult } from "./client-intelligence";
import { channelLabel, temperatureLabel } from "./client-intelligence";

interface Props {
  result: ClientIntelligenceResult;
  /** Display fallback from the WorkspaceCard when no profile exists. */
  fallbackClientName: string | null;
}

export default function ClientIntelligencePanel({ result, fallbackClientName }: Props) {
  if (result.kind === "no_match") {
    return (
      <section className="rounded-lg border border-[#1a1a2e] bg-[#11111a] p-5">
        <header className="flex items-center gap-2 mb-3">
          <Sparkles className="h-3.5 w-3.5 text-[#C9A84C]" />
          <h2 className="text-xs uppercase tracking-wider text-[#71717A]">
            Client Intelligence
          </h2>
        </header>
        <EmptyState reason={result.reason} fallbackName={fallbackClientName} />
      </section>
    );
  }

  const s = result.summary;

  return (
    <section className="rounded-lg border border-[#1a1a2e] bg-[#11111a] p-5">
      <header className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-[#C9A84C]" />
          <h2 className="text-xs uppercase tracking-wider text-[#71717A]">
            Client Intelligence
          </h2>
        </div>
        {s.temperature && s.temperature !== "—" && (
          <Badge tone={s.temperature === "hot" ? "warn" : "muted"}>
            {temperatureLabel(s.temperature)} lead
          </Badge>
        )}
      </header>

      {/* ── Summary ────────────────────────────────────────────── */}
      <div className="mb-4">
        <div className="text-base font-medium text-[#F1F1F3]">
          {s.full_name ?? fallbackClientName ?? "(unknown client)"}
        </div>
        {s.profile_type && (
          <div className="text-xs text-[#71717A] mt-0.5">
            {s.profile_type.replace(/_/g, " ")}
            {s.representation_status ? ` · ${s.representation_status}` : ""}
          </div>
        )}
      </div>

      {/* ── Contact ────────────────────────────────────────────── */}
      <Subsection title="Contact" empty={!s.email && !s.phone}>
        {s.email && <Row icon={<Mail className="h-3 w-3" />} value={s.email} />}
        {s.phone && <Row icon={<Phone className="h-3 w-3" />} value={s.phone} />}
      </Subsection>

      {/* ── Communication preferences ──────────────────────────── */}
      <Subsection
        title="Communication Preferences"
        empty={!s.preferred_channel && !s.preferred_contact_time}
      >
        {s.preferred_channel && (
          <Row label="Preferred channel" value={channelLabel(s.preferred_channel)} />
        )}
        {s.preferred_contact_time && (
          <Row label="Best time" value={s.preferred_contact_time} />
        )}
      </Subsection>

      {/* ── Investment / buying / selling preferences ──────────── */}
      <Subsection
        title="Preferences"
        empty={!s.budget_range && !s.timeline && s.target_areas.length === 0 && s.must_haves.length === 0}
      >
        {s.budget_range && <Row label="Budget" value={s.budget_range} />}
        {s.timeline && <Row label="Timeline" value={s.timeline} />}
        {s.target_areas.length > 0 && (
          <Row
            icon={<MapPin className="h-3 w-3" />}
            value={s.target_areas.join(", ")}
            label="Target areas"
          />
        )}
        {s.must_haves.length > 0 && (
          <Row
            icon={<Target className="h-3 w-3" />}
            value={s.must_haves.join(", ")}
            label="Must-haves"
          />
        )}
      </Subsection>

      {/* ── Notes / context ───────────────────────────────────── */}
      <Subsection title="Context" empty={!s.motivation}>
        {s.motivation && (
          <p className="text-sm text-[#A1A1AA] leading-relaxed">{s.motivation}</p>
        )}
      </Subsection>

      <p className="mt-4 text-[10px] text-[#71717A] leading-relaxed">
        Read-only summary from Client Intelligence. The Portal does not
        autofill transaction fields from this view — use the AI Assistant to
        propose changes; broker confirmation is required.
      </p>
    </section>
  );
}

// ── UI atoms ────────────────────────────────────────────────────────

type Tone = "warn" | "muted";

function Badge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  const cls =
    tone === "warn"
      ? "bg-amber-900/30 text-amber-200 border-amber-700/40"
      : "bg-[#1a1a25] text-[#A1A1AA] border-[#252538]";
  return (
    <span className={`inline-block rounded-md border px-2 py-0.5 text-[11px] ${cls}`}>
      {children}
    </span>
  );
}

function Subsection({
  title,
  empty,
  children,
}: {
  title: string;
  empty: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-4 last:mb-0">
      <div className="text-[10px] uppercase tracking-wider text-[#71717A] mb-1.5">
        {title}
      </div>
      {empty ? (
        <div className="text-xs text-[#71717A] italic">Not on file</div>
      ) : (
        <div className="space-y-1">{children}</div>
      )}
    </div>
  );
}

function Row({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label?: string;
  value: string;
}) {
  return (
    <div className="flex items-baseline gap-2 text-sm">
      {icon && <span className="text-[#71717A] shrink-0">{icon}</span>}
      {label && <span className="text-[#71717A] text-xs shrink-0">{label}</span>}
      <span className="text-[#F1F1F3] truncate">{value}</span>
    </div>
  );
}

function EmptyState({
  reason,
  fallbackName,
}: {
  reason: "no_email_or_name" | "no_matching_profile" | "access_denied";
  fallbackName: string | null;
}) {
  if (reason === "no_email_or_name") {
    return (
      <div className="text-sm text-[#A1A1AA]">
        No client identifiers on this transaction yet.
      </div>
    );
  }
  if (reason === "access_denied") {
    // We deliberately don't leak "exists but you can't see it" — show
    // the same neutral copy as "not on file."
    return (
      <div className="text-sm text-[#A1A1AA]">
        {fallbackName ? (
          <>
            <span className="text-[#F1F1F3]">{fallbackName}</span> has no intelligence on file.
          </>
        ) : (
          "No client intelligence on file."
        )}
      </div>
    );
  }
  return (
    <div className="text-sm text-[#A1A1AA]">
      {fallbackName ? (
        <>
          <span className="text-[#F1F1F3]">{fallbackName}</span> has no
          intelligence on file yet.
        </>
      ) : (
        "No client intelligence on file yet."
      )}
      <p className="mt-2 text-xs text-[#71717A]">
        Once a profile is created from the agent CRM, contact details and
        preferences will surface here.
      </p>
    </div>
  );
}
