// ============================================================================
// AGENT PORTAL 2.1 — R5 — Server-only Training Hub loader
// ============================================================================
// Reads training_modules + training_videos + training_video_progress
// directly via the user's Supabase session. RLS own-row policies
// gate progress; modules + videos are authenticated-readable.
//
// Scripts + Resources are surfaced via the static catalogs (the
// legacy pages own the actual content).
//
// READ-ONLY — never writes, never RPCs.
// ============================================================================

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { RESOURCE_CATALOG, SCRIPT_CATALOG } from "./catalogs";
import {
  deriveModuleProgress,
  modulesToHubItems,
  pickContinueWatching,
} from "./helpers";
import type {
  TrainingHubResult,
  TrainingModuleRow,
  TrainingVideoProgressRow,
  TrainingVideoRow,
} from "./types";

export async function loadTrainingHub(input: {
  supabase: SupabaseClient;
  callerId: string;
}): Promise<TrainingHubResult> {
  const { supabase, callerId } = input;

  const scripts = [...SCRIPT_CATALOG];
  const resources = [...RESOURCE_CATALOG];

  try {
    const [modulesRes, videosRes, progressRes] = await Promise.all([
      supabase
        .from("training_modules")
        .select("id, volume, module_num, title_en, sort_order")
        .order("sort_order"),
      supabase
        .from("training_videos")
        .select("id, module_id, duration_en_sec, sort_order"),
      supabase
        .from("training_video_progress")
        .select("video_id, watched_seconds, completed")
        .eq("user_id", callerId),
    ]);

    const modules = (modulesRes.data ?? []) as TrainingModuleRow[];
    const videos = (videosRes.data ?? []) as TrainingVideoRow[];
    const progressRows = (progressRes.data ?? []) as TrainingVideoProgressRow[];

    const moduleProgress = deriveModuleProgress(videos, progressRows);
    const training = modulesToHubItems(modules, moduleProgress);
    const continueWatching = pickContinueWatching(training);

    return {
      kind: "ok",
      training,
      scripts,
      resources,
      continueWatching,
    };
  } catch (err) {
    return {
      kind: "error",
      message: err instanceof Error ? err.message : "Failed to load training",
      training: [],
      scripts,
      resources,
      continueWatching: null,
    };
  }
}
