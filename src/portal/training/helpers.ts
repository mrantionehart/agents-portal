// ============================================================================
// AGENT PORTAL 2.1 — R5 — Training Hub helpers
// ============================================================================
// Pure functions: training-progress derivation, search composition,
// continue-watching selection, count summaries. No DB, no DOM, no
// fetch.
// ============================================================================

import type {
  ContinueWatching,
  HubItem,
  HubSearchFilters,
  HubTab,
  TrainingModuleRow,
  TrainingVideoProgressRow,
  TrainingVideoRow,
} from "./types";

/** Build a per-module progress row by joining videos + progress. */
export interface ModuleProgress {
  module_id: string;
  total_videos: number;
  completed_videos: number;
  progress_pct: number;
  completed: boolean;
}

export function deriveModuleProgress(
  videos: TrainingVideoRow[],
  progress: TrainingVideoProgressRow[]
): Map<string, ModuleProgress> {
  const byModule = new Map<string, { total: number; completed: number; videoIds: Set<string> }>();
  for (const v of videos) {
    const cur = byModule.get(v.module_id) ?? { total: 0, completed: 0, videoIds: new Set<string>() };
    cur.total += 1;
    cur.videoIds.add(v.id);
    byModule.set(v.module_id, cur);
  }
  const completedByVideo = new Map<string, boolean>();
  for (const p of progress) {
    if (p.completed) completedByVideo.set(p.video_id, true);
  }
  const out = new Map<string, ModuleProgress>();
  for (const [moduleId, info] of byModule) {
    let completed = 0;
    for (const vid of info.videoIds) {
      if (completedByVideo.get(vid)) completed += 1;
    }
    const total = info.total;
    const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
    out.set(moduleId, {
      module_id: moduleId,
      total_videos: total,
      completed_videos: completed,
      progress_pct: pct,
      completed: total > 0 && completed >= total,
    });
  }
  return out;
}

/**
 * Route a module to its detail page. Volume 1-3 continue to open the legacy
 * player at `/training-legacy#module-<id>`; Volume 4 opens the unified V4
 * learner experience at `/training/certified/<trackId>`. Any other volume
 * receives the inert `#` link (Next.js `Link` treats it as a no-op) so a
 * future volume without a registered destination fails safely rather than
 * silently routing to the legacy player.
 */
function moduleOpenUrl(m: TrainingModuleRow): string {
  if (m.volume === 4) return `/training/certified/${encodeURIComponent(m.id)}`;
  if (m.volume === 1 || m.volume === 2 || m.volume === 3) {
    return `/training-legacy#module-${m.id}`;
  }
  return "#";
}

/** Map training modules + progress into the unified HubItem shape. */
export function modulesToHubItems(
  modules: TrainingModuleRow[],
  progress: Map<string, ModuleProgress>
): HubItem[] {
  return modules
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((m) => {
      const p = progress.get(m.id);
      return {
        id: `training/module/${m.id}`,
        tab: "training" as const,
        title: m.title_en,
        category: `Volume ${m.volume}`,
        description: `Module ${m.module_num}${
          p && p.total_videos > 0 ? ` · ${p.completed_videos}/${p.total_videos} videos` : ""
        }`,
        open_url: moduleOpenUrl(m),
        progress_pct: p?.progress_pct,
        completed: p?.completed,
      };
    });
}

/** Pick the best "continue watching" card — the most-incomplete
 *  module the agent has made progress on. Returns null when nothing
 *  is in progress (handles fresh agents, fully-complete agents). */
export function pickContinueWatching(items: HubItem[]): ContinueWatching | null {
  // In progress = progress_pct > 0 AND < 100.
  const inProgress = items.filter(
    (it) => it.tab === "training" && (it.progress_pct ?? 0) > 0 && (it.progress_pct ?? 0) < 100
  );
  if (inProgress.length === 0) return null;
  // Highest progress wins (closest to completion).
  inProgress.sort((a, b) => (b.progress_pct ?? 0) - (a.progress_pct ?? 0));
  const top = inProgress[0];
  return {
    module_id: top.id,
    title: top.title,
    category: top.category,
    progress_pct: top.progress_pct ?? 0,
    open_url: top.open_url,
  };
}

// ── Search ──────────────────────────────────────────────────────────

function itemHaystack(it: HubItem): string {
  return [it.title, it.category, it.description ?? ""].join(" ").toLowerCase();
}

/** Apply tab + search filters to a single tab's item list. */
export function applyHubFilters(items: HubItem[], filters: HubSearchFilters): HubItem[] {
  const q = filters.search.trim().toLowerCase();
  return items.filter((it) => {
    if (filters.tab && it.tab !== filters.tab) return false;
    if (q && !itemHaystack(it).includes(q)) return false;
    return true;
  });
}

// ── Counts ──────────────────────────────────────────────────────────

export interface HubCounts {
  training: number;
  scripts: number;
  resources: number;
  total: number;
}

export function hubCounts(input: {
  training: HubItem[];
  scripts: HubItem[];
  resources: HubItem[];
}): HubCounts {
  return {
    training: input.training.length,
    scripts: input.scripts.length,
    resources: input.resources.length,
    total: input.training.length + input.scripts.length + input.resources.length,
  };
}

// ── Labels ──────────────────────────────────────────────────────────

export function tabLabel(t: HubTab | null): string {
  if (t === "training") return "Training";
  if (t === "scripts") return "Script Library";
  if (t === "resources") return "Resources";
  return "All";
}

export function progressLabel(pct: number | undefined, completed: boolean | undefined): string {
  if (completed) return "Completed";
  if (pct == null) return "—";
  if (pct === 0) return "Not Started";
  return `${pct}%`;
}
