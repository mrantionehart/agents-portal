// ============================================================================
// AP2 tour — runner behavior tests
// ============================================================================
// Validates:
//   * step ordering + Next/Back
//   * incorrect clicks do not advance
//   * target_click only advances on the matched target
//   * missing target renders the fallback + does NOT auto-advance
// ============================================================================

import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { TourProvider, useTour } from "../TourProvider";
import { TourRunner } from "../TourRunner";

jest.mock("../api", () => ({
  fetchTourScript: jest.fn(),
  submitTourCompletion: jest.fn(),
  TourApiError: class extends Error {},
}));
jest.mock("next/navigation", () => ({
  usePathname: () => "/home",
}));

import { fetchTourScript } from "../api";
const mockFetch = fetchTourScript as jest.MockedFunction<typeof fetchTourScript>;

const SCRIPT_TARGET_CLICK = {
  id: "portal.foundations.dashboard",
  lessonId: "pcert-l02",
  certificationId: "hartfelt-platform-certified",
  scriptVersion: "1.0.0",
  steps: [
    {
      id: "s1",
      order: 1,
      targetId: null,
      title: "Step 1",
      bodyContent: [{ type: "paragraph", text: "Intro" }],
      placement: "center",
      interaction: { kind: "informational" },
      optional: false,
    },
    {
      id: "s2",
      order: 2,
      targetId: "portal.navigation.home",
      title: "Click Home",
      bodyContent: [{ type: "paragraph", text: "Click the highlighted link." }],
      placement: "right",
      interaction: { kind: "target_click", targetId: "portal.navigation.home" },
      optional: false,
    },
    {
      id: "s3",
      order: 3,
      targetId: null,
      title: "Done",
      bodyContent: [{ type: "paragraph", text: "Finish." }],
      placement: "center",
      interaction: { kind: "informational" },
      optional: false,
    },
  ],
};

function Launcher({ preview }: { preview: boolean }) {
  const t = useTour();
  return (
    <button
      data-testid="start"
      onClick={() =>
        t.start({
          certificationId: "hartfelt-platform-certified",
          lessonId: "pcert-l02",
          preview,
        })
      }
    >
      start
    </button>
  );
}

beforeEach(() => {
  mockFetch.mockReset();
  window.localStorage.clear();
  window.sessionStorage.clear();
  document.body.innerHTML = "";
});

describe("TourRunner — ordering", () => {
  it("renders step 1 after start()", async () => {
    mockFetch.mockResolvedValueOnce({
      script: SCRIPT_TARGET_CLICK as unknown as Awaited<ReturnType<typeof mockFetch>>["script"],
      mode: "preview",
      moduleStatus: "draft",
    } as Awaited<ReturnType<typeof mockFetch>>);

    render(
      <TourProvider>
        <Launcher preview />
        <TourRunner />
      </TourProvider>,
    );
    await act(async () => fireEvent.click(screen.getByTestId("start")));

    expect(screen.getByText("Step 1")).toBeInTheDocument();
    expect(screen.getByText(/1\/3/)).toBeInTheDocument();
  });

  it("Next advances step 1 → 2", async () => {
    mockFetch.mockResolvedValueOnce({
      script: SCRIPT_TARGET_CLICK as unknown as Awaited<ReturnType<typeof mockFetch>>["script"],
      mode: "preview",
      moduleStatus: "draft",
    } as Awaited<ReturnType<typeof mockFetch>>);

    // Plant the target so step 2 (target_click) can render without the
    // missing-target fallback taking over.
    const el = document.createElement("a");
    el.setAttribute("data-training-id", "portal.navigation.home");
    document.body.appendChild(el);

    render(
      <TourProvider>
        <Launcher preview />
        <TourRunner />
      </TourProvider>,
    );
    await act(async () => fireEvent.click(screen.getByTestId("start")));

    await act(async () => fireEvent.click(screen.getByText("Next")));

    expect(screen.getByText("Click Home")).toBeInTheDocument();
    expect(screen.getByText(/2\/3/)).toBeInTheDocument();
  });

  it("Back rewinds without submitting", async () => {
    mockFetch.mockResolvedValueOnce({
      script: SCRIPT_TARGET_CLICK as unknown as Awaited<ReturnType<typeof mockFetch>>["script"],
      mode: "preview",
      moduleStatus: "draft",
    } as Awaited<ReturnType<typeof mockFetch>>);

    const el = document.createElement("a");
    el.setAttribute("data-training-id", "portal.navigation.home");
    document.body.appendChild(el);

    render(
      <TourProvider>
        <Launcher preview />
        <TourRunner />
      </TourProvider>,
    );
    await act(async () => fireEvent.click(screen.getByTestId("start")));
    await act(async () => fireEvent.click(screen.getByText("Next")));
    await act(async () => fireEvent.click(screen.getByText("Back")));

    expect(screen.getByText("Step 1")).toBeInTheDocument();
    const { submitTourCompletion } = require("../api");
    expect(submitTourCompletion).not.toHaveBeenCalled();
  });
});

describe("TourRunner — target_click enforcement", () => {
  it("advances ONLY when the resolved target is clicked", async () => {
    mockFetch.mockResolvedValueOnce({
      script: SCRIPT_TARGET_CLICK as unknown as Awaited<ReturnType<typeof mockFetch>>["script"],
      mode: "preview",
      moduleStatus: "draft",
    } as Awaited<ReturnType<typeof mockFetch>>);

    const target = document.createElement("a");
    target.setAttribute("data-training-id", "portal.navigation.home");
    document.body.appendChild(target);
    const decoy = document.createElement("button");
    decoy.setAttribute("data-testid", "decoy");
    document.body.appendChild(decoy);

    render(
      <TourProvider>
        <Launcher preview />
        <TourRunner />
      </TourProvider>,
    );
    await act(async () => fireEvent.click(screen.getByTestId("start")));
    await act(async () => fireEvent.click(screen.getByText("Next")));

    // Confirm on target_click step
    expect(screen.getByText("Click Home")).toBeInTheDocument();

    // Decoy click — must NOT advance
    await act(async () => fireEvent.click(decoy));
    expect(screen.getByText("Click Home")).toBeInTheDocument();
    expect(screen.getByText(/2\/3/)).toBeInTheDocument();

    // Target click — advances
    await act(async () => fireEvent.click(target));
    expect(screen.getByText("Done")).toBeInTheDocument();
    expect(screen.getByText(/3\/3/)).toBeInTheDocument();
  });
});

// ─── PILOT-D-013 — target_click microtask deferral ─────────────────────────
//
// A synchronous `setState` inside the native document-capture click handler
// used to perturb React's internal update pipeline between capture and
// synthetic-event delegation, dropping the target element's own onClick.
// pcert-l09 step 3 (target_click on portal.workspace.tab.ai) advanced the
// tour but never let Next.js Link's router.push execute, so the URL never
// switched to `?tab=ai` and the next spotlight fired MissingTargetCard.
//
// The fix (TourProvider.tsx target_click useEffect): wrap the setState in
// queueMicrotask so the click event completes its full dispatch — including
// the target's React-synthetic onClick — BEFORE React reconciles the tour
// state change.
//
// These tests prove that both effects occur on a single target_click:
//   1. the target element's own onClick handler runs
//   2. the tour advances
// and that Option A's specific implementation (queueMicrotask + capture
// phase listener) is preserved.

describe("TourRunner — PILOT-D-013 target_click microtask deferral", () => {
  it("target element's own onClick handler runs when target_click advances the tour", async () => {
    mockFetch.mockResolvedValueOnce({
      script: SCRIPT_TARGET_CLICK as unknown as Awaited<ReturnType<typeof mockFetch>>["script"],
      mode: "preview",
      moduleStatus: "draft",
    } as Awaited<ReturnType<typeof mockFetch>>);

    // Plant a Link-like target: has the training anchor AND its own
    // onClick that mutates observable state (analogous to Next.js Link's
    // router.push). If the tour handler drops the click, this handler
    // never fires.
    let underlyingNavCalled = false;
    let navCallCount = 0;
    const target = document.createElement("a");
    target.setAttribute("data-training-id", "portal.navigation.home");
    target.setAttribute("href", "/home");
    target.addEventListener("click", (ev) => {
      // Simulate Next.js Link intercepting: preventDefault + soft-nav.
      ev.preventDefault();
      underlyingNavCalled = true;
      navCallCount += 1;
    });
    document.body.appendChild(target);

    render(
      <TourProvider>
        <Launcher preview />
        <TourRunner />
      </TourProvider>,
    );
    await act(async () => fireEvent.click(screen.getByTestId("start")));
    await act(async () => fireEvent.click(screen.getByText("Next")));

    expect(screen.getByText("Click Home")).toBeInTheDocument();

    // The single click on the target should:
    //   1. fire the target's own onClick (underlyingNavCalled === true)
    //   2. advance the tour (Done step visible)
    await act(async () => fireEvent.click(target));

    expect(underlyingNavCalled).toBe(true);
    expect(navCallCount).toBe(1);
    expect(screen.getByText("Done")).toBeInTheDocument();
    expect(screen.getByText(/3\/3/)).toBeInTheDocument();
  });

  it("target's onClick fires exactly once even though tour handler also processes the click", async () => {
    // Regression guard: the tour handler must NOT invoke or re-fire the
    // target's onClick — it only defers a setState. If the microtask
    // callback somehow re-dispatches the click, this test would count > 1.
    mockFetch.mockResolvedValueOnce({
      script: SCRIPT_TARGET_CLICK as unknown as Awaited<ReturnType<typeof mockFetch>>["script"],
      mode: "preview",
      moduleStatus: "draft",
    } as Awaited<ReturnType<typeof mockFetch>>);

    let count = 0;
    const target = document.createElement("a");
    target.setAttribute("data-training-id", "portal.navigation.home");
    target.setAttribute("href", "/home");
    target.addEventListener("click", (ev) => { ev.preventDefault(); count += 1; });
    document.body.appendChild(target);

    render(
      <TourProvider>
        <Launcher preview />
        <TourRunner />
      </TourProvider>,
    );
    await act(async () => fireEvent.click(screen.getByTestId("start")));
    await act(async () => fireEvent.click(screen.getByText("Next")));

    await act(async () => fireEvent.click(target));
    expect(count).toBe(1);
  });

  it("advances even when the target's onClick calls preventDefault (Next.js Link idiom)", async () => {
    // Next.js Link always calls preventDefault on the anchor's default nav
    // to substitute soft-nav via router.push. The tour handler must still
    // advance regardless of preventDefault having been called earlier in
    // the same event.
    mockFetch.mockResolvedValueOnce({
      script: SCRIPT_TARGET_CLICK as unknown as Awaited<ReturnType<typeof mockFetch>>["script"],
      mode: "preview",
      moduleStatus: "draft",
    } as Awaited<ReturnType<typeof mockFetch>>);

    const target = document.createElement("a");
    target.setAttribute("data-training-id", "portal.navigation.home");
    target.setAttribute("href", "/home");
    // Native listener attached BEFORE the tour handler; but the tour
    // handler is on document in capture phase so it still fires first.
    // preventDefault by ANY handler must not disrupt tour advance.
    target.addEventListener("click", (ev) => { ev.preventDefault(); });
    document.body.appendChild(target);

    render(
      <TourProvider>
        <Launcher preview />
        <TourRunner />
      </TourProvider>,
    );
    await act(async () => fireEvent.click(screen.getByTestId("start")));
    await act(async () => fireEvent.click(screen.getByText("Next")));

    await act(async () => fireEvent.click(target));
    expect(screen.getByText("Done")).toBeInTheDocument();
  });

  it("source contract: tour advance is wrapped in queueMicrotask (PILOT-D-013 shape)", () => {
    // Guards against a well-meaning refactor removing the microtask
    // deferral. Read the TourProvider source and assert the exact
    // wrapping is present in the target_click handler.
    const fs = require("node:fs") as typeof import("node:fs");
    const path = require("node:path") as typeof import("node:path");
    const src = fs.readFileSync(
      path.resolve(__dirname, "..", "TourProvider.tsx"),
      "utf8",
    );
    // The target_click useEffect must contain queueMicrotask wrapping
    // the setState call.
    expect(src).toMatch(/queueMicrotask\(\(\)\s*=>\s*\{[\s\S]{0,80}?setState\(\(s\)\s*=>\s*advance\(s\)\)/);
    // Listener still registered in capture phase (Option A does not
    // change phase).
    expect(src).toMatch(/document\.addEventListener\("click",\s*handler,\s*true\)/);
  });
});

describe("TourRunner — missing target fallback", () => {
  it("renders the fallback card and does NOT auto-advance", async () => {
    mockFetch.mockResolvedValueOnce({
      script: SCRIPT_TARGET_CLICK as unknown as Awaited<ReturnType<typeof mockFetch>>["script"],
      mode: "preview",
      moduleStatus: "draft",
    } as Awaited<ReturnType<typeof mockFetch>>);

    // Intentionally do NOT plant the target — step 2 will be missing.
    render(
      <TourProvider>
        <Launcher preview />
        <TourRunner />
      </TourProvider>,
    );
    await act(async () => fireEvent.click(screen.getByTestId("start")));
    await act(async () => fireEvent.click(screen.getByText("Next")));

    // Missing-target fallback appears AFTER the bounded resolution
    // timeout (~750ms) elapses. Before the timeout, the resolver is
    // still pending and no fallback is shown.
    await waitFor(
      () => {
        expect(
          screen.getByText(/Element not found on this screen/),
        ).toBeInTheDocument();
      },
      { timeout: 2000 },
    );
    // Both Exit and Retry are reachable.
    expect(screen.getByText(/Exit tour/)).toBeInTheDocument();
    expect(screen.getByText(/Retry from step 1/)).toBeInTheDocument();
    // Step 3 title ("Done") does NOT appear — proof we did not auto-advance
    // past the missing-target step.
    expect(screen.queryByText("Done")).toBeNull();
  });
});

// ─── PILOT-D-020 — confirmLabel surfacing for manual_confirmation ────────────
//
// TourRunner previously hardcoded "Next" as the advance-button label for
// every non-final step regardless of interaction kind. This meant a
// `manual_confirmation` step's authored `confirmLabel` (e.g. pcert-l10
// step 4's "I generated a draft and can see the draft card") never
// reached learners — the label was dead code, and users clicked "Next"
// on the confirmation step as reflexively as they would on any
// informational step. The downstream spotlights (pcert-l10 steps 5-7)
// then failed with MissingTargetCard because the precondition the
// author encoded in `confirmLabel` had never actually been performed.
//
// The fix: TourRunner's advance-button text derives from
// `step.interaction.confirmLabel` when the interaction is
// `manual_confirmation` and a label is present. Every other interaction
// kind — `informational`, `target_click`, `route_change` — is
// unaffected. Backward compatible: a manual_confirmation step with an
// empty/absent confirmLabel still renders "Next".
//
// These tests pin the fix: (1) manual_confirmation with confirmLabel
// renders the label; (2) manual_confirmation without confirmLabel falls
// back to "Next"; (3-5) informational, target_click, route_change
// button/label rendering unchanged; (6) keyboard accessibility
// (focus-trap escape + tab order) unchanged.

const MANUAL_CONFIRMATION_SCRIPT = {
  id: "portal.foundations.manual",
  lessonId: "pcert-lXX",
  certificationId: "hartfelt-platform-certified",
  scriptVersion: "1.0.0",
  steps: [
    {
      id: "mc1",
      order: 1,
      targetId: null,
      title: "Ask the Assistant for a draft.",
      bodyContent: [{ type: "paragraph", text: "Do the thing." }],
      placement: "center",
      interaction: {
        kind: "manual_confirmation",
        confirmLabel: "I generated a draft and can see the draft card",
      },
      optional: false,
    },
    {
      id: "mc2",
      order: 2,
      targetId: null,
      title: "Recap",
      bodyContent: [{ type: "paragraph", text: "Done." }],
      placement: "center",
      interaction: { kind: "informational" },
      optional: false,
    },
  ],
};

const MANUAL_CONFIRMATION_NO_LABEL_SCRIPT = {
  ...MANUAL_CONFIRMATION_SCRIPT,
  steps: [
    {
      ...MANUAL_CONFIRMATION_SCRIPT.steps[0],
      interaction: {
        kind: "manual_confirmation",
        // Empty label — the runtime fallback must render "Next".
        confirmLabel: "",
      },
    },
    MANUAL_CONFIRMATION_SCRIPT.steps[1],
  ],
};

const ROUTE_CHANGE_SCRIPT = {
  id: "portal.foundations.route",
  lessonId: "pcert-lXX",
  certificationId: "hartfelt-platform-certified",
  scriptVersion: "1.0.0",
  steps: [
    {
      id: "rc1",
      order: 1,
      targetId: null,
      title: "Navigate",
      bodyContent: [{ type: "paragraph", text: "Go somewhere." }],
      placement: "center",
      interaction: { kind: "route_change", expectedRoute: "/somewhere" },
      optional: false,
    },
    {
      id: "rc2",
      order: 2,
      targetId: null,
      title: "Recap",
      bodyContent: [{ type: "paragraph", text: "Done." }],
      placement: "center",
      interaction: { kind: "informational" },
      optional: false,
    },
  ],
};

describe("TourRunner — PILOT-D-020 confirmLabel surfacing", () => {
  it("(1) manual_confirmation WITH confirmLabel renders the custom label as the advance button", async () => {
    mockFetch.mockResolvedValueOnce({
      script: MANUAL_CONFIRMATION_SCRIPT as unknown as Awaited<ReturnType<typeof mockFetch>>["script"],
      mode: "preview",
      moduleStatus: "draft",
    } as Awaited<ReturnType<typeof mockFetch>>);

    render(
      <TourProvider>
        <Launcher preview />
        <TourRunner />
      </TourProvider>,
    );
    await act(async () => fireEvent.click(screen.getByTestId("start")));

    // The custom label is the advance button. The generic "Next" must NOT
    // appear on this step.
    expect(
      screen.getByRole("button", {
        name: "I generated a draft and can see the draft card",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
  });

  it("(1a) clicking the custom-label button still advances the tour to step 2", async () => {
    mockFetch.mockResolvedValueOnce({
      script: MANUAL_CONFIRMATION_SCRIPT as unknown as Awaited<ReturnType<typeof mockFetch>>["script"],
      mode: "preview",
      moduleStatus: "draft",
    } as Awaited<ReturnType<typeof mockFetch>>);

    render(
      <TourProvider>
        <Launcher preview />
        <TourRunner />
      </TourProvider>,
    );
    await act(async () => fireEvent.click(screen.getByTestId("start")));

    await act(async () =>
      fireEvent.click(
        screen.getByRole("button", {
          name: "I generated a draft and can see the draft card",
        }),
      ),
    );

    // Step 2 (informational recap) is now visible.
    expect(screen.getByText("Recap")).toBeInTheDocument();
    expect(screen.getByText(/2\/2/)).toBeInTheDocument();
  });

  it("(2) manual_confirmation WITHOUT confirmLabel falls back to 'Next'", async () => {
    mockFetch.mockResolvedValueOnce({
      script: MANUAL_CONFIRMATION_NO_LABEL_SCRIPT as unknown as Awaited<ReturnType<typeof mockFetch>>["script"],
      mode: "preview",
      moduleStatus: "draft",
    } as Awaited<ReturnType<typeof mockFetch>>);

    render(
      <TourProvider>
        <Launcher preview />
        <TourRunner />
      </TourProvider>,
    );
    await act(async () => fireEvent.click(screen.getByTestId("start")));

    // With no confirmLabel, the generic "Next" is the advance button.
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
  });

  it("(3) informational step still renders 'Next' (unchanged)", async () => {
    mockFetch.mockResolvedValueOnce({
      script: SCRIPT_TARGET_CLICK as unknown as Awaited<ReturnType<typeof mockFetch>>["script"],
      mode: "preview",
      moduleStatus: "draft",
    } as Awaited<ReturnType<typeof mockFetch>>);

    render(
      <TourProvider>
        <Launcher preview />
        <TourRunner />
      </TourProvider>,
    );
    await act(async () => fireEvent.click(screen.getByTestId("start")));

    // SCRIPT_TARGET_CLICK step 1 is `informational` — must render "Next".
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
  });

  it("(4) target_click step does not render a Next button at all (unchanged)", async () => {
    mockFetch.mockResolvedValueOnce({
      script: SCRIPT_TARGET_CLICK as unknown as Awaited<ReturnType<typeof mockFetch>>["script"],
      mode: "preview",
      moduleStatus: "draft",
    } as Awaited<ReturnType<typeof mockFetch>>);

    const el = document.createElement("a");
    el.setAttribute("data-training-id", "portal.navigation.home");
    document.body.appendChild(el);

    render(
      <TourProvider>
        <Launcher preview />
        <TourRunner />
      </TourProvider>,
    );
    await act(async () => fireEvent.click(screen.getByTestId("start")));
    // Advance to the target_click step.
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Next" })));

    // On a target_click step, the advance is via the anchor click —
    // no Next button and no confirmLabel button. The awaiting-label
    // banner is what's shown instead.
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
    expect(
      screen.queryByRole("button", {
        name: "I generated a draft and can see the draft card",
      }),
    ).toBeNull();
    expect(
      screen.getByText(/Click the highlighted element to continue/),
    ).toBeInTheDocument();
  });

  it("(5) route_change step does not render a Next button (unchanged)", async () => {
    mockFetch.mockResolvedValueOnce({
      script: ROUTE_CHANGE_SCRIPT as unknown as Awaited<ReturnType<typeof mockFetch>>["script"],
      mode: "preview",
      moduleStatus: "draft",
    } as Awaited<ReturnType<typeof mockFetch>>);

    render(
      <TourProvider>
        <Launcher preview />
        <TourRunner />
      </TourProvider>,
    );
    await act(async () => fireEvent.click(screen.getByTestId("start")));

    // route_change is waiting-for-route; no Next button.
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
    expect(
      screen.getByText(/Waiting for you to reach the next surface/),
    ).toBeInTheDocument();
  });

  it("(6) keyboard: the custom-label button is focusable, Escape opens Exit-tour confirm (a11y unchanged)", async () => {
    mockFetch.mockResolvedValueOnce({
      script: MANUAL_CONFIRMATION_SCRIPT as unknown as Awaited<ReturnType<typeof mockFetch>>["script"],
      mode: "preview",
      moduleStatus: "draft",
    } as Awaited<ReturnType<typeof mockFetch>>);

    render(
      <TourProvider>
        <Launcher preview />
        <TourRunner />
      </TourProvider>,
    );
    await act(async () => fireEvent.click(screen.getByTestId("start")));

    const advanceBtn = screen.getByRole("button", {
      name: "I generated a draft and can see the draft card",
    });
    // The button is a real <button> — accessible-name query above proved it.
    // It carries type="button" and is not disabled — same as pre-fix Next.
    expect(advanceBtn.tagName).toBe("BUTTON");
    expect(advanceBtn.getAttribute("type")).toBe("button");
    expect(advanceBtn).not.toBeDisabled();

    // Escape still opens the Exit-tour confirmation panel.
    const dialog = screen.getByRole("dialog");
    await act(async () => fireEvent.keyDown(dialog, { key: "Escape" }));
    // ExitConfirm surfaces a discard/keep pair (existing behavior — the
    // exact copy is owned by ExitConfirm and not what this test guards;
    // we only verify the advance button is no longer visible, i.e. the
    // exit-confirm view took over).
    expect(
      screen.queryByRole("button", {
        name: "I generated a draft and can see the draft card",
      }),
    ).toBeNull();
  });
});
