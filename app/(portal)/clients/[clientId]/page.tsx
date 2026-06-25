// ============================================================================
// AGENT PORTAL 2.0 — AP2.1G — Client Detail
// ============================================================================
// Server-rendered. Returns notFound() for missing OR access-denied rows
// (deliberately conflated to avoid leaking existence). All fields are
// sanitized — broker-only fields are never read from the DB or rendered.
// ============================================================================

export const dynamic = "force-dynamic";

import Link from "next/link";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { notFound } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Mail,
  MapPin,
  Phone,
  Sparkles,
  Target,
} from "lucide-react";

import { loadClientDetail } from "@/src/portal/clients/loader";
import {
  channelLabel,
  profileTypeLabel,
  relativeUpdated,
  representationLabel,
  temperatureLabel,
} from "@/src/portal/clients/helpers";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
        set(_n: string, _v: string, _o: CookieOptions) { /* read-only */ },
        remove(_n: string, _o: CookieOptions) { /* read-only */ },
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return (
      <Shell clientId={clientId}>
        <ErrorBanner status={401} message="Sign in to view this client." />
      </Shell>
    );
  }

  const { data: prof } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .maybeSingle<{ role: string | null }>();
  const callerRole = prof?.role ?? "agent";

  const result = await loadClientDetail({
    supabase,
    callerId: session.user.id,
    callerRole,
    clientId,
  });

  if (result.kind === "not_found") notFound();
  if (result.kind === "error") {
    return (
      <Shell clientId={clientId}>
        <ErrorBanner status={500} message={result.message} />
      </Shell>
    );
  }

  const c = result.client;

  return (
    <Shell clientId={clientId}>
      {/* Header */}
      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-[#71717A]">
            Client
          </div>
          <h1 className="text-2xl font-semibold text-[#F1F1F3] truncate">
            {c.full_name ?? "(unknown client)"}
          </h1>
          <div className="text-sm text-[#A1A1AA] mt-0.5 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <span>{profileTypeLabel(c.profile_type)}</span>
            {representationLabel(c.representation_status) !== "—" && (
              <span>· {representationLabel(c.representation_status)}</span>
            )}
            <span>· updated {relativeUpdated(c.updated_at)}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {c.temperature && c.temperature !== "—" && (
            <Badge tone={c.temperature === "hot" ? "warn" : "info"}>
              {temperatureLabel(c.temperature)} lead
            </Badge>
          )}
        </div>
      </header>

      {/* Contact */}
      <Section title="Contact" empty={!c.email && !c.phone}>
        {c.email && <Row icon={<Mail className="h-3 w-3" />} value={c.email} />}
        {c.phone && <Row icon={<Phone className="h-3 w-3" />} value={c.phone} />}
      </Section>

      {/* Communication preferences */}
      <Section
        title="Communication Preferences"
        empty={!c.preferred_channel && !c.preferred_contact_time}
      >
        {c.preferred_channel && (
          <Row label="Preferred channel" value={channelLabel(c.preferred_channel)} />
        )}
        {c.preferred_contact_time && (
          <Row label="Best time" value={c.preferred_contact_time} />
        )}
      </Section>

      {/* Preferences */}
      <Section
        title="Preferences"
        empty={!c.budget_range && !c.timeline && c.target_areas.length === 0 && c.must_haves.length === 0}
      >
        {c.budget_range && <Row label="Budget" value={c.budget_range} />}
        {c.timeline && <Row label="Timeline" value={c.timeline} />}
        {c.target_areas.length > 0 && (
          <Row
            icon={<MapPin className="h-3 w-3" />}
            value={c.target_areas.join(", ")}
            label="Target areas"
          />
        )}
        {c.must_haves.length > 0 && (
          <Row
            icon={<Target className="h-3 w-3" />}
            value={c.must_haves.join(", ")}
            label="Must-haves"
          />
        )}
      </Section>

      {/* Notes / motivation */}
      <Section title="Notes / Motivation" empty={!c.motivation}>
        {c.motivation && (
          <p className="text-sm text-[#A1A1AA] leading-relaxed">{c.motivation}</p>
        )}
      </Section>

      {/* Linked transactions placeholder */}
      <Section title="Linked Transactions" empty={true}>
        <p className="text-xs text-[#71717A]">
          The Portal does not auto-link transactions to this profile yet.
          Open <Link href="/workspace" className="text-[#E8D5A3] hover:underline">Transactions</Link> to find this client&apos;s active deals.
        </p>
      </Section>

      <p className="mt-6 text-[11px] text-[#71717A]">
        Read-only summary. The Portal does not autofill transaction fields from
        this view — use the AI Assistant on the transaction; broker confirmation
        is required for every change.
      </p>
    </Shell>
  );
}

// ── Shell + atoms ────────────────────────────────────────────────────

function Shell({ clientId, children }: { clientId: string; children: React.ReactNode }) {
  return (
    <div>
      <Link
        href="/clients"
        className="text-xs text-[#71717A] hover:text-[#A1A1AA] inline-flex items-center gap-1 mb-4"
      >
        <ArrowLeft className="h-3 w-3" /> Back to Clients
      </Link>
      <div className="text-[10px] uppercase tracking-wider text-[#71717A] mb-1 flex items-center gap-1">
        <Sparkles className="h-3 w-3 text-[#C9A84C]" /> client intelligence · {clientId.slice(0, 8)}…
      </div>
      {children}
    </div>
  );
}

type Tone = "warn" | "info" | "muted";

function Badge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  const cls =
    tone === "warn"
      ? "bg-amber-900/30 text-amber-200 border-amber-700/40"
      : tone === "info"
      ? "bg-sky-900/30 text-sky-200 border-sky-700/40"
      : "bg-[#1a1a25] text-[#A1A1AA] border-[#252538]";
  return (
    <span className={`inline-block rounded-md border px-2 py-0.5 text-[11px] ${cls}`}>
      {children}
    </span>
  );
}

function Section({
  title,
  empty,
  children,
}: {
  title: string;
  empty: boolean;
  children?: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-[#1a1a2e] bg-[#11111a] p-5 mb-4">
      <h2 className="text-xs uppercase tracking-wider text-[#71717A] mb-2">{title}</h2>
      {empty ? (
        <div className="text-sm text-[#71717A] italic">Not on file</div>
      ) : (
        <div className="space-y-1">{children}</div>
      )}
    </section>
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

function ErrorBanner({ status, message }: { status: number; message: string }) {
  return (
    <div className="rounded-lg border border-rose-700/40 bg-rose-900/20 px-4 py-3 text-sm text-rose-200 flex items-start gap-2 mb-4">
      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <div className="font-medium">
          {status === 401
            ? "Please sign in to view this client."
            : `Couldn't load this client (HTTP ${status}).`}
        </div>
        {message && <div className="mt-1 text-[11px] text-rose-300/80 truncate">{message}</div>}
      </div>
    </div>
  );
}
