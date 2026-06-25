// ============================================================================
// AGENT PORTAL 2.1 — R2B — Detail-page client component
// ============================================================================
// Holds Copy-Link / Open-Portal state. Receives pre-fetched portal + views
// + feedback from the server component (no client DB calls). All other
// rendering is presentation-only.
//
// Read-only by spec — no archive / revoke / regenerate / edit / delete.
// ============================================================================

"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Check,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  Heart,
  Mail,
  MapPin,
  MessageSquare,
  User,
} from "lucide-react";

import type { DealPortalRow } from "./types";
import { formatPrice, relativeTime, shareUrl, statusLabel } from "./helpers";
import type {
  PortalFeedbackPayload,
  PortalFeedbackProperty,
  PortalViewRow,
} from "./detail-types";
import {
  buildActivityTimeline,
  maskEmail,
  sortViewsNewestFirst,
  summarizeFeedback,
} from "./detail-helpers";

export interface PortalDetailClientProps {
  portal: DealPortalRow & {
    share_url?: string;
    views?: PortalViewRow[];
    total_views?: number;
    last_viewed?: string | null;
  };
  feedback: PortalFeedbackPayload | null;
  feedbackError: string | null;
}

export default function PortalDetailClient({
  portal,
  feedback,
  feedbackError,
}: PortalDetailClientProps) {
  const [copied, setCopied] = useState(false);
  const summary = summarizeFeedback(feedback);
  const views = portal.views ?? [];
  const sortedViews = sortViewsNewestFirst(views);
  const timeline = buildActivityTimeline(views, feedback);

  const url = shareUrl(portal);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link:", url);
    }
  }

  function handleOpen() {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div>
      <Link
        href="/workspace/portals"
        className="text-xs text-[#71717A] hover:text-[#A1A1AA] inline-flex items-center gap-1 mb-4"
      >
        <ArrowLeft className="h-3 w-3" /> Back to Portals
      </Link>

      {/* Header */}
      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-[#71717A]">
            Deal Portal
          </div>
          <h1 className="text-2xl font-semibold text-[#F1F1F3] truncate">
            {portal.title ?? "(untitled portal)"}
          </h1>
          <div className="text-sm text-[#A1A1AA] mt-0.5 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <StatusBadge status={portal.status} />
            {portal.client_name && (
              <span className="inline-flex items-center gap-1">
                <User className="h-3 w-3 text-[#71717A]" /> {portal.client_name}
              </span>
            )}
            {portal.client_email && (
              <span className="inline-flex items-center gap-1">
                <Mail className="h-3 w-3 text-[#71717A]" /> {portal.client_email}
              </span>
            )}
            {(portal.address || portal.city || portal.state) && (
              <span className="inline-flex items-center gap-1 text-[#71717A]">
                <MapPin className="h-3 w-3" />
                {[portal.address, portal.city, portal.state]
                  .filter(Boolean)
                  .join(", ")}
              </span>
            )}
          </div>
          <div className="text-xs text-[#71717A] mt-1">
            created {relativeTime(portal.created_at)}
            {formatPrice(portal.price) && ` · ${formatPrice(portal.price)}`}
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleCopy}
            className="
              inline-flex items-center gap-1 rounded-md
              border border-[#252538] bg-[#11111a]
              px-3 py-1.5 text-xs text-[#A1A1AA]
              hover:text-[#F1F1F3] hover:border-[#3a3a55]
              transition-colors duration-[180ms]
            "
            title="Copy share link"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-emerald-300" /> Copied
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" /> Copy Link
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleOpen}
            className="
              inline-flex items-center gap-1 rounded-md
              border border-[#C9A84C]/40 bg-[#C9A84C]/10
              px-3 py-1.5 text-xs text-[#E8D5A3]
              hover:bg-[#C9A84C]/15
              transition-colors duration-[180ms]
            "
            title="Open the public portal in a new tab"
          >
            <ExternalLink className="h-3 w-3" /> Open Portal
          </button>
        </div>
      </header>

      {/* Share URL preview */}
      <Section title="Share URL">
        <p className="text-xs text-[#A1A1AA] break-all font-mono">{url}</p>
      </Section>

      {/* Stat row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Stat label="View Count" value={String(portal.view_count ?? 0)} tone="info" />
        <Stat
          label="Last Viewed"
          value={relativeTime(portal.last_viewed ?? portal.last_viewed_at)}
          tone="muted"
        />
        <Stat label="Favorites" value={String(summary.totalFavorites)} tone="warn" />
        <Stat label="Comments" value={String(summary.totalComments)} tone="ok" />
      </div>

      {/* Feedback */}
      <Section title="Client Feedback">
        {feedbackError ? (
          <div className="text-xs text-rose-300/80">
            Couldn&apos;t load feedback right now ({feedbackError}). Try
            reloading the page.
          </div>
        ) : !summary.hasFeedback ? (
          <EmptyState label="No feedback yet" hint="When clients open this portal and respond, their favorites and comments will appear here." />
        ) : (
          <ul className="space-y-3">
            {feedback!.properties.map((p) => (
              <FeedbackProperty key={p.title} prop={p} />
            ))}
          </ul>
        )}
      </Section>

      {/* Viewer activity timeline */}
      <Section title="Recent Activity">
        {timeline.length === 0 ? (
          <EmptyState label="No views yet" hint="The portal hasn't been opened yet. Once a client opens the link, recent views and responses will show up here." />
        ) : (
          <ul className="space-y-2">
            {timeline.slice(0, 30).map((evt, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-xs text-[#A1A1AA]"
              >
                {evt.kind === "view" && (
                  <>
                    <Eye className="h-3 w-3 text-[#71717A] mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-[#F1F1F3]">Portal viewed</span>
                      <span className="text-[#71717A]"> · {relativeTime(evt.ts)}</span>
                    </div>
                  </>
                )}
                {evt.kind === "comment" && (
                  <>
                    <MessageSquare className="h-3 w-3 text-emerald-400 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div>
                        <span className="text-[#F1F1F3]">{evt.name}</span>
                        <span className="text-[#71717A]"> commented on </span>
                        <span className="text-[#E8D5A3] truncate">{evt.property}</span>
                      </div>
                      <p className="text-[#A1A1AA] mt-0.5 italic">&ldquo;{evt.comment}&rdquo;</p>
                      <div className="text-[10px] text-[#71717A] mt-0.5">{relativeTime(evt.ts)}</div>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Raw views list (chronological, masked) */}
      {sortedViews.length > 0 && (
        <Section title="View Log">
          <ul className="space-y-1">
            {sortedViews.slice(0, 20).map((v) => (
              <li
                key={v.id}
                className="text-xs text-[#A1A1AA] flex items-center gap-2"
              >
                <Clock className="h-3 w-3 text-[#71717A] shrink-0" />
                <span>{new Date(v.viewed_at).toLocaleString()}</span>
                <span className="text-[#71717A]">· {relativeTime(v.viewed_at)}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <p className="mt-6 text-[11px] text-[#71717A]">
        Read-only view. Sharing remains copy-link only. To revoke or
        regenerate, open the portal from Vault.
      </p>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────

function FeedbackProperty({ prop }: { prop: PortalFeedbackProperty }) {
  return (
    <li className="rounded-lg border border-[#1a1a2e] bg-[#11111a] p-4">
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <span className="text-sm text-[#F1F1F3] font-medium truncate">
          {prop.title}
        </span>
        <span className="inline-flex items-center gap-1 text-xs text-amber-200">
          <Heart className="h-3 w-3" />
          {prop.favorites} favorite{prop.favorites === 1 ? "" : "s"}
        </span>
      </div>
      {prop.comments.length > 0 && (
        <ul className="mt-2 space-y-2">
          {prop.comments.map((c, i) => (
            <li key={i} className="text-xs text-[#A1A1AA]">
              <div className="flex items-baseline gap-1.5">
                <MessageSquare className="h-3 w-3 text-emerald-400 mt-0.5 shrink-0" />
                <span className="text-[#F1F1F3]">{c.name}</span>
                {c.email && (
                  <span className="text-[#71717A] font-mono text-[10px]">
                    {maskEmail(c.email)}
                  </span>
                )}
                <span className="ml-auto text-[10px] text-[#71717A]">
                  {relativeTime(c.date)}
                </span>
              </div>
              <p className="ml-4.5 mt-1 italic">&ldquo;{c.comment}&rdquo;</p>
            </li>
          ))}
        </ul>
      )}
      {prop.respondents.length > 0 && (
        <div className="mt-2 text-[10px] text-[#71717A]">
          {prop.respondents.length} respondent
          {prop.respondents.length === 1 ? "" : "s"}
        </div>
      )}
    </li>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-[#1a1a2e] bg-[#11111a] p-5 mb-4">
      <h2 className="text-xs uppercase tracking-wider text-[#71717A] mb-3">{title}</h2>
      {children}
    </section>
  );
}

function EmptyState({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="text-center py-6">
      <div className="text-sm text-[#A1A1AA]">{label}</div>
      <div className="text-xs text-[#71717A] mt-1 max-w-md mx-auto leading-relaxed">{hint}</div>
    </div>
  );
}

type Tone = "ok" | "info" | "warn" | "muted";

function Stat({ label, value, tone }: { label: string; value: string; tone: Tone }) {
  const v =
    tone === "ok" ? "text-emerald-300" :
    tone === "info" ? "text-sky-300" :
    tone === "warn" ? "text-amber-300" :
    "text-[#F1F1F3]";
  return (
    <div className="rounded-lg border border-[#1a1a2e] bg-[#11111a] px-3 py-2.5">
      <div className={`text-2xl font-semibold tabular-nums leading-none ${v}`}>{value}</div>
      <div className="text-[11px] text-[#71717A] mt-1">{label}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  const s = (status ?? "").toLowerCase();
  const cls =
    s === "active"
      ? "bg-emerald-900/30 text-emerald-200 border-emerald-700/40"
      : s === "archived"
      ? "bg-[#1a1a25] text-[#A1A1AA] border-[#252538]"
      : s === "draft"
      ? "bg-amber-900/30 text-amber-200 border-amber-700/40"
      : "bg-[#1a1a25] text-[#A1A1AA] border-[#252538]";
  return (
    <span className={`inline-block rounded-md border px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${cls}`}>
      {statusLabel(status)}
    </span>
  );
}
