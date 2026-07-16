// ============================================================================
// AP2 guided-training — client-safe type mirrors
// ============================================================================
// These types deliberately DUPLICATE the shapes declared in
//   vault/src/lib/platform-certification/tour-contracts.ts
// because Vault is `server-only` and cannot be imported from the AP2
// browser bundle. Keep the two files in sync; a Vault change without a
// corresponding update here will surface as a runtime shape mismatch
// (the fetch client validates the top-level shape).
// ============================================================================

export type TourContentNode =
  | { type: "heading"; level: 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: string[] };

export type RegisteredConditionId = never;

export type TourStepInteraction =
  | { kind: "informational" }
  | { kind: "target_click"; targetId: string }
  | { kind: "route_change"; expectedRoute: string }
  | { kind: "state_confirmation"; conditionId: RegisteredConditionId }
  | { kind: "manual_confirmation"; confirmLabel: string };

export type TooltipPlacement = "top" | "right" | "bottom" | "left" | "center";

export interface TourStep {
  id: string;
  order: number;
  targetId: string | null;
  title: string;
  bodyContent: readonly TourContentNode[];
  placement: TooltipPlacement;
  interaction: TourStepInteraction;
  optional: boolean;
}

export interface TourScript {
  id: string;
  lessonId: string;
  certificationId: string;
  scriptVersion: string;
  steps: readonly TourStep[];
}

export interface TourGetResponse {
  script: TourScript;
  mode: "learner" | "preview";
  moduleStatus: "draft" | "published" | "archived";
}

export interface TourCompletionRequest {
  tour_completion: true;
}

/** Discriminator for the tour renderer. Mirrors the server-side `mode`
 *  but is applied only for UI decisions — the SERVER decides whether a
 *  completion write is accepted. */
export type TourClientMode = "learner" | "preview";

/** Diagnostic thrown when a step's targetId cannot be resolved to a DOM
 *  element. Consumed by TourRunner's fallback card + logger. */
export interface MissingTargetDiagnostic {
  step_id: string;
  target_id: string;
  route: string;
  timestamp: string;
}
