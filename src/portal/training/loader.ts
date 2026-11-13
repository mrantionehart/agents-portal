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
  HubItem,
  TrainingHubResult,
  TrainingModuleRow,
  TrainingVideoProgressRow,
  TrainingVideoRow,
} from "./types";

// The Ring is a live, agent-visible destination (sidebar `/the-ring`) that
// authenticates into the Vault simulation engine with the agent's own session.
// It was never surfaced inside the Training Hub, so agents looking for practice
// under "Training" never found it. Surface it here as a static, always-present
// card that deep-links to the existing route — no Ring code is rebuilt, the card
// just links out, exactly like the static Script/Resource catalog entries.
// Kept DB-independent so it shows even when training_modules fails to load.
const RING_HUB_ITEM: HubItem = {
  id: "training/the-ring",
  tab: "training",
  title: "The Ring — AI Roleplay Practice",
  category: "Practice",
  description:
    "Practice live real-estate conversations with an AI counterpart and get instant coaching and scoring.",
  open_url: "/the-ring",
};

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
        // Only PUBLISHED modules belong in an agent's hub. Every module that
        // existed before CTM-1 is published, so this hides nothing today; it
        // keeps a program's DRAFT module rows (e.g. CTM before activation) out
        // of the hub, where they used to be listed by title regardless of status.
        .eq("status", "published")
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
    // The Ring leads the Training tab as a permanent practice destination,
    // ahead of the DB-driven video modules.
    const training = [RING_HUB_ITEM, ...modulesToHubItems(modules, moduleProgress)];
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
      training: [RING_HUB_ITEM],
      scripts,
      resources,
      continueWatching: null,
    };
  }
}
