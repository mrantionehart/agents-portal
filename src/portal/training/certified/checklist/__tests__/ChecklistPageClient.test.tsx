// ============================================================================
// V4 UNIFIED LEARNER EXPERIENCE — ChecklistPageClient integration test
// ============================================================================
// Covers the session lifecycle: start → resume → PATCH → PATCH → complete.
// Plus the failure states: revoked, expired, already-completed, duplicate
// active session, malformed reflection, and progress refresh via the
// "Back to lesson" link that fires after complete.
// ============================================================================

const mockRouterReplace = jest.fn();
const mockRouter = { replace: mockRouterReplace, push: jest.fn(), back: jest.fn(), forward: jest.fn(), refresh: jest.fn(), prefetch: jest.fn() };
const mockSearchParams = new URLSearchParams();

jest.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => mockSearchParams,
}));

jest.mock("@/src/portal/training/certified/api", () => {
  class CertApiError extends Error {
    status = 0;
    code: string | null = null;
    detail: unknown = null;
  }
  return {
    fetchCatalog: jest.fn(),
    CertApiError,
  };
});

jest.mock("@/src/portal/training/wizard/session-api", () => {
  class SessionApiError extends Error {
    code: string;
    apiCode: string | null;
    httpStatus: number | null;
    constructor(code: string, message: string, httpStatus: number | null, apiCode: string | null) {
      super(message);
      this.code = code;
      this.apiCode = apiCode;
      this.httpStatus = httpStatus;
    }
  }
  return {
    SessionApiError,
    startSession: jest.fn(),
    getSession: jest.fn(),
    patchSession: jest.fn(),
    completeSession: jest.fn(),
  };
});

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

import ChecklistPageClient from "../ChecklistPageClient";
import * as api from "@/src/portal/training/certified/api";
import * as sessionApi from "@/src/portal/training/wizard/session-api";

const fetchCatalog = api.fetchCatalog as jest.MockedFunction<typeof api.fetchCatalog>;
const startSession = sessionApi.startSession as jest.MockedFunction<typeof sessionApi.startSession>;
const getSession = sessionApi.getSession as jest.MockedFunction<typeof sessionApi.getSession>;
const patchSession = sessionApi.patchSession as jest.MockedFunction<typeof sessionApi.patchSession>;
const completeSession = sessionApi.completeSession as jest.MockedFunction<typeof sessionApi.completeSession>;
const SessionApiError = sessionApi.SessionApiError;

// ─── Fixture builders ──────────────────────────────────────────────────────

function catalogWithL11(overrides?: {
  minReflectionLength?: number;
  requiresReflection?: boolean;
  requiredSteps?: string[];
}) {
  return {
    certification_id: "hartfelt-platform-certified",
    version: "1.0.0",
    tracks: [
      {
        id: "pcert-t03",
        module_num: 3,
        sort_order: 403,
        title: "Transaction Workflow",
        description: null,
        status: "published" as const,
        requires_recert: false,
        version: "1.0.0",
        lessons: [
          {
            id: "pcert-l11",
            module_id: "pcert-t03",
            video_num: "1",
            sort_order: 1,
            title: "Compliance Package Structure",
            description: null,
            objective_md: null,
            duration_seconds: null,
            practical_attestation_type: "attest" as const,
            requires_quiz: false,
            quiz_id: null,
            related_route: null,
            prerequisite_lesson_id: null,
            media_status: "ok" as const,
            has_media: false,
            system: "portal" as const,
            requirements: ["tour", "practical"] as const,
            session_ui_spec: {
              activity_type: "scenario" as const,
              required_steps: overrides?.requiredSteps ?? [
                "open-package",
                "identify-required",
                "identify-blocked",
                "read-blocked-reason",
              ],
              requires_reflection: overrides?.requiresReflection ?? true,
              minimum_reflection_length: overrides?.minReflectionLength ?? 40,
            },
            practical_ui_spec: null,
          },
        ],
      },
    ],
  };
}

function activeSession(overrides?: {
  id?: string;
  lessonId?: string;
  completedSteps?: string[];
  reflections?: Record<string, string>;
  status?: "active" | "completed" | "expired" | "revoked" | "abandoned";
}) {
  return {
    id: overrides?.id ?? "sess-1",
    provenance: {
      user_id: "user-1",
      tenant_id: "tenant-1",
      certification_id: "hartfelt-platform-certified",
      certification_version: "1.0.0",
      lesson_id: overrides?.lessonId ?? "pcert-l11",
      evaluator_key: "checklist-reflection.completed.v1",
      criterion_version: "1",
      activity_type: "scenario",
    },
    status: overrides?.status ?? ("active" as const),
    state: { reflections: overrides?.reflections ?? {} } as Record<string, unknown>,
    completed_steps: overrides?.completedSteps ?? [],
    timestamps: {
      started_at: "2026-07-19T10:00:00Z",
      expires_at: "2026-07-19T22:00:00Z",
      completed_at: null,
      revoked_at: null,
      created_at: "2026-07-19T10:00:00Z",
      updated_at: "2026-07-19T10:00:00Z",
    },
    revocation_reason: null,
  } as sessionApi.ActivitySession;
}

function setSearchParams(params: Record<string, string>) {
  // Rebuild the mocked URLSearchParams in-place so useSearchParams returns
  // the new query.
  for (const key of Array.from(mockSearchParams.keys())) mockSearchParams.delete(key);
  for (const [k, v] of Object.entries(params)) mockSearchParams.set(k, v);
}

beforeEach(() => {
  fetchCatalog.mockReset();
  startSession.mockReset();
  getSession.mockReset();
  patchSession.mockReset();
  completeSession.mockReset();
  mockRouterReplace.mockReset();
  for (const key of Array.from(mockSearchParams.keys())) mockSearchParams.delete(key);
});

// ─── Start path ────────────────────────────────────────────────────────────

describe("ChecklistPageClient — start path", () => {
  it("creates a session then replaces the URL to ?session=<id>", async () => {
    setSearchParams({
      lesson: "pcert-l11",
      activity: "scenario",
      evaluator_key: "checklist-reflection.completed.v1",
      criterion_version: "1",
    });
    fetchCatalog.mockResolvedValue(catalogWithL11());
    startSession.mockResolvedValue({
      id: "sess-1",
      activity_type: "scenario",
      status: "active",
      started_at: "2026-07-19T10:00:00Z",
      expires_at: "2026-07-19T22:00:00Z",
      state: { reflections: {} },
      completed_steps: [],
    });
    getSession.mockResolvedValue(activeSession());

    render(<ChecklistPageClient />);

    await waitFor(() =>
      expect(mockRouterReplace).toHaveBeenCalledWith(
        expect.stringMatching(/\/training\/checklist\?session=sess-1/),
      ),
    );
    // Session UI is visible.
    expect(document.querySelector("[data-cert-checklist-active]")).not.toBeNull();
  });

  it("surfaces a friendly error when the same lesson already has an active session (409)", async () => {
    setSearchParams({
      lesson: "pcert-l11",
      activity: "scenario",
      evaluator_key: "checklist-reflection.completed.v1",
      criterion_version: "1",
    });
    fetchCatalog.mockResolvedValue(catalogWithL11());
    startSession.mockRejectedValue(
      new SessionApiError(
        "session_not_active",
        "already exists",
        409,
        "active_session_exists",
      ),
    );

    render(<ChecklistPageClient />);

    await waitFor(() =>
      expect(
        screen.getByText(/already have an active session/i),
      ).toBeInTheDocument(),
    );
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });
});

// ─── Resume path ───────────────────────────────────────────────────────────

describe("ChecklistPageClient — resume path", () => {
  it("hydrates step + reflection state from an in-progress session on GET", async () => {
    setSearchParams({ session: "sess-1" });
    fetchCatalog.mockResolvedValue(catalogWithL11());
    getSession.mockResolvedValue(
      activeSession({
        completedSteps: ["open-package", "identify-required"],
        reflections: { "open-package": "This is a plenty long enough reflection." },
      }),
    );

    render(<ChecklistPageClient />);

    await waitFor(() =>
      expect(document.querySelector("[data-cert-checklist-active]")).not.toBeNull(),
    );
    const openPackageCheckbox = document.querySelector<HTMLInputElement>(
      '[data-cert-checklist-step-checkbox="open-package"]',
    );
    const identifyRequiredCheckbox = document.querySelector<HTMLInputElement>(
      '[data-cert-checklist-step-checkbox="identify-required"]',
    );
    const identifyBlockedCheckbox = document.querySelector<HTMLInputElement>(
      '[data-cert-checklist-step-checkbox="identify-blocked"]',
    );
    expect(openPackageCheckbox?.checked).toBe(true);
    expect(identifyRequiredCheckbox?.checked).toBe(true);
    expect(identifyBlockedCheckbox?.checked).toBe(false);
    // Reflection text hydrated.
    const openPackageReflection = document.querySelector<HTMLTextAreaElement>(
      '[data-cert-checklist-reflection="open-package"]',
    );
    expect(openPackageReflection?.value).toBe(
      "This is a plenty long enough reflection.",
    );
  });

  it("renders the completed screen when the resumed session is already submitted", async () => {
    setSearchParams({ session: "sess-1" });
    fetchCatalog.mockResolvedValue(catalogWithL11());
    getSession.mockResolvedValue(activeSession({ status: "completed" }));

    render(<ChecklistPageClient />);

    await waitFor(() =>
      expect(screen.getByText(/checklist submitted/i)).toBeInTheDocument(),
    );
    // The "Back to lesson" link points at the correct lesson page — the
    // progress refresh happens there.
    const back = screen.getByRole("link", { name: /back to lesson/i });
    expect(back.getAttribute("href")).toBe(
      "/training/certified/pcert-t03/pcert-l11",
    );
  });
});

// ─── PATCH → PATCH → complete ─────────────────────────────────────────────

describe("ChecklistPageClient — PATCH → PATCH → complete", () => {
  it("PATCHes completed_steps when a checkbox is toggled", async () => {
    setSearchParams({ session: "sess-1" });
    fetchCatalog.mockResolvedValue(catalogWithL11());
    getSession.mockResolvedValue(activeSession());
    patchSession.mockResolvedValue(
      activeSession({ completedSteps: ["open-package"] }),
    );

    render(<ChecklistPageClient />);
    await waitFor(() =>
      expect(document.querySelector("[data-cert-checklist-active]")).not.toBeNull(),
    );

    const cb = document.querySelector<HTMLInputElement>(
      '[data-cert-checklist-step-checkbox="open-package"]',
    )!;
    await act(async () => {
      fireEvent.click(cb);
    });

    expect(patchSession).toHaveBeenCalledWith("sess-1", {
      completed_steps: ["open-package"],
    });
  });

  it("PATCHes state.reflections on textarea blur", async () => {
    setSearchParams({ session: "sess-1" });
    fetchCatalog.mockResolvedValue(catalogWithL11());
    getSession.mockResolvedValue(activeSession());
    patchSession.mockResolvedValue(activeSession());

    render(<ChecklistPageClient />);
    await waitFor(() =>
      expect(document.querySelector("[data-cert-checklist-active]")).not.toBeNull(),
    );

    const textarea = document.querySelector<HTMLTextAreaElement>(
      '[data-cert-checklist-reflection="open-package"]',
    )!;
    await act(async () => {
      fireEvent.change(textarea, {
        target: { value: "This is a reflection with more than forty characters typed here." },
      });
      fireEvent.blur(textarea);
    });

    // The blur PATCH landed with the reflection text keyed by step id.
    const call = patchSession.mock.calls.find(
      (c) => c[1]?.state !== undefined,
    );
    expect(call).toBeDefined();
    expect(call![1].state).toMatchObject({
      reflections: expect.objectContaining({
        "open-package": expect.stringContaining("reflection with more than forty"),
      }),
    });
  });

  it("gates Submit on the client-side reflection minimum length", async () => {
    setSearchParams({ session: "sess-1" });
    fetchCatalog.mockResolvedValue(catalogWithL11({ minReflectionLength: 40 }));
    // Session already has all steps done, but only one reflection is long enough.
    getSession.mockResolvedValue(
      activeSession({
        completedSteps: [
          "open-package",
          "identify-required",
          "identify-blocked",
          "read-blocked-reason",
        ],
        reflections: {
          "open-package": "long-enough-reflection with well over forty characters total.",
          "identify-required": "short",
          "identify-blocked": "long-enough-reflection with well over forty characters total.",
          "read-blocked-reason": "long-enough-reflection with well over forty characters total.",
        },
      }),
    );

    render(<ChecklistPageClient />);
    await waitFor(() =>
      expect(document.querySelector("[data-cert-checklist-active]")).not.toBeNull(),
    );

    const submit = document.querySelector<HTMLButtonElement>(
      "[data-cert-checklist-submit]",
    )!;
    expect(submit.disabled).toBe(true);
  });

  it("Submit calls completeSession and then renders the completed screen", async () => {
    setSearchParams({ session: "sess-1" });
    fetchCatalog.mockResolvedValue(catalogWithL11({ requiresReflection: false }));
    getSession.mockResolvedValue(
      activeSession({
        completedSteps: [
          "open-package",
          "identify-required",
          "identify-blocked",
          "read-blocked-reason",
        ],
      }),
    );
    completeSession.mockResolvedValue({
      id: "sess-1",
      status: "completed",
      completed_at: "2026-07-19T11:00:00Z",
    } as unknown as sessionApi.CompletedSession);

    render(<ChecklistPageClient />);
    await waitFor(() =>
      expect(document.querySelector("[data-cert-checklist-active]")).not.toBeNull(),
    );

    const submit = document.querySelector<HTMLButtonElement>(
      "[data-cert-checklist-submit]",
    )!;
    expect(submit.disabled).toBe(false);
    await act(async () => {
      fireEvent.click(submit);
    });

    expect(completeSession).toHaveBeenCalledWith("sess-1");
    await waitFor(() =>
      expect(screen.getByText(/checklist submitted/i)).toBeInTheDocument(),
    );
  });
});

// ─── Failure state → friendly copy map ─────────────────────────────────────

describe("ChecklistPageClient — server error map", () => {
  it("shows the revoked-session copy when the server returns session_revoked", async () => {
    setSearchParams({ session: "sess-1" });
    fetchCatalog.mockResolvedValue(catalogWithL11());
    getSession.mockRejectedValue(
      new SessionApiError("session_not_active", "revoked", 409, "session_revoked"),
    );
    render(<ChecklistPageClient />);
    await waitFor(() =>
      expect(screen.getByText(/session was revoked/i)).toBeInTheDocument(),
    );
  });

  it("shows the expired-session copy when the server returns session_expired", async () => {
    setSearchParams({ session: "sess-1" });
    fetchCatalog.mockResolvedValue(catalogWithL11());
    getSession.mockRejectedValue(
      new SessionApiError("session_expired", "expired", 409, "session_expired"),
    );
    render(<ChecklistPageClient />);
    await waitFor(() =>
      expect(screen.getByText(/session expired/i)).toBeInTheDocument(),
    );
  });

  it("shows the sub-minimum reflection copy when the server returns session_invalid_state", async () => {
    setSearchParams({ session: "sess-1" });
    fetchCatalog.mockResolvedValue(catalogWithL11({ requiresReflection: false }));
    getSession.mockResolvedValue(activeSession({
      completedSteps: [
        "open-package",
        "identify-required",
        "identify-blocked",
        "read-blocked-reason",
      ],
    }));
    completeSession.mockRejectedValue(
      new SessionApiError(
        "unknown",
        "reflection too short",
        400,
        "session_invalid_state",
      ),
    );
    render(<ChecklistPageClient />);
    await waitFor(() =>
      expect(document.querySelector("[data-cert-checklist-active]")).not.toBeNull(),
    );
    const submit = document.querySelector<HTMLButtonElement>(
      "[data-cert-checklist-submit]",
    )!;
    await act(async () => {
      fireEvent.click(submit);
    });
    await waitFor(() =>
      expect(
        screen.getByText(/reflections don't meet the minimum length/i),
      ).toBeInTheDocument(),
    );
  });
});

// ─── Invalid params ────────────────────────────────────────────────────────

describe("ChecklistPageClient — invalid params", () => {
  it("shows the missing-parameters screen when neither ?session nor start params are present", async () => {
    // No search params set.
    render(<ChecklistPageClient />);
    await waitFor(() =>
      expect(screen.getByText(/missing parameters/i)).toBeInTheDocument(),
    );
    expect(startSession).not.toHaveBeenCalled();
    expect(getSession).not.toHaveBeenCalled();
  });
});
