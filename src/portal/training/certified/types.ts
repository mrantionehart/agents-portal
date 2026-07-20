// ============================================================================
// V4 UNIFIED LEARNER EXPERIENCE — TypeScript projections of Vault's catalog
// ============================================================================
// Mirrors the shapes returned by:
//   GET /api/platform/certifications/{cert}/catalog
//   GET /api/platform/certifications/{cert}/progress
//   POST /api/platform/certifications/{cert}/lessons/{id}/complete
//   GET /api/platform/certifications/{cert}/lessons/{id}/quiz
//   POST /api/platform/certifications/{cert}/lessons/{id}/quiz/attempt
//
// Vault is authoritative for every field name and semantic here. This file
// exists only so the AP renderer has typed access to the projection —
// nothing in the AP redefines curriculum or completion logic.
// ============================================================================

export type LessonRequirementKind = "tour" | "practical" | "quiz";

export type LessonActivityType =
  | "transaction_wizard"
  | "scenario"
  | "ai_exercise"
  | "workflow_simulation";

export type LessonExternalSignal =
  | "notification_read"
  | "profile_phone_set";

export type LessonStatus =
  | "not_started"
  | "in_progress"
  | "awaiting_quiz"
  | "needs_retake"
  | "failed_assessment"
  | "completed";

export type ModuleStatus = "draft" | "published" | "archived";

export type CertificationSystem = "portal" | "ease" | "both";

export type CertificationAggregateStatus =
  | "not_started"
  | "in_progress"
  | "completed"
  | "certified"
  | "recertification_required";

export interface LessonSessionUiSpec {
  activity_type: LessonActivityType;
  required_steps: readonly string[];
  requires_reflection: boolean;
  minimum_reflection_length: number;
}

export interface LessonPracticalUiSpec {
  kind: "external_signals";
  required_signals: readonly LessonExternalSignal[];
}

export interface CertifiedLesson {
  id: string;
  module_id: string;
  video_num: string;
  sort_order: number;
  title: string;
  description: string | null;
  objective_md: string | null;
  duration_seconds: number | null;
  practical_attestation_type: "none" | "attest" | "system_verified";
  requires_quiz: boolean;
  quiz_id: string | null;
  related_route: string | null;
  prerequisite_lesson_id: string | null;
  media_status: "ok" | "missing" | "deprecated";
  has_media: boolean;
  system: CertificationSystem;
  requirements: readonly LessonRequirementKind[];
  session_ui_spec: LessonSessionUiSpec | null;
  practical_ui_spec: LessonPracticalUiSpec | null;
}

export interface CertifiedModule {
  id: string;
  module_num: number;
  sort_order: number;
  title: string;
  description: string | null;
  status: ModuleStatus;
  requires_recert: boolean;
  version: string;
  lessons: CertifiedLesson[];
}

export interface CertifiedCatalog {
  certification_id: string;
  version: string;
  tracks: CertifiedModule[];
}

export interface LessonProgress {
  lesson_id: string;
  status: LessonStatus;
  watched_seconds: number;
  watched_pct: number;
  quiz_passed: boolean | null;
  /**
   * LEGACY / AMBIGUOUS. ISO string of a projected attestation timestamp
   * decided by Vault's legacy `completionMode`-driven ternary. For V4
   * lessons that declare only `requirements` (no `completionMode`),
   * Vault falls back to the practical row's timestamp — a value this
   * client historically treated as tour-attested state, producing the
   * PILOT-D-009 "Tour completed" chip on lessons whose practical had
   * landed but tour had not.
   *
   * DO NOT USE for new requirement-specific UI. Use `tour_attested_at`
   * or `practical_attested_at` below instead. Kept in the type so this
   * client remains parseable against older Vault responses that predate
   * the additive contract.
   */
  attested_at: string | null;
  /**
   * ISO string when a `tour` attestation exists for this user + lesson,
   * else null. Populated by Vault directly from the tour attestation
   * row (kind-scoped, never projected). Optional in the type because
   * responses served before the PILOT-D-009 additive contract will not
   * include this field; consumers MUST fail closed (treat undefined as
   * "unknown / not attested") rather than infer completion from the
   * legacy scalar.
   *
   * PILOT-D-009.
   */
  tour_attested_at?: string | null;
  /**
   * ISO string when a `practical` attestation exists for this user +
   * lesson, else null. Populated by Vault directly from the practical
   * attestation row (kind-scoped, never projected). Optional for the
   * same backward-compat reason as `tour_attested_at`.
   *
   * PILOT-D-009.
   */
  practical_attested_at?: string | null;
}

export interface ModuleProgress {
  module_id: string;
  status: CertificationAggregateStatus;
  pct: number;
  lessons: LessonProgress[];
}

export interface CertificationIssuance {
  id: string;
  tenant_id: string;
  user_id: string;
  certification_id: string;
  certification_version: string;
  issued_at: string;
  final_exam_score: number;
  final_exam_attempt_id: string | null;
  revoked_at: string | null;
  revocation_reason: string | null;
}

export interface CertifiedProgress {
  certification_id: string;
  version: string;
  status: CertificationAggregateStatus;
  tracks: ModuleProgress[];
  next_lesson: {
    track_id: string;
    module_id: string;
    lesson_id: string;
  } | null;
  blocked_reason: string | null;
  assessment_attempts: number;
  issuance: CertificationIssuance | null;
  last_updated_at: string;
}

// ─── Quiz projection (learner-safe) ─────────────────────────────────────────
// Mirror of Vault `LearnerSafeQuiz` — the projection strips `correctOptionId`
// and `explanationOnSubmit` before it reaches the client. The AP MUST NEVER
// try to infer correctness before submission.

export interface LearnerSafeQuizOption {
  id: string;
  text: string;
}

export interface LearnerSafeQuizQuestion {
  id: string;
  prompt: string;
  options: readonly LearnerSafeQuizOption[];
}

export interface LearnerSafeQuiz {
  quizId: string;
  quizVersion: string;
  title: string;
  passingScore: number;
  attemptCap: number;
  questions: readonly LearnerSafeQuizQuestion[];
}

export interface QuizGetResponse {
  quiz: LearnerSafeQuiz;
  mode: "learner" | "preview";
  moduleStatus: ModuleStatus;
}

export interface QuizAttemptSubmission {
  quizId: string;
  quizVersion: string;
  answers: ReadonlyArray<{ questionId: string; optionId: string }>;
}

export interface QuizAttemptResult {
  attempt_id: string;
  score: number;
  passed: boolean;
  correct_count: number;
  total_count: number;
  retry_allowed_at: string | null;
}

export interface QuizAttemptResponse {
  result: QuizAttemptResult;
  status: "graded" | "already_passed";
  certification_issuance: {
    issuance_id: string;
    certification_id: string;
    certification_version: string;
    issued_at: string;
  } | null;
}

// ─── Convenience: the canonical certification id ────────────────────────────

export const HARTFELT_PLATFORM_CERTIFIED_ID =
  "hartfelt-platform-certified" as const;

// Final lesson (pcert-l32) is the one whose passing attempt triggers issuance.
// Mirrors Vault's HARTFELT_PLATFORM_CERTIFIED_FINAL_LESSON_ID.
export const FINAL_EXAM_LESSON_ID = "pcert-l32" as const;
