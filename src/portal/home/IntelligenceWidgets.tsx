// ============================================================================
// AGENT PORTAL 2.1 — R6 — Home Intelligence widgets
// ============================================================================
// Six read-only widgets that compose the new Home intelligence layout.
// All server-rendered — no `use client` directive — and every action
// is a plain <a href> deep-link. No buttons, no claim flow, no
// conversion, no mutations.
// ============================================================================

import Link from "next/link";
import {
  AlertCircle,
  Building2,
  Calendar,
  ExternalLink,
  FileCheck2,
  Hand,
  Inbox,
  LineChart,
  MapPin,
  Newspaper,
  Sparkles,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";

import type {
  HotLeadItem,
  NewsArticle,
  OpportunityItem,
  PipelineSnapshot,
  ProductionSnapshot,
  RadarDevelopment,
} from "./intelligence-types";
import {
  formatPrice,
  leadKindLabel,
  relativeTime,
} from "./intelligence-helpers";
import type { WorkspaceCard } from "../workspace/types";

// ── W3.4.6.4 — Recommended Actions pure helpers ────────────────────
//
// These helpers exist so the widget's projection is testable without a
// React renderer. The widget itself is server-rendered and pure.

export interface RecommendedActionItem {
  transaction_id: string;
  property_address: string | null;
  client_name: string | null;
  label: string;
  blocker: boolean;
  drill_url: string;
  /** Coach-side kind so downstream icon mapping can branch without
   *  recomputing anything. */
  kind: string;
  // AGENT.SIGN.1E.2 — richer card fields (kind-derived, optional).
  recommended_action?: string;
  estimated_time?: string;
}

/**
 * Project a list of workspace cards into the Recommended Actions
 * widget shape. Pure. Read-only. Returns ONLY cards whose Vault-
 * produced `coach_recommendation` is non-null. Blockers come first,
 * then non-blockers — natural urgency ordering with no derivation.
 */
export function pickRecommendedActions(
  cards: ReadonlyArray<WorkspaceCard>
): RecommendedActionItem[] {
  const out: RecommendedActionItem[] = [];
  for (const c of cards) {
    const r = c.coach_recommendation;
    if (!r) continue;
    out.push({
      transaction_id: c.transaction_id,
      property_address: c.property_address,
      client_name: c.client_name,
      label: r.title ?? r.label,
      blocker: r.blocker,
      drill_url: r.drill_url,
      kind: r.kind,
      recommended_action: r.recommended_action,
      estimated_time: r.estimated_time,
    });
  }
  // Stable sort: blockers first, otherwise preserve incoming order.
  out.sort((a, b) => Number(b.blocker) - Number(a.blocker));
  return out;
}

// ── Common atoms ────────────────────────────────────────────────────

function WidgetShell({
  title,
  icon: Icon,
  href,
  children,
  hint,
}: {
  title: string;
  icon: typeof Newspaper;
  href?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-[#1a1a2e] bg-[#11111a] p-4">
      <header className="flex items-baseline justify-between gap-2 mb-3">
        <h2 className="text-xs uppercase tracking-wider text-[#71717A] inline-flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 text-[#C9A84C]" />
          {title}
        </h2>
        {href && (
          <Link
            href={href}
            className="text-[10px] text-[#A1A1AA] hover:text-[#F1F1F3]"
          >
            View all →
          </Link>
        )}
      </header>
      {children}
      {hint && (
        <p className="mt-2 text-[10px] text-[#71717A]">{hint}</p>
      )}
    </section>
  );
}

function WidgetEmpty({ message, hint }: { message: string; hint?: string }) {
  return (
    <div className="rounded-md border border-[#1a1a2e] bg-[#0b0b10] py-6 text-center text-xs">
      <p className="text-[#A1A1AA]">{message}</p>
      {hint && <p className="text-[#71717A] mt-1">{hint}</p>}
    </div>
  );
}

function WidgetError({ source, message }: { source: string; message: string }) {
  return (
    <div className="rounded-md border border-rose-700/40 bg-rose-900/20 px-3 py-2 text-xs text-rose-200 mb-2 flex items-center gap-1.5">
      <AlertCircle className="h-3 w-3" />
      {source} unavailable ({message}).
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "ok" | "info" | "warn" | "muted";
}) {
  const v =
    tone === "ok"
      ? "text-emerald-300"
      : tone === "info"
      ? "text-sky-300"
      : tone === "warn"
      ? "text-amber-300"
      : "text-[#A1A1AA]";
  return (
    <div className="rounded-md border border-[#1a1a2e] bg-[#0b0b10] px-2 py-2 text-center">
      <div className={`text-xl font-semibold tabular-nums leading-none ${v}`}>{value}</div>
      <div className="text-[9px] uppercase tracking-wide text-[#71717A] mt-1">{label}</div>
    </div>
  );
}

// ── 1. Market News ─────────────────────────────────────────────────

export function MarketNewsWidget({
  articles,
  error,
}: {
  articles: NewsArticle[];
  error: string | null;
}) {
  return (
    <WidgetShell title="Market News" icon={Newspaper} href="/news">
      {error && <WidgetError source="News" message={error} />}
      {articles.length === 0 ? (
        <WidgetEmpty
          message="No market headlines right now."
          hint="The news feed updates every 15 minutes."
        />
      ) : (
        <ul className="space-y-2">
          {articles.slice(0, 5).map((a, i) => (
            <li key={i} className="text-xs">
              <a
                href={a.link}
                target="_blank"
                rel="noopener noreferrer"
                className="block hover:bg-[#1a1a25] rounded-md px-2 py-1.5 -mx-2 transition-colors duration-[180ms]"
              >
                <div className="flex items-start gap-2">
                  <ExternalLink className="h-3 w-3 text-[#71717A] shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[#F1F1F3] line-clamp-2 leading-snug">
                      {a.title}
                    </div>
                    {a.description && (
                      <p className="text-[#71717A] mt-0.5 line-clamp-1 leading-relaxed">
                        {a.description}
                      </p>
                    )}
                    <div className="text-[10px] text-[#71717A] mt-1 flex items-center gap-2">
                      <span>{a.source}</span>
                      <span>·</span>
                      <span>{relativeTime(a.pubDate)}</span>
                    </div>
                  </div>
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </WidgetShell>
  );
}

// ── 2. Development Radar ───────────────────────────────────────────

export function DevelopmentRadarWidget({
  developments,
  error,
}: {
  developments: RadarDevelopment[];
  error: string | null;
}) {
  return (
    <WidgetShell title="Development Radar" icon={Building2} href="/development-radar">
      {error && <WidgetError source="Radar" message={error} />}
      {developments.length === 0 ? (
        <WidgetEmpty
          message="No developments on the radar right now."
          hint="New approvals and pre-sales surface here as soon as they're filed."
        />
      ) : (
        <ul className="space-y-2">
          {developments.slice(0, 5).map((d) => (
            <li key={d.id} className="text-xs">
              <Link
                href={`/development-radar#${d.id}`}
                className="block hover:bg-[#1a1a25] rounded-md px-2 py-1.5 -mx-2 transition-colors duration-[180ms]"
              >
                <div className="flex items-start gap-2">
                  <Building2 className="h-3 w-3 text-[#71717A] shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[#F1F1F3] truncate font-medium">
                      {d.project_name}
                    </div>
                    <div className="text-[#A1A1AA] mt-0.5 flex flex-wrap items-center gap-x-2">
                      {d.city && (
                        <span className="inline-flex items-center gap-0.5">
                          <MapPin className="h-2.5 w-2.5 text-[#71717A]" />
                          {d.city}
                        </span>
                      )}
                      {d.units != null && <span>{d.units} units</span>}
                      {d.asset_type && (
                        <span className="text-[#71717A]">{d.asset_type}</span>
                      )}
                    </div>
                    {d.status && (
                      <div className="text-[10px] text-[#71717A] mt-0.5 uppercase tracking-wide">
                        {d.status}
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </WidgetShell>
  );
}

// ── 3. Opportunities ───────────────────────────────────────────────

export function OpportunitiesWidget({
  opportunities,
}: {
  opportunities: OpportunityItem[];
}) {
  return (
    <WidgetShell title="Opportunities" icon={Sparkles} href="/opportunities">
      {opportunities.length === 0 ? (
        <WidgetEmpty
          message="No opportunities surfaced yet."
          hint="When a curated investor or off-market deal is published, it appears here."
        />
      ) : (
        <ul className="space-y-2">
          {opportunities.slice(0, 5).map((o) => (
            <li key={o.id} className="text-xs">
              <div className="rounded-md px-2 py-1.5 -mx-2">
                <div className="text-[#F1F1F3] truncate">{o.title}</div>
                <div className="text-[#A1A1AA] mt-0.5 flex flex-wrap items-center gap-x-2">
                  {o.city && (
                    <span className="inline-flex items-center gap-0.5">
                      <MapPin className="h-2.5 w-2.5 text-[#71717A]" />
                      {o.city}
                    </span>
                  )}
                  {o.type && <span>{o.type}</span>}
                  {formatPrice(o.asking_price) && (
                    <span className="text-[#E8D5A3]">
                      {formatPrice(o.asking_price)}
                    </span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </WidgetShell>
  );
}

// ── 4. Hot Leads ───────────────────────────────────────────────────

export function HotLeadsWidget({
  leads,
  error,
}: {
  leads: HotLeadItem[];
  error: string | null;
}) {
  return (
    <WidgetShell
      title="Hot Leads"
      icon={Hand}
      href="/clients?tab=leads"
      hint="Read-only view. Claim and assignment actions live on the Leads tab."
    >
      {error && <WidgetError source="Leads" message={error} />}
      {leads.length === 0 ? (
        <WidgetEmpty
          message="No fresh leads or intakes yet."
          hint="When you're assigned a client, claim a lead, or a new intake comes in, it surfaces here."
        />
      ) : (
        <ul className="space-y-2">
          {leads.map((l) => {
            const Icon =
              l.kind === "assigned" ? UserCheck : l.kind === "claimed" ? Hand : Inbox;
            const inner = (
              <div className="flex items-start gap-2">
                <Icon className="h-3 w-3 text-[#71717A] shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-[#F1F1F3] truncate text-xs">
                      {l.name ?? "(unnamed)"}
                    </span>
                    <span className="text-[9px] uppercase tracking-wide text-[#71717A]">
                      {leadKindLabel(l.kind)}
                    </span>
                  </div>
                  {l.email && (
                    <div className="text-[10px] text-[#A1A1AA] truncate mt-0.5">
                      {l.email}
                    </div>
                  )}
                </div>
                <div className="shrink-0 text-[10px] text-[#71717A]">
                  {relativeTime(l.created_at)}
                </div>
              </div>
            );
            return (
              <li key={`${l.kind}-${l.id}`}>
                {l.open_url ? (
                  <Link
                    href={l.open_url}
                    className="block hover:bg-[#1a1a25] rounded-md px-2 py-1.5 -mx-2 transition-colors duration-[180ms]"
                  >
                    {inner}
                  </Link>
                ) : (
                  <div className="px-2 py-1.5 -mx-2">{inner}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </WidgetShell>
  );
}

// ── 5. Production Snapshot ─────────────────────────────────────────

export function ProductionSnapshotWidget({
  snapshot,
}: {
  snapshot: ProductionSnapshot;
}) {
  return (
    <WidgetShell title="Production Snapshot" icon={FileCheck2} href="/workspace">
      <div className="grid grid-cols-5 gap-2">
        <Stat label="Active" value={snapshot.active} tone="muted" />
        <Stat label="Review" value={snapshot.ready_for_review} tone="info" />
        <Stat label="Sign" value={snapshot.ready_for_signature} tone="ok" />
        <Stat
          label="Blocked"
          value={snapshot.blocked}
          tone={snapshot.blocked > 0 ? "warn" : "muted"}
        />
        <Stat label="Signed" value={snapshot.signed} tone="ok" />
      </div>
    </WidgetShell>
  );
}

// ── 6. Pipeline Snapshot ───────────────────────────────────────────

export function PipelineSnapshotWidget({
  snapshot,
}: {
  snapshot: PipelineSnapshot;
}) {
  return (
    <WidgetShell title="Pipeline Snapshot" icon={LineChart} href="/workspace">
      <div className="grid grid-cols-5 gap-2">
        <Stat label="Drafting" value={snapshot.drafting} tone="muted" />
        <Stat label="Collecting" value={snapshot.collecting} tone="muted" />
        <Stat label="Broker" value={snapshot.broker_review} tone="info" />
        <Stat label="Sign" value={snapshot.signature} tone="ok" />
        <Stat label="Done" value={snapshot.completed} tone="ok" />
      </div>
    </WidgetShell>
  );
}

// ── 7. Recommended Actions (W3.4.6.4) ──────────────────────────────
//
// Surfaces every WorkspaceCard whose Vault payload carries a non-null
// coach_recommendation. Pure presentation: every label / blocker flag
// / drill URL comes verbatim from the Vault-projected payload. No
// readiness math, no commission math, no blocker derivation.

export function RecommendedActionsWidget({
  cards,
}: {
  cards: ReadonlyArray<WorkspaceCard>;
}) {
  const items = pickRecommendedActions(cards);
  return (
    <WidgetShell title="Recommended Actions" icon={Sparkles} href="/workspace">
      {items.length === 0 ? (
        <WidgetEmpty
          message="No coaching actions right now."
          hint="The AI Coach surfaces a next step here whenever a deal needs your attention."
        />
      ) : (
        <ul className="space-y-2">
          {items.map((it) => (
            <li
              key={it.transaction_id}
              className="rounded-md border border-[#1a1a2e] bg-[#0b0b10] px-3 py-2 text-xs"
            >
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[#F1F1F3] font-medium truncate">
                      {it.property_address ?? it.client_name ?? "Transaction"}
                    </span>
                    {it.blocker ? (
                      <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-[#7a2a2a]/40 text-[#fca5a5] border border-[#7a2a2a]">
                        Blocker
                      </span>
                    ) : (
                      <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-[#7a5a2a]/40 text-[#facc15] border border-[#7a5a2a]">
                        Next step
                      </span>
                    )}
                  </div>
                  <div className="text-[#A1A1AA] mt-0.5 truncate">
                    {it.label}
                  </div>
                  {/* AGENT.SIGN.1E.2 — recommended action + est. time */}
                  {it.recommended_action && (
                    <div className="mt-0.5 text-[11px] text-[#C9A84C] truncate">
                      {it.recommended_action}
                      {it.estimated_time && it.estimated_time !== "—"
                        ? ` · ${it.estimated_time}`
                        : ""}
                    </div>
                  )}
                </div>
                <Link
                  href={it.drill_url}
                  className="text-[#C9A84C] hover:text-[#dbb86a] inline-flex items-center gap-1 shrink-0"
                >
                  Open <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </WidgetShell>
  );
}
