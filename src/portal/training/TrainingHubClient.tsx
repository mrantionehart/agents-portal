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
  Award,
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

// ── PILOT-IA-1 Training catalog information architecture ──────────────────
// Reorganize the Training tab into a Platform Certification hero followed
// by four themed sections. Reduces first-visit cognitive overload by making
// the recommended starting point obvious. Card component, permissions,
// links, search, and progress are unchanged — only the arrangement.
//
// Volume 4 modules are subsumed by the hero card (Platform Certification is
// the whole V4 track) and are NOT rendered as individual cards in the
// categorized sections. Every other module is placed in exactly one section
// via title-substring matching (permissive — minor punctuation drift in the
// DB doesn't drop a module). Anything unmatched falls into an "Other"
// fallback section rendered at the bottom so nothing is silently hidden.
//
// During an active search the hero is hidden (it's a nav aid, not a search
// result) and each section shows only its matching items.

interface CatalogSection {
  key: string;
  label: string;
  patterns: string[];
}

const CATALOG_SECTIONS: CatalogSection[] = [
  {
    key: "getting-started",
    label: "🏠 Getting Started",
    patterns: [
      "Ready Foundations",
      "New Agent Playbook",
      "EASE Training",
    ],
  },
  {
    key: "residential",
    label: "🏡 Residential Sales",
    patterns: [
      "Lead Generation",
      "Listings Mastery",
      "Buyer's Journey",
      "Showing Playbook",
      "Transaction Process",
      "Marketing & Branding",
      "Growth, Mindset",
      "Client Acquisition",
    ],
  },
  {
    key: "investing",
    label: "🏢 Investing & Development",
    patterns: [
      "Investor Mindset",
      "Wholesaling",
      "Zoning",
      "Luxury Market",
      "Capital, Finance",
      "Elite Mastery",
    ],
  },
  {
    key: "ai-academy",
    label: "🤖 AI Academy",
    patterns: [
      "AI for Real Estate",
      "AI Mindset",
      "ChatGPT vs Claude",
      "Prompting Like a Pro",
      "Real Estate Use Cases",
      "Daily AI Workflow",
      "AI Roleplay",
      "What Not to Do",
      "Making Money with AI",
    ],
  },
];

/** True when the module belongs to the Platform Certification hero. */
function isPlatformCertification(item: HubItem): boolean {
  return item.category === "Volume 4";
}

/** Return the section key for a module title, or null if unmatched.
 *  Case-insensitive substring match; patterns are checked in order and the
 *  first section with any matching pattern wins. */
function classifyBySectionKey(item: HubItem): string | null {
  const titleLower = item.title.toLowerCase();
  for (const section of CATALOG_SECTIONS) {
    for (const pattern of section.patterns) {
      if (titleLower.includes(pattern.toLowerCase())) {
        return section.key;
      }
    }
  }
  return null;
}

/** Bucket a training item list into hero + section-keyed lists +
 *  uncategorized fallback. Every input item appears in exactly one bucket. */
export function partitionTrainingCatalog(items: HubItem[]): {
  hero: HubItem[];
  sections: Map<string, HubItem[]>;
  uncategorized: HubItem[];
} {
  const hero: HubItem[] = [];
  const sections = new Map<string, HubItem[]>();
  const uncategorized: HubItem[] = [];
  for (const s of CATALOG_SECTIONS) sections.set(s.key, []);
  for (const it of items) {
    if (isPlatformCertification(it)) {
      hero.push(it);
      continue;
    }
    const key = classifyBySectionKey(it);
    if (key) {
      sections.get(key)!.push(it);
    } else {
      uncategorized.push(it);
    }
  }
  return { hero, sections, uncategorized };
}

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
            <CategorizedTraining
              items={visibleTraining}
              searchActive={search.trim().length > 0}
            />
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

// ── PILOT-IA-1 Categorized Training render ───────────────────────────

function CategorizedTraining({
  items,
  searchActive,
}: {
  items: HubItem[];
  searchActive: boolean;
}) {
  const { hero, sections, uncategorized } = useMemo(
    () => partitionTrainingCatalog(items),
    [items],
  );

  // Hero represents the entire Platform Certification (all V4 modules).
  // Use the first V4 module (lowest sort_order — Portal Foundations) as
  // the click-through entry point. Aggregate simple completion signals
  // across all V4 modules for the "Start" vs "Continue" button state.
  const heroEntry = hero[0];
  const anyV4Started = hero.some((m) => (m.progress_pct ?? 0) > 0);
  const allV4Complete = hero.length > 0 && hero.every((m) => m.completed);

  const showHero = !searchActive && heroEntry != null;

  return (
    <div>
      {showHero && (
        <div
          className="
            rounded-lg border border-[#C9A84C]/40
            bg-gradient-to-br from-[#C9A84C]/10 via-[#C9A84C]/5 to-transparent
            p-7 sm:p-8 mb-8
          "
          data-testid="training-hero"
        >
          <div className="text-[11px] uppercase tracking-wider text-[#E8D5A3] mb-2">
            🏁 Begin Your HartFelt Journey
          </div>
          <div className="flex items-start gap-4">
            <Award className="h-7 w-7 text-[#C9A84C] shrink-0 mt-1" />
            <div className="min-w-0 flex-1">
              <h2 className="text-xl sm:text-2xl font-semibold text-[#F1F1F3]">
                🏆 Platform Certification
              </h2>
              <p className="text-sm sm:text-[15px] leading-relaxed text-[#A1A1AA] mt-3 max-w-prose">
                Master the HartFelt platform through interactive tours,
                practical exercises, simulations, and real-world workflows.
              </p>
              <div className="mt-4 text-[11px] uppercase tracking-wider text-[#71717A]">
                {hero.length} {hero.length === 1 ? "Learning Track" : "Learning Tracks"} • 32 Interactive Lessons
                {allV4Complete ? " · Completed" : anyV4Started ? " · In progress" : ""}
              </div>
              <a
                href={heroEntry.open_url}
                className="
                  inline-flex mt-6 items-center gap-1.5 rounded-md
                  bg-[#C9A84C] px-5 py-2.5 text-sm sm:text-[15px]
                  text-black font-semibold hover:brightness-95
                "
              >
                {allV4Complete
                  ? "Review Journey"
                  : anyV4Started
                  ? "Continue Journey →"
                  : "Begin Your Journey →"}
              </a>
            </div>
          </div>
        </div>
      )}

      {CATALOG_SECTIONS.map((s) => {
        const sectionItems = sections.get(s.key) ?? [];
        if (sectionItems.length === 0) return null;
        return (
          <div key={s.key} className="mb-6" data-testid={`training-section-${s.key}`}>
            <h3 className="text-sm font-semibold text-[#E8D5A3] mb-3">
              {s.label}
            </h3>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {sectionItems.map((it) => (
                <HubCard key={it.id} item={it} kind="training" />
              ))}
            </ul>
          </div>
        );
      })}

      {uncategorized.length > 0 && (
        <div className="mb-6" data-testid="training-section-uncategorized">
          <h3 className="text-sm font-semibold text-[#E8D5A3] mb-3">
            📚 Other
          </h3>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {uncategorized.map((it) => (
              <HubCard key={it.id} item={it} kind="training" />
            ))}
          </ul>
        </div>
      )}
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
