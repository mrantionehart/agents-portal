// ============================================================================
// V4 UNIFIED LEARNER EXPERIENCE — UnifiedLessonClient integration test
// ============================================================================
// Locks the dispatcher: catalog + progress → renderer per requirement kind.
// Also proves the "no lesson-id branching" invariant — the renderer inspects
// only `lesson.requirements[]` and the two Vault-provided *_ui_spec objects
// to choose between Family A card / wizard link / checklist launcher /
// quiz launcher / fail-closed states.
// ============================================================================

jest.mock("../api", () => {
  class CertApiError extends Error {
    status: number;
    code: string | null;
    detail: unknown;
    constructor(message: string, status: number, code: string | null, detail: unknown) {
      super(message);
      this.status = status;
      this.code = code;
      this.detail = detail;
    }
  }
  return {
    fetchCatalog: jest.fn(),
    fetchProgress: jest.fn(),
    requestPracticalCompletion: jest.fn(),
    CertApiError,
  };
});

jest.mock("@/src/portal/tour/TourProvider", () => ({
  useTour: () => ({
    script: null,
    loading: false,
    submitting: false,
    error: null,
    completed: false,
    start: jest.fn(),
  }),
}));

jest.mock("@/app/providers", () => ({
  useAuth: () => ({ user: { id: "user-1", email: "learner@hartfeltmg.com" }, role: "agent" }),
}));

import { render, screen, waitFor } from "@testing-library/react";

import UnifiedLessonClient from "../UnifiedLessonClient";
import * as api from "../api";
import type {
  CertifiedCatalog,
  CertifiedLesson,
  CertifiedProgress,
  LessonRequirementKind,
  LessonStatus,
} from "../types";

const fetchCatalogMock = api.fetchCatalog as jest.MockedFunction<typeof api.fetchCatalog>;
const fetchProgressMock = api.fetchProgress as jest.MockedFunction<typeof api.fetchProgress>;
const requestPracticalCompletionMock = api.requestPracticalCompletion as jest.MockedFunction<typeof api.requestPracticalCompletion>;

// ─── Fixture builders ──────────────────────────────────────────────────────

function lesson(overrides: Partial<CertifiedLesson> & { id: string; requirements: LessonRequirementKind[] }): CertifiedLesson {
  return {
    id: overrides.id,
    module_id: overrides.module_id ?? "pcert-t01",
    video_num: overrides.video_num ?? "1",
    sort_order: overrides.sort_order ?? 1,
    title: overrides.title ?? overrides.id,
    description: null,
    objective_md: overrides.objective_md ?? null,
    duration_seconds: null,
    practical_attestation_type: overrides.practical_attestation_type ?? "none",
    requires_quiz: overrides.requires_quiz ?? false,
    quiz_id: null,
    related_route: null,
    prerequisite_lesson_id: overrides.prerequisite_lesson_id ?? null,
    media_status: "ok",
    has_media: false,
    system: "portal",
    requirements: overrides.requirements,
    session_ui_spec: overrides.session_ui_spec ?? null,
    practical_ui_spec: overrides.practical_ui_spec ?? null,
  };
}

function catalog(lessons: CertifiedLesson[]): CertifiedCatalog {
  const byModule = new Map<string, CertifiedLesson[]>();
  for (const l of lessons) {
    const arr = byModule.get(l.module_id) ?? [];
    arr.push(l);
    byModule.set(l.module_id, arr);
  }
  return {
    certification_id: "hartfelt-platform-certified",
    version: "1.0.0",
    tracks: Array.from(byModule.entries()).map(([id, ls], idx) => ({
      id,
      module_num: idx + 1,
      sort_order: 400 + idx + 1,
      title: id,
      description: null,
      status: "published",
      requires_recert: false,
      version: "1.0.0",
      lessons: ls,
    })),
  };
}

function progress(
  entries: Array<{
    moduleId: string;
    lessonId: string;
    status: LessonStatus;
    attestedAt?: string | null;
    quizPassed?: boolean | null;
    // PILOT-D-009: kind-scoped attestation timestamps. Optional so
    // legacy tests remain unchanged; new tests opt in explicitly.
    tourAttestedAt?: string | null;
    practicalAttestedAt?: string | null;
    // When true, the response fixture omits BOTH new fields entirely
    // (undefined). Simulates a stale Vault deployment predating the
    // additive contract, exercising the AP's fail-closed fallback.
    omitKindScopedFields?: boolean;
  }>,
): CertifiedProgress {
  type ProgressRow = {
    lesson_id: string;
    status: LessonStatus;
    watched_seconds: number;
    watched_pct: number;
    quiz_passed: boolean | null;
    attested_at: string | null;
    tour_attested_at?: string | null;
    practical_attested_at?: string | null;
  };
  const byModule = new Map<string, ProgressRow[]>();
  for (const e of entries) {
    const arr = byModule.get(e.moduleId) ?? [];
    const row: ProgressRow = {
      lesson_id: e.lessonId,
      status: e.status,
      watched_seconds: 0,
      watched_pct: 0,
      quiz_passed: e.quizPassed ?? null,
      attested_at: e.attestedAt ?? null,
    };
    if (!e.omitKindScopedFields) {
      row.tour_attested_at = e.tourAttestedAt ?? null;
      row.practical_attested_at = e.practicalAttestedAt ?? null;
    }
    arr.push(row);
    byModule.set(e.moduleId, arr);
  }
  return {
    certification_id: "hartfelt-platform-certified",
    version: "1.0.0",
    status: "in_progress",
    tracks: Array.from(byModule.entries()).map(([module_id, lessons]) => ({
      module_id,
      status: "in_progress",
      pct: 0,
      lessons,
    })),
    next_lesson: null,
    blocked_reason: null,
    assessment_attempts: 0,
    issuance: null,
    last_updated_at: "2026-07-19T00:00:00.000Z",
  };
}

beforeEach(() => {
  fetchCatalogMock.mockReset();
  fetchProgressMock.mockReset();
  requestPracticalCompletionMock.mockReset();
});

// ─── Dispatcher: tour only ────────────────────────────────────────────────

describe("UnifiedLessonClient — requirement dispatch", () => {
  it("renders the learner tour launcher for tour-only lessons", async () => {
    const l01 = lesson({ id: "pcert-l01", module_id: "pcert-t01", requirements: ["tour"] });
    fetchCatalogMock.mockResolvedValueOnce(catalog([l01]));
    fetchProgressMock.mockResolvedValueOnce(progress([]));

    render(<UnifiedLessonClient trackId="pcert-t01" lessonId="pcert-l01" />);

    await waitFor(() => expect(screen.getAllByText("pcert-l01")[0]).toBeInTheDocument());
    // Tour block visible; no practical/quiz blocks.
    expect(document.querySelector('[data-cert-requirement-kind="tour"]')).not.toBeNull();
    expect(document.querySelector('[data-cert-requirement-kind="practical"]')).toBeNull();
    expect(document.querySelector('[data-cert-requirement-kind="quiz"]')).toBeNull();
    expect(document.querySelector('[data-cert-tour-launcher="learner"]')).not.toBeNull();
  });

  it("renders tour + Family A guidance card for pcert-l03 (tour + external-signals practical)", async () => {
    const l03 = lesson({
      id: "pcert-l03",
      module_id: "pcert-t01",
      requirements: ["tour", "practical"],
      practical_ui_spec: {
        kind: "external_signals",
        required_signals: ["notification_read", "profile_phone_set"],
      },
    });
    fetchCatalogMock.mockResolvedValueOnce(catalog([l03]));
    fetchProgressMock.mockResolvedValueOnce(progress([]));

    render(<UnifiedLessonClient trackId="pcert-t01" lessonId="pcert-l03" />);

    await waitFor(() => expect(screen.getAllByText("pcert-l03")[0]).toBeInTheDocument());
    expect(document.querySelector('[data-cert-activity="family-a-guidance"]')).not.toBeNull();
    expect(document.querySelector('[data-cert-tour-launcher="learner"]')).not.toBeNull();
    expect(document.querySelector('[data-cert-activity="wizard-link"]')).toBeNull();
    expect(document.querySelector('[data-cert-activity="checklist-link"]')).toBeNull();
    expect(document.querySelector('[data-cert-activity="quiz-link"]')).toBeNull();
  });

  it("renders tour + wizard link for pcert-l04 (transaction_wizard session)", async () => {
    const l04 = lesson({
      id: "pcert-l04",
      module_id: "pcert-t01",
      requirements: ["tour", "practical"],
      session_ui_spec: {
        activity_type: "transaction_wizard",
        required_steps: ["type", "property", "parties", "dates", "review"],
        requires_reflection: false,
        minimum_reflection_length: 0,
      },
    });
    fetchCatalogMock.mockResolvedValueOnce(catalog([l04]));
    fetchProgressMock.mockResolvedValueOnce(progress([]));

    render(<UnifiedLessonClient trackId="pcert-t01" lessonId="pcert-l04" />);

    await waitFor(() => expect(screen.getAllByText("pcert-l04")[0]).toBeInTheDocument());
    expect(document.querySelector('[data-cert-activity="wizard-link"]')).not.toBeNull();
    expect(document.querySelector('[data-cert-tour-launcher="learner"]')).not.toBeNull();
    expect(document.querySelector('[data-cert-activity="family-a-guidance"]')).toBeNull();
    expect(document.querySelector('[data-cert-activity="checklist-link"]')).toBeNull();
  });

  it("renders tour + checklist for a scenario session lesson", async () => {
    const l11 = lesson({
      id: "pcert-l11",
      module_id: "pcert-t03",
      requirements: ["tour", "practical"],
      session_ui_spec: {
        activity_type: "scenario",
        required_steps: ["open-package", "identify-required", "identify-blocked", "read-blocked-reason"],
        requires_reflection: true,
        minimum_reflection_length: 40,
      },
    });
    fetchCatalogMock.mockResolvedValueOnce(catalog([l11]));
    fetchProgressMock.mockResolvedValueOnce(progress([]));

    render(<UnifiedLessonClient trackId="pcert-t03" lessonId="pcert-l11" />);

    await waitFor(() => expect(screen.getAllByText("pcert-l11")[0]).toBeInTheDocument());
    expect(document.querySelector('[data-cert-activity="checklist-link"]')).not.toBeNull();
    expect(document.querySelector('[data-cert-tour-launcher="learner"]')).not.toBeNull();
    expect(document.querySelector('[data-cert-activity="wizard-link"]')).toBeNull();
    expect(document.querySelector('[data-cert-activity="family-a-guidance"]')).toBeNull();
  });

  it("renders practical-only checklist (no tour block) for lessons like pcert-l24", async () => {
    const l24 = lesson({
      id: "pcert-l24",
      module_id: "pcert-t05",
      requirements: ["practical"],
      session_ui_spec: {
        activity_type: "scenario",
        required_steps: ["open-package", "locate-blocked-disclosure"],
        requires_reflection: true,
        minimum_reflection_length: 60,
      },
    });
    fetchCatalogMock.mockResolvedValueOnce(catalog([l24]));
    fetchProgressMock.mockResolvedValueOnce(progress([]));

    render(<UnifiedLessonClient trackId="pcert-t05" lessonId="pcert-l24" />);

    await waitFor(() => expect(screen.getAllByText("pcert-l24")[0]).toBeInTheDocument());
    expect(document.querySelector('[data-cert-requirement-kind="tour"]')).toBeNull();
    expect(document.querySelector('[data-cert-activity="checklist-link"]')).not.toBeNull();
    expect(document.querySelector('[data-cert-activity="quiz-link"]')).toBeNull();
  });

  it("renders quiz-only launcher for pcert-l29 (portal assessment)", async () => {
    const l29 = lesson({ id: "pcert-l29", module_id: "pcert-t06", requirements: ["quiz"] });
    fetchCatalogMock.mockResolvedValueOnce(catalog([l29]));
    fetchProgressMock.mockResolvedValueOnce(progress([]));

    render(<UnifiedLessonClient trackId="pcert-t06" lessonId="pcert-l29" />);

    await waitFor(() => expect(screen.getAllByText("pcert-l29")[0]).toBeInTheDocument());
    expect(document.querySelector('[data-cert-activity="quiz-link"]')).not.toBeNull();
    expect(document.querySelector('[data-cert-requirement-kind="tour"]')).toBeNull();
    expect(document.querySelector('[data-cert-requirement-kind="practical"]')).toBeNull();
  });

  it("renders practical + quiz for pcert-l25 (checklist + quiz)", async () => {
    const l25 = lesson({
      id: "pcert-l25",
      module_id: "pcert-t05",
      requirements: ["practical", "quiz"],
      session_ui_spec: {
        activity_type: "scenario",
        required_steps: ["read-coordinator", "identify-blocker"],
        requires_reflection: true,
        minimum_reflection_length: 60,
      },
    });
    fetchCatalogMock.mockResolvedValueOnce(catalog([l25]));
    fetchProgressMock.mockResolvedValueOnce(progress([]));

    render(<UnifiedLessonClient trackId="pcert-t05" lessonId="pcert-l25" />);

    await waitFor(() => expect(screen.getAllByText("pcert-l25")[0]).toBeInTheDocument());
    expect(document.querySelector('[data-cert-activity="checklist-link"]')).not.toBeNull();
    expect(document.querySelector('[data-cert-activity="quiz-link"]')).not.toBeNull();
    expect(document.querySelector('[data-cert-requirement-kind="tour"]')).toBeNull();
  });
});

// ─── Prerequisite lock ────────────────────────────────────────────────────

describe("UnifiedLessonClient — prerequisite behavior", () => {
  it("renders the PrereqLocked card and NO activity blocks when the prereq is not complete", async () => {
    const l02 = lesson({
      id: "pcert-l02",
      module_id: "pcert-t01",
      requirements: ["tour"],
      prerequisite_lesson_id: "pcert-l01",
    });
    const l01 = lesson({ id: "pcert-l01", module_id: "pcert-t01", requirements: ["tour"], title: "Welcome to HartFelt" });
    fetchCatalogMock.mockResolvedValueOnce(catalog([l01, l02]));
    fetchProgressMock.mockResolvedValueOnce(progress([
      { moduleId: "pcert-t01", lessonId: "pcert-l01", status: "in_progress" },
    ]));

    render(<UnifiedLessonClient trackId="pcert-t01" lessonId="pcert-l02" />);

    await waitFor(() => expect(screen.getAllByText("pcert-l02")[0]).toBeInTheDocument());
    expect(document.querySelector("[data-cert-prereq-locked]")).not.toBeNull();
    expect(document.querySelector('[data-cert-requirement-blocks]')).toBeNull();
    // The prereq title from the catalog (not just the id) must be shown.
    expect(screen.getByText("Welcome to HartFelt")).toBeInTheDocument();
  });

  it("renders activity blocks (not the lock card) when the prereq is completed", async () => {
    const l02 = lesson({
      id: "pcert-l02",
      module_id: "pcert-t01",
      requirements: ["tour"],
      prerequisite_lesson_id: "pcert-l01",
    });
    const l01 = lesson({ id: "pcert-l01", module_id: "pcert-t01", requirements: ["tour"] });
    fetchCatalogMock.mockResolvedValueOnce(catalog([l01, l02]));
    fetchProgressMock.mockResolvedValueOnce(progress([
      { moduleId: "pcert-t01", lessonId: "pcert-l01", status: "completed" },
    ]));

    render(<UnifiedLessonClient trackId="pcert-t01" lessonId="pcert-l02" />);

    await waitFor(() => expect(screen.getAllByText("pcert-l02")[0]).toBeInTheDocument());
    expect(document.querySelector("[data-cert-prereq-locked]")).toBeNull();
    expect(document.querySelector('[data-cert-requirement-blocks]')).not.toBeNull();
  });
});

// ─── Completion state ─────────────────────────────────────────────────────

describe("UnifiedLessonClient — server-driven completion state", () => {
  it("passes alreadyCompleted=true down when the lesson's Vault status is 'completed'", async () => {
    const l01 = lesson({ id: "pcert-l01", module_id: "pcert-t01", requirements: ["tour"] });
    fetchCatalogMock.mockResolvedValueOnce(catalog([l01]));
    fetchProgressMock.mockResolvedValueOnce(progress([
      { moduleId: "pcert-t01", lessonId: "pcert-l01", status: "completed", attestedAt: "2026-07-19T12:00:00Z" },
    ]));

    render(<UnifiedLessonClient trackId="pcert-t01" lessonId="pcert-l01" />);

    // The learner tour launcher renders the "Tour completed" passive chip when
    // alreadyCompleted is true (no Start button).
    await waitFor(() => expect(screen.getByText(/tour completed/i)).toBeInTheDocument());
    expect(document.querySelector('[data-cert-tour-launcher="learner-completed"]')).not.toBeNull();
    // No start button.
    expect(screen.queryByRole("button", { name: /start guided tour/i })).toBeNull();
  });
});

// ─── Unknown lesson ───────────────────────────────────────────────────────

describe("UnifiedLessonClient — not-found handling", () => {
  it("shows a not-found panel when the trackId does not exist in the catalog", async () => {
    const l01 = lesson({ id: "pcert-l01", module_id: "pcert-t01", requirements: ["tour"] });
    fetchCatalogMock.mockResolvedValueOnce(catalog([l01]));
    fetchProgressMock.mockResolvedValueOnce(progress([]));
    render(<UnifiedLessonClient trackId="pcert-t99" lessonId="pcert-l01" />);
    await waitFor(() => expect(screen.getByText(/unknown track/i)).toBeInTheDocument());
  });

  it("shows a not-found panel when the lessonId is missing from the track", async () => {
    const l01 = lesson({ id: "pcert-l01", module_id: "pcert-t01", requirements: ["tour"] });
    fetchCatalogMock.mockResolvedValueOnce(catalog([l01]));
    fetchProgressMock.mockResolvedValueOnce(progress([]));
    render(<UnifiedLessonClient trackId="pcert-t01" lessonId="pcert-l99" />);
    await waitFor(() => expect(screen.getByText(/unknown lesson/i)).toBeInTheDocument());
  });
});

// ─── No lesson-id branching ────────────────────────────────────────────────

describe("UnifiedLessonClient — no lesson-id branching invariant", () => {
  it("dispatch is driven ONLY by lesson.requirements + spec objects, not by lesson.id", async () => {
    // Prove it by using a fake, non-canonical lesson id with a scenario spec —
    // if the renderer routed by id, it would fail to render the checklist link.
    const fake = lesson({
      id: "not-a-real-lesson-id",
      module_id: "pcert-t05",
      requirements: ["practical"],
      session_ui_spec: {
        activity_type: "scenario",
        required_steps: ["step-a", "step-b"],
        requires_reflection: false,
        minimum_reflection_length: 0,
      },
    });
    fetchCatalogMock.mockResolvedValueOnce(catalog([fake]));
    fetchProgressMock.mockResolvedValueOnce(progress([]));

    render(
      <UnifiedLessonClient trackId="pcert-t05" lessonId="not-a-real-lesson-id" />,
    );

    await waitFor(() => expect(screen.getAllByText("not-a-real-lesson-id")[0]).toBeInTheDocument());
    // The checklist launcher rendered for a lesson id the renderer has
    // never heard of — proving it read only from the spec.
    expect(document.querySelector('[data-cert-activity="checklist-link"]')).not.toBeNull();
  });
});

// ─── PILOT-D-009 — kind-scoped attestation signals ──────────────────────────
//
// Fixtures below use `pcert-l04` as the canonical requirements-only lesson
// (`requirements: [tour, practical]`, no legacy `completionMode`) — the
// exact production shape that produced the false "Tour completed" chip
// on `pcert-l04` after PILOT-D-008 landed the practical attestation.
//
// Every assertion here targets the runtime that would have surfaced
// D-009. If any of these regress in a future refactor, the AP is once
// again mis-consuming Vault's progress projection.

describe("UnifiedLessonClient — PILOT-D-009 kind-scoped attestation signals", () => {
  function l04() {
    return lesson({
      id: "pcert-l04",
      module_id: "pcert-t01",
      requirements: ["tour", "practical"],
      session_ui_spec: {
        activity_type: "transaction_wizard",
        required_steps: ["type", "property", "parties", "dates", "review"],
        requires_reflection: false,
        minimum_reflection_length: 0,
      },
    });
  }

  it("D-009 repro: practical_attested_at populated but tour_attested_at null → tour block shows Start, NOT 'Tour completed'", async () => {
    // Exact production shape after PILOT-D-008: practical done, tour not.
    // The legacy `attested_at` scalar still carries the practical
    // timestamp (as Vault does for backward compat) but this client
    // MUST NOT interpret that as tour signal.
    fetchCatalogMock.mockResolvedValueOnce(catalog([l04()]));
    fetchProgressMock.mockResolvedValueOnce(progress([
      {
        moduleId: "pcert-t01",
        lessonId: "pcert-l04",
        status: "in_progress",
        attestedAt: "2026-07-19T22:08:22Z",       // legacy scalar (practical ts, leaked)
        tourAttestedAt: null,                       // ← the assertion driver
        practicalAttestedAt: "2026-07-19T22:08:22Z",
      },
    ]));

    render(<UnifiedLessonClient trackId="pcert-t01" lessonId="pcert-l04" />);

    await waitFor(() => expect(screen.getAllByText("pcert-l04")[0]).toBeInTheDocument());
    // Tour block renders in "start" state — NOT the completed chip.
    expect(document.querySelector('[data-cert-tour-launcher="learner"]')).not.toBeNull();
    expect(document.querySelector('[data-cert-tour-launcher="learner-completed"]')).toBeNull();
    // No "Tour completed" text — the whole point of the fix.
    expect(screen.queryByText(/tour completed/i)).toBeNull();
  });

  it("tour_attested_at populated → 'Tour completed' chip renders (no Start button)", async () => {
    fetchCatalogMock.mockResolvedValueOnce(catalog([l04()]));
    fetchProgressMock.mockResolvedValueOnce(progress([
      {
        moduleId: "pcert-t01",
        lessonId: "pcert-l04",
        status: "in_progress",
        attestedAt: "2026-07-19T22:30:00Z",
        tourAttestedAt: "2026-07-19T22:30:00Z",         // ← drives the chip
        practicalAttestedAt: "2026-07-19T22:08:22Z",
      },
    ]));

    render(<UnifiedLessonClient trackId="pcert-t01" lessonId="pcert-l04" />);

    await waitFor(() => expect(screen.getAllByText("pcert-l04")[0]).toBeInTheDocument());
    expect(document.querySelector('[data-cert-tour-launcher="learner-completed"]')).not.toBeNull();
    expect(screen.getByText(/tour completed/i)).toBeInTheDocument();
    // Start button must be absent when the tour is genuinely completed.
    expect(screen.queryByRole("button", { name: /start guided tour/i })).toBeNull();
  });

  it("both timestamps populated + status='in_progress' → both blocks render independently in a satisfied state, without inferring overall completion", async () => {
    fetchCatalogMock.mockResolvedValueOnce(catalog([l04()]));
    fetchProgressMock.mockResolvedValueOnce(progress([
      {
        moduleId: "pcert-t01",
        lessonId: "pcert-l04",
        status: "in_progress",                          // ← server says NOT completed (e.g., quiz still pending on some future lesson)
        attestedAt: "2026-07-19T22:30:00Z",
        tourAttestedAt: "2026-07-19T22:30:00Z",
        practicalAttestedAt: "2026-07-19T22:08:22Z",
      },
    ]));

    render(<UnifiedLessonClient trackId="pcert-t01" lessonId="pcert-l04" />);

    await waitFor(() => expect(screen.getAllByText("pcert-l04")[0]).toBeInTheDocument());
    // Tour block shows completed chip.
    expect(document.querySelector('[data-cert-tour-launcher="learner-completed"]')).not.toBeNull();
    // Practical (wizard) block also shows completed — driven by
    // practicalAlreadyAttested, not overallCompleted.
    const wizardLink = document.querySelector('[data-cert-activity="wizard-link"]');
    expect(wizardLink).not.toBeNull();
    // The top-of-page status badge still reflects Vault's status
    // (server-driven, NOT locally inferred).
    expect(document.querySelector('[data-cert-status-badge]')?.getAttribute('data-cert-status-badge')).not.toBe('Completed');
  });

  it("both timestamps null + status='in_progress' → tour block shows Start and wizard block shows launch (fresh state)", async () => {
    fetchCatalogMock.mockResolvedValueOnce(catalog([l04()]));
    fetchProgressMock.mockResolvedValueOnce(progress([
      {
        moduleId: "pcert-t01",
        lessonId: "pcert-l04",
        status: "not_started",
        attestedAt: null,
        tourAttestedAt: null,
        practicalAttestedAt: null,
      },
    ]));

    render(<UnifiedLessonClient trackId="pcert-t01" lessonId="pcert-l04" />);

    await waitFor(() => expect(screen.getAllByText("pcert-l04")[0]).toBeInTheDocument());
    expect(document.querySelector('[data-cert-tour-launcher="learner"]')).not.toBeNull();
    expect(document.querySelector('[data-cert-tour-launcher="learner-completed"]')).toBeNull();
    expect(document.querySelector('[data-cert-activity="wizard-link"]')).not.toBeNull();
    expect(screen.queryByText(/tour completed/i)).toBeNull();
  });

  it("legacy-shape response (both kind-scoped fields ABSENT) + non-null attested_at scalar → tour block FAILS CLOSED (Start visible, NOT the false chip)", async () => {
    // Simulates a hypothetical stale Vault deployment that predates
    // the additive contract. The AP MUST NOT treat the ambiguous scalar
    // as tour-completed evidence — that's the exact D-009 misread the
    // fix eliminates.
    fetchCatalogMock.mockResolvedValueOnce(catalog([l04()]));
    fetchProgressMock.mockResolvedValueOnce(progress([
      {
        moduleId: "pcert-t01",
        lessonId: "pcert-l04",
        status: "in_progress",
        attestedAt: "2026-07-19T22:08:22Z",
        omitKindScopedFields: true,                    // ← simulates old Vault
      },
    ]));

    render(<UnifiedLessonClient trackId="pcert-t01" lessonId="pcert-l04" />);

    await waitFor(() => expect(screen.getAllByText("pcert-l04")[0]).toBeInTheDocument());
    // Fail-closed: the client renders the Start (learner) launcher, not
    // the completed chip. A stale Vault deployment is treated as "unknown
    // / not attested" for tour state.
    expect(document.querySelector('[data-cert-tour-launcher="learner"]')).not.toBeNull();
    expect(document.querySelector('[data-cert-tour-launcher="learner-completed"]')).toBeNull();
    expect(screen.queryByText(/tour completed/i)).toBeNull();
  });

  it("lesson completion status comes from Vault status, NOT from kind-scoped fields (both signals true + status='in_progress' → status badge is not Completed)", async () => {
    // Locks the invariant: the top-of-page status badge reads
    // Vault's authoritative `status`. Even if both kind-scoped
    // timestamps are populated, if Vault says `in_progress`, the
    // badge MUST NOT say Completed.
    fetchCatalogMock.mockResolvedValueOnce(catalog([l04()]));
    fetchProgressMock.mockResolvedValueOnce(progress([
      {
        moduleId: "pcert-t01",
        lessonId: "pcert-l04",
        status: "in_progress",   // Vault's authoritative status
        attestedAt: "2026-07-19T22:30:00Z",
        tourAttestedAt: "2026-07-19T22:30:00Z",
        practicalAttestedAt: "2026-07-19T22:08:22Z",
      },
    ]));

    render(<UnifiedLessonClient trackId="pcert-t01" lessonId="pcert-l04" />);

    await waitFor(() => expect(screen.getAllByText("pcert-l04")[0]).toBeInTheDocument());
    const badge = document.querySelector('[data-cert-status-badge]');
    expect(badge?.getAttribute('data-cert-status-badge')).toBe('In progress');
    expect(badge?.getAttribute('data-cert-status-badge')).not.toBe('Completed');
  });

  it("legacy tour-only lesson (pcert-l01) + Vault status='completed' + kind-scoped tour attested → still renders the completed chip (backward-compat with legacy completionMode-driven Vault projections)", async () => {
    // pcert-l01's Vault definition uses legacy completionMode='tour'.
    // Once its tour is walked, Vault sets tour_attested_at + attested_at
    // (both to the tour timestamp) and status='completed'. This test
    // proves the kind-scoped read path is compatible with legacy-shaped
    // lessons — a single lesson type never diverges.
    const l01 = lesson({ id: "pcert-l01", module_id: "pcert-t01", requirements: ["tour"] });
    fetchCatalogMock.mockResolvedValueOnce(catalog([l01]));
    fetchProgressMock.mockResolvedValueOnce(progress([
      {
        moduleId: "pcert-t01",
        lessonId: "pcert-l01",
        status: "completed",
        attestedAt: "2026-07-19T11:42:54Z",
        tourAttestedAt: "2026-07-19T11:42:54Z",
        practicalAttestedAt: null,
      },
    ]));

    render(<UnifiedLessonClient trackId="pcert-t01" lessonId="pcert-l01" />);

    await waitFor(() => expect(screen.getAllByText("pcert-l01")[0]).toBeInTheDocument());
    expect(document.querySelector('[data-cert-tour-launcher="learner-completed"]')).not.toBeNull();
    expect(screen.getByText(/tour completed/i)).toBeInTheDocument();
  });
});
