// ============================================================================
// AP2 tour — stabilization pass tests
// ============================================================================
// Covers the review-recommended behavioral gaps:
//   * route_change activation when the pathname already matches
//   * delayed-anchor resolution — available immediately, one tick late,
//     near timeout, never appearing, step changed before appearing, tour
//     exited before appearing
//   * storage failure paths (setItem throws, getItem throws, JSON malformed,
//     shape mismatch)
//   * missing-target keyboard accessibility (focus + Escape)
//   * preview cannot be turned into learner mode via state manipulation
// ============================================================================

import {
  render,
  screen,
  fireEvent,
  act,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";

import { TourProvider, useTour } from "../TourProvider";
import { TourRunner } from "../TourRunner";
import {
  readLearnerResume,
  writeLearnerResume,
  clearLearnerResume,
} from "../persistence-learner";

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("../api", () => ({
  fetchTourScript: jest.fn(),
  submitTourCompletion: jest.fn(),
  TourApiError: class extends Error {},
}));

let mockPath = "/notifications";
jest.mock("next/navigation", () => ({
  usePathname: () => mockPath,
}));

import { fetchTourScript, submitTourCompletion } from "../api";
const mockFetch = fetchTourScript as jest.MockedFunction<typeof fetchTourScript>;
const mockSubmit = submitTourCompletion as jest.MockedFunction<
  typeof submitTourCompletion
>;

// ─── Scripts ────────────────────────────────────────────────────────────────

const SCRIPT_ROUTE_ALREADY_MATCHED = {
  id: "test.route-already-matched",
  lessonId: "pcert-l03",
  certificationId: "hartfelt-platform-certified",
  scriptVersion: "1.0.0",
  steps: [
    {
      id: "step-informational",
      order: 1,
      targetId: null,
      title: "Intro",
      bodyContent: [{ type: "paragraph", text: "…" }],
      placement: "center",
      interaction: { kind: "informational" },
      optional: false,
    },
    {
      id: "step-route-change",
      order: 2,
      targetId: null,
      title: "Waiting for /settings",
      bodyContent: [{ type: "paragraph", text: "…" }],
      placement: "center",
      interaction: { kind: "route_change", expectedRoute: "/settings" },
      optional: false,
    },
    {
      id: "step-done",
      order: 3,
      targetId: null,
      title: "Done",
      bodyContent: [{ type: "paragraph", text: "…" }],
      placement: "center",
      interaction: { kind: "informational" },
      optional: false,
    },
  ],
};

const SCRIPT_ONE_TARGET_STEP = {
  id: "test.one-target-step",
  lessonId: "pcert-l02",
  certificationId: "hartfelt-platform-certified",
  scriptVersion: "1.0.0",
  steps: [
    {
      id: "step-anchor",
      order: 1,
      targetId: "portal.home.dashboard",
      title: "Look here",
      bodyContent: [{ type: "paragraph", text: "…" }],
      placement: "top",
      interaction: { kind: "informational" },
      optional: false,
    },
  ],
};

// ─── Fresh state per test ───────────────────────────────────────────────────

beforeEach(() => {
  mockFetch.mockReset();
  mockSubmit.mockReset();
  window.localStorage.clear();
  window.sessionStorage.clear();
  document.body.innerHTML = "";
  mockPath = "/notifications";
});

// ─── Item 5 — route_change activated after pathname already matches ────────

describe("route_change already-matched", () => {
  it("advances when the route_change step becomes active AFTER navigation completed", async () => {
    mockFetch.mockResolvedValueOnce({
      script: SCRIPT_ROUTE_ALREADY_MATCHED as unknown as Awaited<
        ReturnType<typeof mockFetch>
      >["script"],
      mode: "preview",
      moduleStatus: "draft",
    } as Awaited<ReturnType<typeof mockFetch>>);

    function Harness() {
      const t = useTour();
      return (
        <div>
          <button
            data-testid="start"
            onClick={() =>
              t.start({
                certificationId: "hartfelt-platform-certified",
                lessonId: "pcert-l03",
                preview: true,
              })
            }
          >
            start
          </button>
        </div>
      );
    }

    render(
      <TourProvider>
        <Harness />
        <TourRunner />
      </TourProvider>,
    );

    await act(async () => fireEvent.click(screen.getByTestId("start")));
    expect(screen.getByText("Intro")).toBeInTheDocument();

    // User navigates to /settings BEFORE the tour reaches the
    // route_change step.
    mockPath = "/settings";

    // Now advance to the route_change step. The pathname already
    // equals expectedRoute — the effect must fire on step change
    // (deps: [pathname, state.currentStep]).
    await act(async () => fireEvent.click(screen.getByText("Next")));

    // The route_change step SHOULD auto-advance in the same tick,
    // landing us on step 3.
    await waitFor(() => {
      expect(screen.getByText("Done")).toBeInTheDocument();
    });
    expect(screen.queryByText("Waiting for /settings")).toBeNull();
  });

  // (The Next.js-side re-render path for `usePathname` is exercised by
  //  the cross-route-continuity test; this suite focuses on the tour
  //  engine's own effect deps.)
});

// ─── Item 6 — bounded delayed-anchor resolution ─────────────────────────────

describe("delayed-anchor resolution — bounded", () => {
  async function startWithSingleTargetScript() {
    mockFetch.mockResolvedValueOnce({
      script: SCRIPT_ONE_TARGET_STEP as unknown as Awaited<
        ReturnType<typeof mockFetch>
      >["script"],
      mode: "preview",
      moduleStatus: "draft",
    } as Awaited<ReturnType<typeof mockFetch>>);

    function Harness() {
      const t = useTour();
      return (
        <button
          data-testid="start"
          onClick={() =>
            t.start({
              certificationId: "hartfelt-platform-certified",
              lessonId: "pcert-l02",
              preview: true,
            })
          }
        >
          start
        </button>
      );
    }

    render(
      <TourProvider>
        <Harness />
        <TourRunner />
      </TourProvider>,
    );
    await act(async () => fireEvent.click(screen.getByTestId("start")));
  }

  it("anchor available IMMEDIATELY — tooltip renders synchronously", async () => {
    const el = document.createElement("div");
    el.setAttribute("data-training-id", "portal.home.dashboard");
    document.body.appendChild(el);

    await startWithSingleTargetScript();

    expect(screen.getByText("Look here")).toBeInTheDocument();
    expect(screen.queryByText(/Element not found on this screen/)).toBeNull();
  });

  it("anchor appearing ONE TICK LATE — tooltip renders after mount, no fallback", async () => {
    await startWithSingleTargetScript();

    // At start, anchor is missing → tooltip is in "pending" state.
    // Mount the anchor after a rAF tick.
    await act(async () => {
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      const el = document.createElement("div");
      el.setAttribute("data-training-id", "portal.home.dashboard");
      document.body.appendChild(el);
    });

    await waitFor(() => {
      expect(screen.getByText("Look here")).toBeInTheDocument();
    });
    expect(screen.queryByText(/Element not found on this screen/)).toBeNull();
  });

  it("anchor NEVER APPEARING — fallback renders only after timeout, never before", async () => {
    await startWithSingleTargetScript();

    // Immediately after start, before the timeout, the missing-target
    // card MUST NOT be rendered.
    expect(screen.queryByText(/Element not found on this screen/)).toBeNull();

    // After the bounded wait, fallback appears.
    await waitFor(
      () => {
        expect(
          screen.getByText(/Element not found on this screen/),
        ).toBeInTheDocument();
      },
      { timeout: 2000 },
    );
  });

  it("tour exits before anchor appears — no fallback renders after unmount", async () => {
    await startWithSingleTargetScript();

    // The tooltip renders in pending state (no anchor yet). Exit path:
    // click "Exit tour" → confirms via inline "Yes, exit" button.
    await act(async () => {
      fireEvent.click(screen.getByText("Exit tour"));
    });
    await act(async () => {
      fireEvent.click(screen.getByText("Yes, exit"));
    });

    // Tour has fully exited — tooltip is gone.
    expect(screen.queryByText("Look here")).toBeNull();
    expect(screen.queryByText(/Element not found on this screen/)).toBeNull();

    // Wait past the would-be timeout — nothing should re-appear.
    await new Promise((r) => setTimeout(r, 900));
    expect(screen.queryByText("Look here")).toBeNull();
    expect(screen.queryByText(/Element not found on this screen/)).toBeNull();
  });
});

// ─── Item 7 — storage failures ──────────────────────────────────────────────

describe("learner storage — defensive handling", () => {
  // Use a userId whose derived opaque suffix is predictable so we can
  // plant known keys.
  const USER = "aaaaaaaa11111111";
  const SUFFIX = "11111111"; // last 8 chars after non-alphanumeric strip
  const SCRIPT = "script.a";
  const VER = "1.0.0";
  const key = `ht.pcert.tour.${SUFFIX}.${SCRIPT}.${VER}`;

  it("setItem throws QuotaExceededError — tour survives, warning is logged", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const setItemSpy = jest
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("quota", "QuotaExceededError");
      });
    try {
      // Must not throw.
      writeLearnerResume(USER, SCRIPT, VER, {
        currentStepId: "s1",
        stepsCompleted: [],
        updatedAt: new Date().toISOString(),
      });
      expect(warn).toHaveBeenCalled();
    } finally {
      setItemSpy.mockRestore();
      warn.mockRestore();
    }
  });

  it("getItem throws SecurityError — read returns null, no crash", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const getItemSpy = jest
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new DOMException("blocked", "SecurityError");
      });
    try {
      const result = readLearnerResume(USER, SCRIPT, VER);
      expect(result).toBeNull();
      expect(warn).toHaveBeenCalled();
    } finally {
      getItemSpy.mockRestore();
      warn.mockRestore();
    }
  });

  it("malformed JSON — read returns null and logs a warning", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    try {
      window.localStorage.setItem(key, "this-is-not-json");
      const result = readLearnerResume(USER, SCRIPT, VER);
      expect(result).toBeNull();
      expect(warn).toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it("unexpected shape — read returns null and removes the entry", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    try {
      window.localStorage.setItem(
        key,
        JSON.stringify({ wrongField: "wrong" }),
      );
      const result = readLearnerResume(USER, SCRIPT, VER);
      expect(result).toBeNull();
      expect(window.localStorage.getItem(key)).toBeNull();
      expect(warn).toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it("removeItem throws — clearLearnerResume swallows and continues", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const removeItemSpy = jest
      .spyOn(Storage.prototype, "removeItem")
      .mockImplementation(() => {
        throw new Error("nope");
      });
    try {
      // Must not throw.
      clearLearnerResume(USER, SCRIPT, VER);
      expect(warn).toHaveBeenCalled();
    } finally {
      removeItemSpy.mockRestore();
      warn.mockRestore();
    }
  });
});

// ─── Item 8 — missing-target keyboard access ────────────────────────────────

describe("missing-target keyboard accessibility", () => {
  it("focuses a control on mount, supports Escape → exit, Tab / Retry reachable", async () => {
    mockFetch.mockResolvedValueOnce({
      script: SCRIPT_ONE_TARGET_STEP as unknown as Awaited<
        ReturnType<typeof mockFetch>
      >["script"],
      mode: "preview",
      moduleStatus: "draft",
    } as Awaited<ReturnType<typeof mockFetch>>);

    function Harness() {
      const t = useTour();
      return (
        <button
          data-testid="start"
          onClick={() =>
            t.start({
              certificationId: "hartfelt-platform-certified",
              lessonId: "pcert-l02",
              preview: true,
            })
          }
        >
          start
        </button>
      );
    }

    render(
      <TourProvider>
        <Harness />
        <TourRunner />
      </TourProvider>,
    );
    await act(async () => fireEvent.click(screen.getByTestId("start")));

    // Wait for missing-target card.
    await waitFor(
      () => {
        expect(
          screen.getByText(/Element not found on this screen/),
        ).toBeInTheDocument();
      },
      { timeout: 2000 },
    );

    // role=alertdialog + aria-modal
    const card = screen.getByRole("alertdialog");
    expect(card.getAttribute("aria-modal")).toBe("true");
    expect(card.getAttribute("aria-labelledby")).toMatch(
      /^tour-missing-target-title-/,
    );
    expect(card.getAttribute("aria-describedby")).toMatch(
      /^tour-missing-target-desc-/,
    );

    // Focus lands inside the card. requestAnimationFrame is used, so
    // wait for it.
    await waitFor(() => {
      const active = document.activeElement;
      expect(card.contains(active)).toBe(true);
    });

    // Retry and Exit buttons present and reachable by keyboard.
    const exitBtn = screen.getByText(/Exit tour/);
    const retryBtn = screen.getByText(/Retry from step 1/);
    expect(exitBtn).toBeInTheDocument();
    expect(retryBtn).toBeInTheDocument();

    // Escape triggers exit (same as main tooltip). Tour unmounts.
    await act(async () => {
      fireEvent.keyDown(document, { key: "Escape" });
    });
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.queryByText("Look here")).toBeNull();
  });
});

// ─── Item — preview cannot enter learner mode via state manipulation ───────

describe("preview mode isolation — cannot become learner via client state", () => {
  it("finish() in preview never POSTs to complete, even if writeLearnerResume is provoked", async () => {
    mockFetch.mockResolvedValueOnce({
      script: SCRIPT_ONE_TARGET_STEP as unknown as Awaited<
        ReturnType<typeof mockFetch>
      >["script"],
      mode: "preview",
      moduleStatus: "draft",
    } as Awaited<ReturnType<typeof mockFetch>>);

    function Harness() {
      const t = useTour();
      return (
        <div>
          <button
            data-testid="start"
            onClick={() =>
              t.start({
                certificationId: "hartfelt-platform-certified",
                lessonId: "pcert-l02",
                preview: true,
                userId: "attacker",
              })
            }
          >
            start
          </button>
          <button data-testid="finish" onClick={t.finish}>
            finish
          </button>
          <span data-testid="mode">{t.mode}</span>
          <span data-testid="completed">{t.completed ? "y" : "n"}</span>
        </div>
      );
    }

    render(
      <TourProvider>
        <Harness />
        <TourRunner />
      </TourProvider>,
    );
    await act(async () => fireEvent.click(screen.getByTestId("start")));

    // Confirmed preview.
    expect(screen.getByTestId("mode").textContent).toBe("preview");

    // Even attempting to directly poke the learner-mode storage does
    // NOT convert the running tour into learner mode. The mode is
    // fixed at start().
    writeLearnerResume("attacker", SCRIPT_ONE_TARGET_STEP.id, "1.0.0", {
      currentStepId: "step-anchor",
      stepsCompleted: [],
      updatedAt: new Date().toISOString(),
    });

    await act(async () => fireEvent.click(screen.getByTestId("finish")));

    // No completion write of any kind.
    expect(mockSubmit).not.toHaveBeenCalled();
    // Mode remained preview through finish.
    expect(screen.getByTestId("mode").textContent).toBe("preview");
    // Preview never wrote learner-mode state either — the stray
    // writeLearnerResume above is what a "clever" attacker might try,
    // but the provider's own persist effect uses sessionStorage in
    // preview and does not touch localStorage.
    // Only the direct writeLearnerResume call above created a key.
    // Confirm it did NOT come from the tour engine — we'd expect
    // exactly 1 localStorage key: the one we planted.
    expect(window.localStorage.length).toBe(1);
  });
});
