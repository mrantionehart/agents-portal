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
  entries: Array<{ moduleId: string; lessonId: string; status: LessonStatus; attestedAt?: string | null; quizPassed?: boolean | null }>,
): CertifiedProgress {
  const byModule = new Map<string, Array<{ lesson_id: string; status: LessonStatus; watched_seconds: number; watched_pct: number; quiz_passed: boolean | null; attested_at: string | null }>>();
  for (const e of entries) {
    const arr = byModule.get(e.moduleId) ?? [];
    arr.push({
      lesson_id: e.lessonId,
      status: e.status,
      watched_seconds: 0,
      watched_pct: 0,
      quiz_passed: e.quizPassed ?? null,
      attested_at: e.attestedAt ?? null,
    });
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
