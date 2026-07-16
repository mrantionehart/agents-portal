// ============================================================================
// Regression tests — Tour interactive surfaces carry inline pointer-events
// ============================================================================
// The tour runner root is `pointer-events-none` so the transparent overlay
// does not intercept clicks on highlighted app targets. Every interactive
// tour surface therefore has to explicitly restore `pointer-events: auto`
// so its buttons receive clicks.
//
// Previously this was done via the Tailwind utility class
// `pointer-events-auto`, but the production CSS bundle purged that utility
// (Tailwind's JIT could not detect it in the source under the current
// build configuration). The result was that every button in every tour
// surface passed all clicks through to the DOM behind it.
//
// The fix uses inline `style={{ pointerEvents: "auto" }}` on each
// interactive surface — a stable declaration that does not depend on the
// Tailwind utility surviving purge.
//
// These tests hold that guarantee: they read the actual DOM style
// attribute (not the computed style, which jsdom does not resolve from
// Tailwind classes) and confirm the inline declaration is present.
// ============================================================================

import { render, screen, fireEvent, act } from "@testing-library/react";

import { TourProvider, useTour } from "../TourProvider";
import { TourRunner } from "../TourRunner";

jest.mock("../api", () => {
  const actual = jest.requireActual("../api");
  return {
    ...actual,
    fetchTourScript: jest.fn(),
    submitTourCompletion: jest.fn(),
  };
});

jest.mock("next/navigation", () => ({
  usePathname: () => "/training",
}));

import { fetchTourScript } from "../api";
const mockFetch = fetchTourScript as jest.MockedFunction<typeof fetchTourScript>;

const CERT = "hartfelt-platform-certified";

const BASE_SCRIPT = {
  id: "test.pe",
  lessonId: "pcert-l01",
  certificationId: CERT,
  scriptVersion: "1.0.0",
  steps: [
    {
      id: "s1",
      order: 1,
      targetId: null,
      title: "Step 1",
      bodyContent: [{ type: "paragraph", text: "hello" }],
      placement: "center",
      interaction: { kind: "informational" },
      optional: false,
    },
    {
      id: "s2",
      order: 2,
      targetId: null,
      title: "Step 2 (final)",
      bodyContent: [{ type: "paragraph", text: "bye" }],
      placement: "center",
      interaction: { kind: "informational" },
      optional: false,
    },
  ],
};

const MISSING_TARGET_SCRIPT = {
  ...BASE_SCRIPT,
  id: "test.missing",
  steps: [
    {
      id: "s1",
      order: 1,
      targetId: "does-not-exist-in-dom",
      title: "Missing anchor",
      bodyContent: [{ type: "paragraph", text: "gone" }],
      placement: "bottom",
      interaction: { kind: "informational" },
      optional: false,
    },
  ],
};

function Starter({ preview = false }: { preview?: boolean }) {
  const t = useTour();
  return (
    <button
      data-testid="start"
      onClick={() =>
        t.start({ certificationId: CERT, lessonId: "pcert-l01", preview })
      }
    >
      start
    </button>
  );
}

beforeEach(() => {
  mockFetch.mockReset();
});

/**
 * Assert an element has the intended inline `pointer-events: auto`
 * declaration. Reading the `style` attribute directly is stable across
 * jsdom versions and does NOT depend on Tailwind or any external CSS.
 */
function expectInlinePointerEventsAuto(el: Element | null | undefined, label: string) {
  expect(el).toBeTruthy();
  const styleAttr = (el as HTMLElement).getAttribute("style") ?? "";
  // Reject both the missing case and the explicitly-none case.
  expect(styleAttr).toMatch(/pointer-events:\s*auto/i);
  expect((el as HTMLElement).style.pointerEvents).toBe("auto");
  // Sanity — the label helps identify which surface failed.
  void label;
}

describe("Pointer-events restoration — inline styles on every interactive tour surface", () => {
  it("Tooltip carries inline pointerEvents:auto (center placement)", async () => {
    mockFetch.mockResolvedValueOnce({
      script: BASE_SCRIPT as any,
      mode: "learner",
      moduleStatus: "published",
    } as any);
    render(
      <TourProvider>
        <Starter />
        <TourRunner />
      </TourProvider>,
    );
    await act(async () => fireEvent.click(screen.getByTestId("start")));
    const tooltip = document.querySelector("[data-tour-tooltip]");
    expectInlinePointerEventsAuto(tooltip, "Tooltip@center");
  });

  it("PreviewBanner carries inline pointerEvents:auto in preview mode", async () => {
    mockFetch.mockResolvedValueOnce({
      script: BASE_SCRIPT as any,
      mode: "preview",
      moduleStatus: "draft",
    } as any);
    render(
      <TourProvider>
        <Starter preview />
        <TourRunner />
      </TourProvider>,
    );
    await act(async () => fireEvent.click(screen.getByTestId("start")));
    const banner = document.querySelector("[data-tour-preview-banner]");
    expectInlinePointerEventsAuto(banner, "PreviewBanner");
  });

  it("CompletionCard carries inline pointerEvents:auto after finish()", async () => {
    mockFetch.mockResolvedValueOnce({
      script: BASE_SCRIPT as any,
      mode: "preview",
      moduleStatus: "draft",
    } as any);

    function DriveToFinish() {
      const t = useTour();
      return (
        <>
          <button
            data-testid="start"
            onClick={() =>
              t.start({ certificationId: CERT, lessonId: "pcert-l01", preview: true })
            }
          >
            start
          </button>
          <button data-testid="finish" onClick={t.finish}>
            finish
          </button>
        </>
      );
    }

    render(
      <TourProvider>
        <DriveToFinish />
        <TourRunner />
      </TourProvider>,
    );
    await act(async () => fireEvent.click(screen.getByTestId("start")));
    await act(async () => fireEvent.click(screen.getByTestId("finish")));
    const card = document.querySelector("[data-tour-completion]");
    expectInlinePointerEventsAuto(card, "CompletionCard");
  });

  it("MissingTargetCard carries inline pointerEvents:auto when anchor is missing", async () => {
    mockFetch.mockResolvedValueOnce({
      script: MISSING_TARGET_SCRIPT as any,
      mode: "preview",
      moduleStatus: "draft",
    } as any);

    render(
      <TourProvider>
        <Starter preview />
        <TourRunner />
      </TourProvider>,
    );
    await act(async () => fireEvent.click(screen.getByTestId("start")));

    // MissingTargetCard renders after the bounded resolution wait
    // (ANCHOR_RESOLUTION_TIMEOUT_MS = 750ms). Poll for it.
    let card: Element | null = null;
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline) {
      card = document.querySelector("[data-tour-missing-target]");
      if (card) break;
      await new Promise((r) => setTimeout(r, 50));
    }
    expectInlinePointerEventsAuto(card, "MissingTargetCard");
  });

  it("Root tour runner intentionally stays pointer-events:none", async () => {
    // Regression proof: the fix must NOT flip the root to auto (that
    // would block clicks on highlighted app targets).
    mockFetch.mockResolvedValueOnce({
      script: BASE_SCRIPT as any,
      mode: "learner",
      moduleStatus: "published",
    } as any);
    render(
      <TourProvider>
        <Starter />
        <TourRunner />
      </TourProvider>,
    );
    await act(async () => fireEvent.click(screen.getByTestId("start")));
    const runner = document.querySelector("[data-tour-runner]");
    expect(runner).toBeTruthy();
    // The root does not receive an inline pointerEvents: auto declaration.
    expect((runner as HTMLElement).style.pointerEvents).not.toBe("auto");
    // Its className still includes pointer-events-none as the Tailwind
    // intent, which the compiled CSS honors (pointer-events-none IS in
    // the bundle).
    expect((runner as HTMLElement).className).toMatch(/pointer-events-none/);
  });

  it("Interactive buttons inside the tooltip inherit auto and are clickable in a real DOM", async () => {
    // With jsdom (no Tailwind CSS parsed), the *inline* pointerEvents on
    // the tooltip is the authority. This test drives the Next button to
    // prove the interaction actually completes.
    mockFetch.mockResolvedValueOnce({
      script: BASE_SCRIPT as any,
      mode: "preview",
      moduleStatus: "draft",
    } as any);
    render(
      <TourProvider>
        <Starter preview />
        <TourRunner />
      </TourProvider>,
    );
    await act(async () => fireEvent.click(screen.getByTestId("start")));
    expect(screen.getByText("Step 1")).toBeInTheDocument();

    // Click Next — inline pointer-events:auto on the tooltip enables
    // this event to reach the button in a real browser.
    await act(async () => fireEvent.click(screen.getByText("Next")));
    expect(screen.getByText("Step 2 (final)")).toBeInTheDocument();
  });
});

// ─── Build-artifact independence — does not depend on Tailwind utility ─────

describe("Implementation does not depend on Tailwind `.pointer-events-auto`", () => {
  it("TourRunner source contains inline pointerEvents:auto declarations for each surface", () => {
    // Read the source file directly and prove the fix is not solely
    // reliant on the Tailwind class. Four surfaces must each declare
    // pointerEvents: "auto" inline.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require("fs");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const path = require("path");
    const src = fs.readFileSync(
      path.join(__dirname, "..", "TourRunner.tsx"),
      "utf8",
    );

    // Count inline `pointerEvents: "auto"` occurrences — one per surface,
    // at minimum four (Tooltip, PreviewBanner, CompletionCard,
    // MissingTargetCard). More is fine; fewer is a regression.
    const matches = src.match(/pointerEvents:\s*["']auto["']/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(4);

    // Sanity — the root runner does NOT declare inline auto.
    // The declaration for the runner root remains className-only
    // with `pointer-events-none`.
    const runnerRootRegion = src.substring(
      src.indexOf("data-tour-runner"),
      src.indexOf("data-tour-runner") + 400,
    );
    expect(runnerRootRegion).not.toMatch(/pointerEvents:\s*["']auto["']/);
  });
});
