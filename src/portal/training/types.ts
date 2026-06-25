// ============================================================================
// AGENT PORTAL 2.1 — R5 — Training Hub types
// ============================================================================
// All three tabs (Training | Script Library | Resources) share a
// common HubItem shape: title, category, description, plus an
// open_url that deep-links to the existing legacy surface (so video
// playback, script playback, and resource downloads stay on the
// existing engines — we don't rebuild them here).
// ============================================================================

/** Which tab this item lives under. Drives filter chips + section
 *  headers in the unified hub view. */
export type HubTab = "training" | "scripts" | "resources";

/** Common shape every item in the hub uses. */
export interface HubItem {
  id: string;
  tab: HubTab;
  /** Display title — short, scannable. */
  title: string;
  /** Sub-classification (e.g. "Volume 1", "Buyer", "Marketing"). */
  category: string;
  /** Short hover/sub-line description. */
  description: string | null;
  /** Existing-page deep-link the agent opens to interact with the
   *  item. Anchored on the resource's natural id where possible. */
  open_url: string;
  /** 0–100, only meaningful for `training` tab; undefined for
   *  scripts + resources. */
  progress_pct?: number;
  /** True when training completion fired for this module. */
  completed?: boolean;
}

// ── Training (live data) ────────────────────────────────────────────

/** Mirrors a row from training_modules (the subset we render). */
export interface TrainingModuleRow {
  id: string;
  volume: number;
  module_num: number;
  title_en: string;
  sort_order: number;
}

/** Mirrors a row from training_videos. */
export interface TrainingVideoRow {
  id: string;
  module_id: string;
  duration_en_sec: number | null;
  sort_order: number;
}

/** Mirrors a row from training_video_progress. */
export interface TrainingVideoProgressRow {
  video_id: string;
  watched_seconds: number;
  completed: boolean;
}

/** Combined "continue watching" surface — the highest-progress
 *  incomplete module. */
export interface ContinueWatching {
  module_id: string;
  title: string;
  category: string;
  progress_pct: number;
  open_url: string;
}

// ── Search ──────────────────────────────────────────────────────────

export interface HubSearchFilters {
  /** Active tab; null means "show everything matching the search". */
  tab: HubTab | null;
  /** Free-text search across title + category + description. */
  search: string;
}

// ── Result envelope ─────────────────────────────────────────────────

export type TrainingHubResult =
  | {
      kind: "ok";
      training: HubItem[];
      scripts: HubItem[];
      resources: HubItem[];
      continueWatching: ContinueWatching | null;
    }
  | {
      kind: "error";
      message: string;
      /** Partial render — what we did manage to load. */
      training: HubItem[];
      scripts: HubItem[];
      resources: HubItem[];
      continueWatching: ContinueWatching | null;
    };
