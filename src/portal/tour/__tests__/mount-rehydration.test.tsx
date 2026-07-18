// ============================================================================
// AP2 guided-training — TourProvider mount-time rehydration (Track 2 fix)
// ============================================================================
// The (portal) route-group layout mounts <TourProvider> as a client
// component. React preserves it across CLIENT-SIDE navigation between
// authenticated portal routes. But a HARD navigation to a workspace URL
// (URL bar entry, F5 refresh, deep-link from an external page) tears
// down the client tree and remounts TourProvider with INITIAL_STATE —
// state.script is null so TourRunner returns null and the tooltip
// disappears even though sessionStorage (preview) or localStorage
// (learner) still holds the in-flight step id.
//
// The mount-fix stores certificationId + lessonId alongside the step
// state and adds a one-shot mount effect to TourProvider that scans
// persistence for a rehydratable entry and calls start() with those
// ids. start() itself uses pickInitialIndex() to consult persistence
// and jumps to the persisted step, so the visible outcome is the
// tooltip reappearing exactly where the broker left off.
//
// These tests are the regression harness for the fix. They exercise:
//   * the persistence scan (findActivePreview / findActiveLearnerResume)
//   * the write path (certificationId / lessonId round-trip)
//   * the mount effect (rehydration on a fresh <TourProvider> mount)
//   * TourRunner singleton + no-leak invariants
//   * back-compat with pre-fix persistence entries
//   * fetch failures leave the provider in a safe state (no crash)
//
// The tests use Jest + Testing Library. Real Next.js router is mocked
// via next/navigation. The api module is mocked so no network call
// happens.
// ============================================================================

import React from "react";
import { render, act, waitFor } from "@testing-library/react";

import {
  clearPreviewState,
  findActivePreview,
  readPreviewState,
  writePreviewState,
} from "../persistence-preview";
import {
  findActiveLearnerResume,
  readLearnerResume,
  writeLearnerResume,
} from "../persistence-learner";
import { TourProvider, useTour } from "../TourProvider";
import { TourRunner } from "../TourRunner";

jest.mock("../api", () => ({
  fetchTourScript: jest.fn(),
  submitTourCompletion: jest.fn(),
  TourApiError: class extends Error {},
  TourResponseShapeError: class extends Error {},
}));
jest.mock("next/navigation", () => ({
  usePathname: () => "/workspace/00000000-c00d-0000-0000-000000000001",
}));

import { fetchTourScript } from "../api";
const mockFetch = fetchTourScript as jest.MockedFunction<typeof fetchTourScript>;

const CERT = "hartfelt-platform-certified";
const LESSON = "pcert-l06";
const SCRIPT_ID = "transaction-intelligence.coordinator";
const SCRIPT_VERSION = "1.0.0";

const SCRIPT = {
  id: SCRIPT_ID,
  lessonId: LESSON,
  certificationId: CERT,
  scriptVersion: SCRIPT_VERSION,
  steps: [
    {
      id: "l06-intro",
      order: 1,
      targetId: null,
      title: "Intro",
      bodyContent: [{ type: "paragraph", text: "Intro" }],
      placement: "center",
      interaction: { kind: "informational" },
      optional: false,
    },
    {
      id: "l06-open-fixture",
      order: 2,
      targetId: null,
      title: "Open the fixture",
      bodyContent: [{ type: "paragraph", text: "Open it" }],
      placement: "center",
      interaction: {
        kind: "route_change",
        expectedRoute: "/workspace/00000000-c00d-0000-0000-000000000001",
      },
      optional: false,
    },
    {
      id: "l06-coordinator",
      order: 3,
      targetId: "portal.workspace.coordinator",
      title: "Coordinator",
      bodyContent: [{ type: "paragraph", text: "Read it" }],
      placement: "bottom",
      interaction: { kind: "informational" },
      optional: false,
    },
  ],
} as const;

beforeEach(() => {
  mockFetch.mockReset();
  window.sessionStorage.clear();
  window.localStorage.clear();
});

// ─── Persistence: round-trip cert + lesson ───────────────────────────────────

describe("Track 2 mount-fix — persistence round-trip", () => {
  it("writePreviewState + readPreviewState preserves certificationId + lessonId", () => {
    writePreviewState(SCRIPT_ID, SCRIPT_VERSION, {
      currentStepId: "l06-open-fixture",
      updatedAt: "2026-07-17T15:00:00.000Z",
      certificationId: CERT,
      lessonId: LESSON,
    });
    const readBack = readPreviewState(SCRIPT_ID, SCRIPT_VERSION);
    expect(readBack).not.toBeNull();
    expect(readBack?.certificationId).toBe(CERT);
    expect(readBack?.lessonId).toBe(LESSON);
    expect(readBack?.currentStepId).toBe("l06-open-fixture");
  });

  it("writeLearnerResume + readLearnerResume preserves certificationId + lessonId", () => {
    writeLearnerResume("user-abc-12345678", SCRIPT_ID, SCRIPT_VERSION, {
      currentStepId: "l06-coordinator",
      stepsCompleted: ["l06-intro", "l06-open-fixture"],
      updatedAt: "2026-07-17T15:00:00.000Z",
      certificationId: CERT,
      lessonId: LESSON,
    });
    const readBack = readLearnerResume("user-abc-12345678", SCRIPT_ID, SCRIPT_VERSION);
    expect(readBack).not.toBeNull();
    expect(readBack?.certificationId).toBe(CERT);
    expect(readBack?.lessonId).toBe(LESSON);
    expect(readBack?.currentStepId).toBe("l06-coordinator");
  });

  it("read paths still return a value when the stored entry lacks cert/lesson (back-compat)", () => {
    // Pre-fix write shape: no cert/lesson fields.
    window.sessionStorage.setItem(
      `ht.pcert.tour.preview.${SCRIPT_ID}.${SCRIPT_VERSION}`,
      JSON.stringify({
        currentStepId: "l06-open-fixture",
        updatedAt: "2026-07-17T15:00:00.000Z",
        scriptVersion: SCRIPT_VERSION,
      }),
    );
    const readBack = readPreviewState(SCRIPT_ID, SCRIPT_VERSION);
    expect(readBack).not.toBeNull();
    expect(readBack?.currentStepId).toBe("l06-open-fixture");
    expect(readBack?.certificationId).toBeUndefined();
    expect(readBack?.lessonId).toBeUndefined();
  });
});

// ─── Persistence: scan ───────────────────────────────────────────────────────

describe("Track 2 mount-fix — findActivePreview scan", () => {
  it("returns null when sessionStorage has no preview entry", () => {
    expect(findActivePreview()).toBeNull();
  });

  it("returns null when the only entry lacks cert/lesson (back-compat skip)", () => {
    window.sessionStorage.setItem(
      `ht.pcert.tour.preview.${SCRIPT_ID}.${SCRIPT_VERSION}`,
      JSON.stringify({
        currentStepId: "l06-open-fixture",
        updatedAt: "2026-07-17T15:00:00.000Z",
        scriptVersion: SCRIPT_VERSION,
      }),
    );
    expect(findActivePreview()).toBeNull();
  });

  it("returns the entry when cert + lesson + step are present", () => {
    writePreviewState(SCRIPT_ID, SCRIPT_VERSION, {
      currentStepId: "l06-open-fixture",
      updatedAt: "2026-07-17T15:00:00.000Z",
      certificationId: CERT,
      lessonId: LESSON,
    });
    const hit = findActivePreview();
    expect(hit).not.toBeNull();
    expect(hit?.scriptId).toBe(SCRIPT_ID);
    expect(hit?.scriptVersion).toBe(SCRIPT_VERSION);
    expect(hit?.certificationId).toBe(CERT);
    expect(hit?.lessonId).toBe(LESSON);
    expect(hit?.currentStepId).toBe("l06-open-fixture");
  });

  it("returns the most recently updated entry when multiple exist", () => {
    writePreviewState("older.script", SCRIPT_VERSION, {
      currentStepId: "s-1",
      updatedAt: "2026-07-15T00:00:00.000Z",
      certificationId: CERT,
      lessonId: "pcert-l02",
    });
    writePreviewState(SCRIPT_ID, SCRIPT_VERSION, {
      currentStepId: "l06-open-fixture",
      updatedAt: "2026-07-17T15:00:00.000Z",
      certificationId: CERT,
      lessonId: LESSON,
    });
    const hit = findActivePreview();
    expect(hit?.scriptId).toBe(SCRIPT_ID);
    expect(hit?.lessonId).toBe(LESSON);
  });
});

describe("Track 2 mount-fix — findActiveLearnerResume scan", () => {
  it("returns null when localStorage has no matching entry for the user", () => {
    expect(findActiveLearnerResume("user-abc-12345678")).toBeNull();
  });

  it("returns the entry when cert + lesson + step are present for the user", () => {
    writeLearnerResume("user-abc-12345678", SCRIPT_ID, SCRIPT_VERSION, {
      currentStepId: "l06-coordinator",
      stepsCompleted: ["l06-intro"],
      updatedAt: "2026-07-17T15:00:00.000Z",
      certificationId: CERT,
      lessonId: LESSON,
    });
    const hit = findActiveLearnerResume("user-abc-12345678");
    expect(hit?.scriptId).toBe(SCRIPT_ID);
    expect(hit?.lessonId).toBe(LESSON);
    expect(hit?.stepsCompleted).toEqual(["l06-intro"]);
  });
});

// ─── Mount-time rehydration ──────────────────────────────────────────────────

function Harness() {
  const tour = useTour();
  return (
    <div>
      <div data-testid="script-id">{tour.script?.id ?? "-none-"}</div>
      <div data-testid="current-step-id">{tour.currentStep?.id ?? "-none-"}</div>
      <div data-testid="mode">{tour.mode}</div>
      <TourRunner />
    </div>
  );
}

describe("Track 2 mount-fix — mount-time rehydration", () => {
  it("rehydrates an in-flight PREVIEW tour on a fresh TourProvider mount", async () => {
    // Simulate: broker launched pcert-l06 in a prior mount and reached
    // step 2 (`l06-open-fixture`). Preview state is in sessionStorage
    // and now the broker has hard-navigated to the fixture URL — React
    // unmounts and remounts TourProvider.
    writePreviewState(SCRIPT_ID, SCRIPT_VERSION, {
      currentStepId: "l06-open-fixture",
      updatedAt: new Date().toISOString(),
      certificationId: CERT,
      lessonId: LESSON,
    });
    mockFetch.mockResolvedValue({
      script: SCRIPT as any,
      mode: "preview",
      moduleStatus: "draft",
    });

    const { getByTestId } = render(
      <TourProvider>
        <Harness />
      </TourProvider>,
    );

    await waitFor(() => {
      expect(getByTestId("script-id").textContent).toBe(SCRIPT_ID);
    });
    // The persisted step was `l06-open-fixture` (route_change awaiting
    // /workspace/...-000000000001). The mocked pathname IS that URL,
    // so the auto-advance effect correctly advances rehydration → step
    // 3 (`l06-coordinator`). This is exactly the production behavior
    // the mount-fix is meant to unlock: the tour picks up where the
    // broker left off AND immediately advances if the target route is
    // already satisfied.
    expect(getByTestId("current-step-id").textContent).toBe("l06-coordinator");
    // Preview intent is preserved.
    expect(getByTestId("mode").textContent).toBe("preview");
    // fetchTourScript was called exactly once with the persisted ids.
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.objectContaining({ certificationId: CERT, lessonId: LESSON, preview: true }),
    );
  });

  it("preserves the persisted step id when rehydrating to a non-route_change step", async () => {
    // Rehydrate directly onto step 3 (`l06-coordinator`, informational)
    // to prove the persisted step id survives when auto-advance does
    // NOT apply. This confirms the rehydration path itself lands us at
    // the correct step and the step-3 render is not a side-effect of
    // auto-advance.
    writePreviewState(SCRIPT_ID, SCRIPT_VERSION, {
      currentStepId: "l06-coordinator",
      updatedAt: new Date().toISOString(),
      certificationId: CERT,
      lessonId: LESSON,
    });
    mockFetch.mockResolvedValue({
      script: SCRIPT as any,
      mode: "preview",
      moduleStatus: "draft",
    });
    const { getByTestId } = render(
      <TourProvider>
        <Harness />
      </TourProvider>,
    );
    await waitFor(() => expect(getByTestId("script-id").textContent).toBe(SCRIPT_ID));
    expect(getByTestId("current-step-id").textContent).toBe("l06-coordinator");
  });

  it("does NOT rehydrate when sessionStorage + localStorage are empty", async () => {
    mockFetch.mockResolvedValue({
      script: SCRIPT as any,
      mode: "preview",
      moduleStatus: "draft",
    });
    const { getByTestId } = render(
      <TourProvider>
        <Harness />
      </TourProvider>,
    );
    // Nothing rehydratable. TourProvider stays at INITIAL_STATE.
    await new Promise((r) => setTimeout(r, 40));
    expect(getByTestId("script-id").textContent).toBe("-none-");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("does NOT rehydrate a pre-fix persistence entry (missing cert/lesson)", async () => {
    // Pre-fix write shape lacks the mount-fix identifiers. Cannot resume
    // without them; silently skip.
    window.sessionStorage.setItem(
      `ht.pcert.tour.preview.${SCRIPT_ID}.${SCRIPT_VERSION}`,
      JSON.stringify({
        currentStepId: "l06-open-fixture",
        updatedAt: new Date().toISOString(),
        scriptVersion: SCRIPT_VERSION,
      }),
    );
    mockFetch.mockResolvedValue({
      script: SCRIPT as any,
      mode: "preview",
      moduleStatus: "draft",
    });
    const { getByTestId } = render(
      <TourProvider>
        <Harness />
      </TourProvider>,
    );
    await new Promise((r) => setTimeout(r, 40));
    expect(getByTestId("script-id").textContent).toBe("-none-");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("leaves TourProvider in a safe state when the rehydration fetch fails", async () => {
    writePreviewState(SCRIPT_ID, SCRIPT_VERSION, {
      currentStepId: "l06-open-fixture",
      updatedAt: new Date().toISOString(),
      certificationId: CERT,
      lessonId: LESSON,
    });
    mockFetch.mockRejectedValue(new Error("network down"));
    const { getByTestId } = render(
      <TourProvider>
        <Harness />
      </TourProvider>,
    );
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    // start() catches the throw and leaves state as INITIAL_STATE
    // plus a user-facing error message. The provider does NOT crash.
    expect(getByTestId("script-id").textContent).toBe("-none-");
  });

  it("only fires the rehydration effect once per provider lifecycle", async () => {
    writePreviewState(SCRIPT_ID, SCRIPT_VERSION, {
      currentStepId: "l06-open-fixture",
      updatedAt: new Date().toISOString(),
      certificationId: CERT,
      lessonId: LESSON,
    });
    mockFetch.mockResolvedValue({
      script: SCRIPT as any,
      mode: "preview",
      moduleStatus: "draft",
    });
    const { getByTestId, rerender } = render(
      <TourProvider>
        <Harness />
      </TourProvider>,
    );
    await waitFor(() => expect(getByTestId("script-id").textContent).toBe(SCRIPT_ID));
    // Force a re-render of the harness (not a remount of the provider).
    rerender(
      <TourProvider>
        <Harness />
      </TourProvider>,
    );
    await new Promise((r) => setTimeout(r, 40));
    // fetchTourScript must NOT have been called a second time.
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

// ─── TourRunner singleton + workspace-anchor path ────────────────────────────

describe("Track 2 mount-fix — TourRunner rendering after rehydration", () => {
  beforeAll(() => {
    // Plant the Coordinator anchor so step 3 can resolve.
    const el = document.createElement("div");
    el.setAttribute("data-training-id", "portal.workspace.coordinator");
    document.body.appendChild(el);
  });

  it("renders exactly ONE TourRunner element after rehydration (singleton invariant)", async () => {
    writePreviewState(SCRIPT_ID, SCRIPT_VERSION, {
      currentStepId: "l06-open-fixture",
      updatedAt: new Date().toISOString(),
      certificationId: CERT,
      lessonId: LESSON,
    });
    mockFetch.mockResolvedValue({
      script: SCRIPT as any,
      mode: "preview",
      moduleStatus: "draft",
    });
    render(
      <TourProvider>
        <Harness />
      </TourProvider>,
    );
    await waitFor(() =>
      expect(document.querySelectorAll("[data-tour-runner]").length).toBe(1),
    );
  });
});

// ─── Preview-mode invariants ─────────────────────────────────────────────────

describe("Track 2 mount-fix — preview intent survives rehydration", () => {
  it("state.mode is 'preview' after rehydrating a preview entry", async () => {
    writePreviewState(SCRIPT_ID, SCRIPT_VERSION, {
      currentStepId: "l06-intro",
      updatedAt: new Date().toISOString(),
      certificationId: CERT,
      lessonId: LESSON,
    });
    mockFetch.mockResolvedValue({
      script: SCRIPT as any,
      // Even if the server reports learner mode, previewIntentRef must win.
      mode: "learner",
      moduleStatus: "draft",
    });
    const { getByTestId } = render(
      <TourProvider>
        <Harness />
      </TourProvider>,
    );
    await waitFor(() => expect(getByTestId("script-id").textContent).toBe(SCRIPT_ID));
    expect(getByTestId("mode").textContent).toBe("preview");
  });
});

// ─── Cleanup on exit — protect against unintended re-launch ─────────────────

describe("Track 2 mount-fix — exit clears sessionStorage so no rehydration re-fires", () => {
  it("after exit + fresh TourProvider mount, no rehydration occurs", async () => {
    // Write the preview state as if a live tour was mid-flight.
    writePreviewState(SCRIPT_ID, SCRIPT_VERSION, {
      currentStepId: "l06-intro",
      updatedAt: new Date().toISOString(),
      certificationId: CERT,
      lessonId: LESSON,
    });
    // The exit() code clears preview state. Simulate that outcome.
    clearPreviewState(SCRIPT_ID, SCRIPT_VERSION);

    mockFetch.mockResolvedValue({
      script: SCRIPT as any,
      mode: "preview",
      moduleStatus: "draft",
    });
    const { getByTestId } = render(
      <TourProvider>
        <Harness />
      </TourProvider>,
    );
    await new Promise((r) => setTimeout(r, 40));
    // No script means the exit-then-mount cycle did NOT rehydrate.
    expect(getByTestId("script-id").textContent).toBe("-none-");
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
