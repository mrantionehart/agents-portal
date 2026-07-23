// ============================================================================
// PAPERWORK UX-001 — Workflow-first Form Library (Agent Portal)
// ============================================================================
// Redesigns the flat category grid into "What are you doing today?" → workflow
// → the right forms. Presentation only: consumes the SAME Vault agent-templates
// list + the SAME per-form download endpoint (behavior unchanged), re-presented
// as agent-verb workflows over the existing `category` taxonomy. No document is
// moved, no form_id changes, no Vault API changes.
// ============================================================================

"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  FileText,
  FolderOpen,
  Search,
  Star,
} from "lucide-react";

import type { TemplateCard } from "./types";
import { WORKFLOWS, formsForWorkflow, annotationFor, type Workflow } from "./workflow-map";
import { groupIntoSections } from "./sections";
import { searchTemplates } from "./search";
import { getFavorites, getRecent, pushRecent, toggleFavorite } from "./local-store";
import { TemplateDownloadButton } from "./TemplateDownloadButton";

export interface LibraryClientProps {
  templates: TemplateCard[];
  error: string | null;
}

type View =
  | { kind: "home" }
  | { kind: "workflow"; workflow: Workflow }
  | { kind: "browse" }
  | { kind: "favorites" }
  | { kind: "recent" };

export default function LibraryClient({ templates, error }: LibraryClientProps) {
  const [view, setView] = useState<View>({ kind: "home" });
  const [query, setQuery] = useState("");
  const [browseCategory, setBrowseCategory] = useState("all");
  const [sessionExpired, setSessionExpired] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);

  // Load agent-personal favorites/recent from localStorage after hydration.
  useEffect(() => {
    setFavorites(getFavorites());
    setRecent(getRecent());
  }, []);

  const byId = useMemo(() => {
    const m = new Map<string, TemplateCard>();
    for (const t of templates) m.set(t.form_id, t);
    return m;
  }, [templates]);

  const categories = useMemo(() => {
    const s = new Set<string>();
    for (const t of templates) s.add(t.category);
    return Array.from(s).sort();
  }, [templates]);

  const onDownloaded = (formId: string) => setRecent(pushRecent(formId));
  const onToggleFavorite = (formId: string) => setFavorites(toggleFavorite(formId));

  // Search overrides the current view whenever the box is non-empty.
  const searching = query.trim().length > 0;
  const searchResults = useMemo(
    () => (searching ? searchTemplates(templates, query) : []),
    [searching, templates, query]
  );

  const cardProps = {
    favorites,
    onToggleFavorite,
    onDownloaded,
    onSessionExpired: () => setSessionExpired(true),
  };

  return (
    <div className="space-y-4">
      {sessionExpired && (
        <Banner tone="amber">
          Your sign-in expired. Reload the page to continue downloading.
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="ml-2 rounded-md border border-amber-700/60 bg-amber-900/40 px-2 py-0.5 text-[11px] font-medium text-amber-100 hover:bg-amber-900/60"
          >
            Reload
          </button>
        </Banner>
      )}
      {error && <Banner tone="rose">Couldn&apos;t load forms ({error}).</Banner>}

      {/* Search — always available */}
      <label className="relative block">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#71717A]" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search: form number, name, or plain language — e.g. “listing”, “hoa”, “seller financing”"
          className="w-full rounded-md border border-[#1a1a2e] bg-[#0b0b10] pl-7 pr-3 py-2 text-sm text-[#F1F1F3] placeholder:text-[#52525B] focus:outline-none focus:ring-1 focus:ring-[#E8D5A3]/40"
          aria-label="Search forms"
        />
      </label>

      {searching ? (
        <Section title={`Search results (${searchResults.length})`}>
          <FormGrid cards={searchResults} {...cardProps} />
        </Section>
      ) : view.kind === "home" ? (
        <Home
          templates={templates}
          favorites={favorites}
          recent={recent}
          onPick={(v) => setView(v)}
        />
      ) : view.kind === "workflow" ? (
        <WorkflowView
          workflow={view.workflow}
          templates={templates}
          onBack={() => setView({ kind: "home" })}
          {...cardProps}
        />
      ) : view.kind === "browse" ? (
        <BrowseAll
          templates={templates}
          categories={categories}
          category={browseCategory}
          setCategory={setBrowseCategory}
          onBack={() => setView({ kind: "home" })}
          {...cardProps}
        />
      ) : view.kind === "favorites" ? (
        <ListView
          title="⭐ Favorites"
          empty="No favorites yet. Tap the star on any form to pin it here."
          cards={favorites.map((id) => byId.get(id)).filter((x): x is TemplateCard => !!x)}
          onBack={() => setView({ kind: "home" })}
          {...cardProps}
        />
      ) : (
        <ListView
          title="🕒 Recently Used"
          empty="Nothing downloaded yet. Your last 5 downloads show up here."
          cards={recent.map((id) => byId.get(id)).filter((x): x is TemplateCard => !!x)}
          onBack={() => setView({ kind: "home" })}
          {...cardProps}
        />
      )}
    </div>
  );
}

// ── Home: "What are you doing today?" ────────────────────────────────────────

function Home({
  templates,
  favorites,
  recent,
  onPick,
}: {
  templates: TemplateCard[];
  favorites: string[];
  recent: string[];
  onPick: (v: View) => void;
}) {
  return (
    <div className="space-y-5">
      <h2 className="text-base font-semibold text-[#F1F1F3]">What are you doing today?</h2>
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
        {WORKFLOWS.map((w) => {
          const count = formsForWorkflow(templates, w).length;
          return (
            <button
              key={w.id}
              type="button"
              onClick={() => onPick({ kind: "workflow", workflow: w })}
              className="text-left rounded-xl border border-[#1a1a2e] bg-[#11111a] p-4 hover:border-[#E8D5A3]/40 hover:bg-[#15151f] transition-colors"
            >
              <div className="text-2xl">{w.emoji}</div>
              <div className="mt-2 text-sm font-semibold text-[#F1F1F3]">{w.label}</div>
              <div className="mt-0.5 text-xs text-[#A1A1AA]">{w.blurb}</div>
              <div className="mt-2 text-[10px] uppercase tracking-wide text-[#71717A]">
                {count} form{count === 1 ? "" : "s"}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        <Chip icon={<FolderOpen className="h-3.5 w-3.5" />} label="📄 Browse All Forms" onClick={() => onPick({ kind: "browse" })} />
        <Chip icon={<Star className="h-3.5 w-3.5" />} label={`⭐ Favorites (${favorites.length})`} onClick={() => onPick({ kind: "favorites" })} />
        <Chip label={`🕒 Recently Used (${recent.length})`} onClick={() => onPick({ kind: "recent" })} />
      </div>
    </div>
  );
}

// ── Workflow wizard/folder view ──────────────────────────────────────────────

function WorkflowView({
  workflow,
  templates,
  onBack,
  ...cardProps
}: {
  workflow: Workflow;
  templates: TemplateCard[];
  onBack: () => void;
} & CardCommon) {
  const sections = groupIntoSections(formsForWorkflow(templates, workflow), workflow.id);
  return (
    <div className="space-y-5">
      <Header emoji={workflow.emoji} title={workflow.label} subtitle={workflow.blurb} onBack={onBack} />
      {sections.length === 0 ? (
        <Empty>No forms are available for this workflow yet.</Empty>
      ) : (
        // Ordered sections read like the transaction (Contract → Buyer Rep → …).
        sections.map((s) => (
          <section key={s.id} className="space-y-2">
            {s.title && (
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[#E8D5A3]/80">
                {s.title}
              </h3>
            )}
            <ul className="grid gap-2 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
              {s.forms.map((t) => (
                <li key={t.form_id}>
                  <FormCard card={t} {...cardProps} showWhen />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

// ── Browse All (expert path — the original flat grid + category filter) ──────

function BrowseAll({
  templates,
  categories,
  category,
  setCategory,
  onBack,
  ...cardProps
}: {
  templates: TemplateCard[];
  categories: string[];
  category: string;
  setCategory: (c: string) => void;
  onBack: () => void;
} & CardCommon) {
  const filtered = category === "all" ? templates : templates.filter((t) => t.category === category);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Header emoji="📄" title="Browse All Forms" subtitle="Every form, by category." onBack={onBack} />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="Filter by category"
          className="rounded-md border border-[#1a1a2e] bg-[#0b0b10] px-3 py-2 text-sm text-[#F1F1F3] focus:outline-none focus:ring-1 focus:ring-[#E8D5A3]/40"
        >
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{formatCategory(c)}</option>
          ))}
        </select>
      </div>
      <FormGrid cards={filtered} {...cardProps} />
    </div>
  );
}

function ListView({
  title,
  empty,
  cards,
  onBack,
  ...cardProps
}: { title: string; empty: string; cards: TemplateCard[]; onBack: () => void } & CardCommon) {
  return (
    <div className="space-y-4">
      <Header title={title} onBack={onBack} />
      {cards.length === 0 ? <Empty>{empty}</Empty> : <FormGrid cards={cards} {...cardProps} />}
    </div>
  );
}

// ── Shared card rendering ────────────────────────────────────────────────────

interface CardCommon {
  favorites: string[];
  onToggleFavorite: (formId: string) => void;
  onDownloaded: (formId: string) => void;
  onSessionExpired: () => void;
}

function FormGrid({ cards, ...cardProps }: { cards: TemplateCard[] } & CardCommon) {
  if (cards.length === 0) return <Empty>No forms match.</Empty>;
  return (
    <ul className="grid gap-2 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((t) => (
        <li key={t.form_id}>
          <FormCard card={t} {...cardProps} />
        </li>
      ))}
    </ul>
  );
}

function FormCard({
  card: t,
  favorites,
  onToggleFavorite,
  onDownloaded,
  onSessionExpired,
  showWhen,
}: { card: TemplateCard; showWhen?: boolean } & CardCommon) {
  const ann = annotationFor(t.form_id);
  const isFav = favorites.includes(t.form_id);
  const helper =
    showWhen && ann?.requiredIf
      ? { label: "Required if", text: ann.requiredIf }
      : showWhen && ann?.use
        ? { label: "Use when", text: ann.use }
        : null;
  return (
    <div className="h-full rounded-lg border border-[#1a1a2e] bg-[#11111a] p-3 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {/* Title — largest; the eye lands here first */}
          <div className="flex items-start gap-1.5">
            <FileText className="h-4 w-4 text-[#71717A] shrink-0 mt-0.5" />
            <h4 className="text-[15px] font-semibold leading-snug text-[#F1F1F3]">{t.form_name}</h4>
          </div>
          {/* Form number — secondary */}
          <div className="mt-1 flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-[#A1A1AA]">{t.form_id}</span>
            {t.manual_only && <Tag tone="amber">Manual only</Tag>}
            {!t.active && !t.manual_only && <Tag tone="zinc">Inactive</Tag>}
          </div>
          {/* Category · revision — muted */}
          <div className="mt-0.5 text-[10px] uppercase tracking-wide text-[#71717A]">
            {formatCategory(t.category)}
            {t.revision ? ` · ${t.revision}` : ""}
          </div>
          {/* Helper text — plain-language guidance */}
          {ann?.blurb && <div className="mt-1.5 text-xs text-[#A1A1AA]">{ann.blurb}</div>}
          {helper && (
            <div className="mt-1 text-[11px] text-[#A1A1AA]">
              <span className="font-medium text-[#E8D5A3]/80">{helper.label}:</span> {helper.text}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => onToggleFavorite(t.form_id)}
          aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
          aria-pressed={isFav}
          className="shrink-0 rounded-md p-1 hover:bg-[#1a1a25]"
          title={isFav ? "Remove from favorites" : "Add to favorites"}
        >
          <Star className={`h-4 w-4 ${isFav ? "fill-[#E8D5A3] text-[#E8D5A3]" : "text-[#52525B]"}`} />
        </button>
      </div>
      <TemplateDownloadButton
        formId={t.form_id}
        onSessionExpired={onSessionExpired}
        onDownloaded={onDownloaded}
      />
    </div>
  );
}

// ── Small presentational helpers ─────────────────────────────────────────────

function Header({ emoji, title, subtitle, onBack }: { emoji?: string; title: string; subtitle?: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onBack}
        className="rounded-md border border-[#252538] bg-[#0b0b10] p-1.5 text-[#A1A1AA] hover:bg-[#1a1a25]"
        aria-label="Back to workflows"
      >
        <ArrowLeft className="h-4 w-4" />
      </button>
      <div>
        <div className="text-sm font-semibold text-[#F1F1F3]">
          {emoji ? `${emoji} ` : ""}{title}
        </div>
        {subtitle && <div className="text-xs text-[#A1A1AA]">{subtitle}</div>}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="text-xs uppercase tracking-wide text-[#71717A]">{title}</div>
      {children}
    </div>
  );
}

function Chip({ icon, label, onClick }: { icon?: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md border border-[#252538] bg-[#0b0b10] px-3 py-1.5 text-xs text-[#F1F1F3] hover:bg-[#1a1a25]"
    >
      {icon}
      {label}
    </button>
  );
}

function Tag({ tone, children }: { tone: "amber" | "zinc"; children: ReactNode }) {
  const cls =
    tone === "amber"
      ? "border-amber-700/40 bg-amber-900/20 text-amber-200"
      : "border-[#252538] bg-[#1a1a25] text-[#A1A1AA]";
  return <span className={`text-[10px] px-1.5 py-0.5 rounded-md border uppercase tracking-wide ${cls}`}>{children}</span>;
}

function Banner({ tone, children }: { tone: "amber" | "rose"; children: ReactNode }) {
  const cls =
    tone === "amber"
      ? "border-amber-700/40 bg-amber-900/20 text-amber-100"
      : "border-rose-700/40 bg-rose-900/20 text-rose-200";
  return (
    <div className={`rounded-lg border px-3 py-2 text-xs flex items-center gap-2 ${cls}`}>
      <AlertTriangle className="h-3 w-3 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-[#1a1a2e] bg-[#11111a] py-10 text-center">
      <p className="text-sm text-[#A1A1AA]">{children}</p>
    </div>
  );
}

function formatCategory(cat: string): string {
  return cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
