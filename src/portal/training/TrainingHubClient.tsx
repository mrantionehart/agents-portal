// ============================================================================
// AGENT PORTAL 2.1 — R5 — Training Hub client component
// ============================================================================
// Renders the three tabs (Training | Script Library | Resources) +
// unified search. Receives pre-loaded items from the server component
// (zero DB calls here). Each item card is a `<a>` deep-link to the
// existing legacy page — the engines (video player, script viewer,
// resource downloads) stay where they are.
//
// READ-ONLY — no <button onClick> that mutates state on the server,
// no forms, no uploads. The only "actions" are filter chip toggles
// (local state) and the search input (local state).
// ============================================================================

"use client";

import { useMemo, useState } from "react";
import {
  BookOpen,
  ExternalLink,
  FileText,
  GraduationCap,
  PlayCircle,
  Search,
  ScrollText,
  Sparkles,
} from "lucide-react";

import type { ContinueWatching, HubItem, HubTab } from "./types";
import {
  applyHubFilters,
  hubCounts,
  progressLabel,
  tabLabel,
} from "./helpers";

export interface TrainingHubClientProps {
  training: HubItem[];
  scripts: HubItem[];
  resources: HubItem[];
  continueWatching: ContinueWatching | null;
  initialTab: HubTab;
  error: string | null;
}

export default function TrainingHubClient({
  training,
  scripts,
  resources,
  continueWatching,
  initialTab,
  error,
}: TrainingHubClientProps) {
  const [tab, setTab] = useState<HubTab>(initialTab);
  const [search, setSearch] = useState("");

  const counts = useMemo(
    () => hubCounts({ training, scripts, resources }),
    [training, scripts, resources]
  );

  const visibleTraining = useMemo(
    () => applyHubFilters(training, { tab: "training", search }),
    [training, search]
  );
  const visibleScripts = useMemo(
    () => applyHubFilters(scripts, { tab: "scripts", search }),
    [scripts, search]
  );
  const visibleResources = useMemo(
    () => applyHubFilters(resources, { tab: "resources", search }),
    [resources, search]
  );

  return (
    <div>
      {error && (
        <div className="rounded-lg border border-rose-700/40 bg-rose-900/20 px-3 py-2 text-xs text-rose-200 mb-4">
          Couldn&apos;t load training progress ({error}). Script Library and
          Resources remain available below.
        </div>
      )}

      {/* Tab strip */}
      <nav
        aria-label="Training hub view"
        className="
          inline-flex rounded-md border border-[#1a1a2e] bg-[#0b0b10]
          p-0.5 text-xs mb-4 flex-wrap
        "
      >
        <Tab
          label={`Training (${counts.training})`}
          Icon={GraduationCap}
          active={tab === "training"}
          onClick={() => setTab("training")}
        />
        <Tab
          label={`Script Library (${counts.scripts})`}
          Icon={ScrollText}
          active={tab === "scripts"}
          onClick={() => setTab("scripts")}
        />
        <Tab
          label={`Resources (${counts.resources})`}
          Icon={BookOpen}
          active={tab === "resources"}
          onClick={() => setTab("resources")}
        />
      </nav>

      {/* Unified search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#71717A]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search title, category, or description across all tabs…"
          className="
            w-full rounded-md border border-[#1a1a2e] bg-[#0b0b10]
            pl-9 pr-3 py-2 text-sm text-[#F1F1F3]
            placeholder:text-[#71717A]
            focus:outline-none focus:border-[#252538]
          "
        />
      </div>

      {/* ── Training tab ─────────────────────────────────────────── */}
      {tab === "training" && (
        <section>
          {continueWatching && (
            <div className="rounded-lg border border-[#C9A84C]/40 bg-[#C9A84C]/10 px-4 py-3 mb-4 flex items-center gap-3">
              <PlayCircle className="h-5 w-5 text-[#E8D5A3] shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-[10px] uppercase tracking-wider text-[#E8D5A3]">
                  Continue watching
                </div>
                <div className="text-sm text-[#F1F1F3] truncate">
                  {continueWatching.title}
                </div>
                <div className="text-[11px] text-[#A1A1AA]">
                  {continueWatching.category} · {continueWatching.progress_pct}% complete
                </div>
              </div>
              <a
                href={continueWatching.open_url}
                className="
                  inline-flex items-center gap-1 rounded-md
                  border border-[#C9A84C]/40 bg-[#C9A84C]/15
                  px-3 py-1.5 text-xs text-[#E8D5A3]
                  hover:bg-[#C9A84C]/20
                "
              >
                <ExternalLink className="h-3 w-3" /> Resume
              </a>
            </div>
          )}

          {visibleTraining.length === 0 ? (
            <EmptyState
              tab="training"
              hasAny={training.length > 0}
              search={search}
            />
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {visibleTraining.map((it) => (
                <HubCard key={it.id} item={it} kind="training" />
              ))}
            </ul>
          )}
        </section>
      )}

      {/* ── Script Library tab ───────────────────────────────────── */}
      {tab === "scripts" && (
        <section>
          {visibleScripts.length === 0 ? (
            <EmptyState
              tab="scripts"
              hasAny={scripts.length > 0}
              search={search}
            />
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {visibleScripts.map((it) => (
                <HubCard key={it.id} item={it} kind="scripts" />
              ))}
            </ul>
          )}
        </section>
      )}

      {/* ── Resources tab ────────────────────────────────────────── */}
      {tab === "resources" && (
        <section>
          {visibleResources.length === 0 ? (
            <EmptyState
              tab="resources"
              hasAny={resources.length > 0}
              search={search}
            />
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {visibleResources.map((it) => (
                <HubCard key={it.id} item={it} kind="resources" />
              ))}
            </ul>
          )}
        </section>
      )}

      <p className="mt-6 text-[11px] text-[#71717A]">
        Read-only hub. Video playback, script content, and resource downloads
        open the existing legacy surfaces unchanged.
      </p>
    </div>
  );
}

// ── Card ─────────────────────────────────────────────────────────────

function HubCard({
  item,
  kind,
}: {
  item: HubItem;
  kind: HubTab;
}) {
  const Icon =
    kind === "training" ? PlayCircle : kind === "scripts" ? ScrollText : FileText;
  return (
    <li>
      <a
        href={item.open_url}
        className="
          block rounded-lg border border-[#1a1a2e] bg-[#11111a]
          p-4 hover:border-[#252538] hover:bg-[#1a1a25]
          transition-colors duration-[180ms]
        "
      >
        <div className="flex items-start gap-3">
          <Icon className="h-4 w-4 text-[#71717A] shrink-0 mt-1" />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="truncate text-sm font-medium text-[#F1F1F3]">
                {item.title}
              </span>
              <span className="text-[10px] text-[#71717A] uppercase tracking-wide">
                {item.category}
              </span>
              {kind === "training" && (item.progress_pct != null || item.completed) && (
                <ProgressBadge pct={item.progress_pct} completed={item.completed} />
              )}
            </div>
            {item.description && (
              <p className="text-xs text-[#A1A1AA] mt-1 line-clamp-2">
                {item.description}
              </p>
            )}
            <div className="mt-2 text-[11px] text-[#E8D5A3] inline-flex items-center gap-1">
              <ExternalLink className="h-3 w-3" /> Open
            </div>
          </div>
        </div>
      </a>
    </li>
  );
}

function ProgressBadge({ pct, completed }: { pct?: number; completed?: boolean }) {
  const label = progressLabel(pct, completed);
  const cls = completed
    ? "bg-emerald-900/30 text-emerald-200 border-emerald-700/40"
    : (pct ?? 0) > 0
    ? "bg-sky-900/30 text-sky-200 border-sky-700/40"
    : "bg-[#1a1a25] text-[#A1A1AA] border-[#252538]";
  return (
    <span className={`inline-block rounded-md border px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${cls}`}>
      {label}
    </span>
  );
}

// ── Tab atom ─────────────────────────────────────────────────────────

function Tab({
  label,
  Icon,
  active,
  onClick,
}: {
  label: string;
  Icon: typeof GraduationCap;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`
        inline-flex items-center gap-1.5 px-3 py-1.5 rounded
        transition-colors duration-[180ms]
        ${active
          ? "bg-[#C9A84C]/15 text-[#E8D5A3] border border-[#C9A84C]/40"
          : "text-[#A1A1AA] hover:text-[#F1F1F3] border border-transparent"
        }
      `}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

// ── Empty state ──────────────────────────────────────────────────────

function EmptyState({
  tab,
  hasAny,
  search,
}: {
  tab: HubTab;
  hasAny: boolean;
  search: string;
}) {
  return (
    <div className="rounded-lg border border-[#1a1a2e] bg-[#11111a] py-10 text-center text-sm">
      {search.trim() ? (
        <>
          <Sparkles className="h-4 w-4 text-[#71717A] mx-auto mb-2" />
          <p className="text-[#A1A1AA]">
            No {tabLabel(tab)} items match &ldquo;{search}&rdquo;.
          </p>
          <p className="text-xs text-[#71717A] mt-1">
            Try a different search or switch tabs.
          </p>
        </>
      ) : !hasAny ? (
        <>
          <p className="text-[#A1A1AA]">
            No {tabLabel(tab)} items available yet.
          </p>
          <p className="text-xs text-[#71717A] mt-1">
            Content from the legacy surfaces will surface here once it ships.
          </p>
        </>
      ) : (
        <p className="text-[#A1A1AA]">No items in this view.</p>
      )}
    </div>
  );
}
