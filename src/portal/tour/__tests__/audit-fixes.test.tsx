// ============================================================================
// Audit-fix regression tests — Issues 2, 3, 4
// ============================================================================
//   * Issue 2 — Back onto a completed `route_change` step whose route
//     still matches must NOT auto-advance forward. Direction tracking
//     via `justRewoundRef`: back() sets the flag; the route_change
//     effect clears it once (skipping auto-advance for that rewind);
//     subsequent forward navigations re-arm.
//   * Issue 3 — Malformed API responses fail gracefully (error state,
//     no runtime crash).
//   * Issue 4 — Preview intent is preserved throughout the session even
//     if the server returns `mode: "learner"` mid-session (race
//     against publish-flip). finish() gates on the persisted intent.
// ============================================================================

import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";

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

// Mutable pathname mock so tests can simulate route changes.
let mockPath = "/notifications";
jest.mock("next/navigation", () => ({
  usePathname: () => mockPath,
}));

import { fetchTourScript, submitTourCompletion, TourResponseShapeError, assertTourGetResponse } from "../api";
const mockFetch = fetchTourScript as jest.MockedFunction<typeof fetchTourScript>;
const mockSubmit = submitTourCompletion as jest.MockedFunction<
  typeof submitTourCompletion
>;

const CERT = "hartfelt-platform-certified";

const ROUTE_CHANGE_SCRIPT = {
  id: "test.route-change",
  lessonId: "pcert-l02",
  certificationId: CERT,
  scriptVersion: "1.0.0",
  steps: [
    {
      id: "s1-info",
      order: 1,
      targetId: null,
      title: "Step 1",
      bodyContent: [{ type: "paragraph", text: "Intro" }],
      placement: "center",
      interaction: { kind: "informational" },
      optional: false,
    },
    {
      id: "s2-route",
      order: 2,
      targetId: null,
      title: "Waiting for /settings",
      bodyContent: [{ type: "paragraph", text: "..." }],
      placement: "center",
      interaction: { kind: "route_change", expectedRoute: "/settings" },
      optional: false,
    },
    {
      id: "s3-done",
      order: 3,
      targetId: null,
      title: "Done",
      bodyContent: [{ type: "paragraph", text: "..." }],
      placement: "center",
      interaction: { kind: "informational" },
      optional: false,
    },
  ],
};

function StartHarness({
  lessonId = "pcert-l02",
  preview = false,
}: { lessonId?: string; preview?: boolean }) {
  const t = useTour();
  return (
    <div>
      <button
        data-testid="start"
        onClick={() =>
          t.start({
            certificationId: CERT,
            lessonId,
            preview,
          })
        }
      >
        start
      </button>
      <span data-testid="error">{t.error ?? ""}</span>
      <span data-testid="mode">{t.mode}</span>
      <span data-testid="completed">{t.completed ? "y" : "n"}</span>
    </div>
  );
}

beforeEach(() => {
  mockFetch.mockReset();
  mockSubmit.mockReset();
  window.localStorage.clear();
  window.sessionStorage.clear();
  mockPath = "/notifications";
});

// ─── Issue 2 — Back through route_change ────────────────────────────────────

describe("Issue 2 — route_change auto-advance is direction-aware", () => {
  it("forward entry (pathname already matches on step-in): auto-advances", async () => {
    mockFetch.mockResolvedValueOnce({
      script: ROUTE_CHANGE_SCRIPT as any,
      mode: "preview",
      moduleStatus: "draft",
    } as any);
    mockPath = "/settings";

    render(
      <TourProvider>
        <StartHarness preview />
        <TourRunner />
      </TourProvider>,
    );
    await act(async () => fireEvent.click(screen.getByTestId("start")));
    expect(screen.getByText("Step 1")).toBeInTheDocument();
    // Next → step 2 (route_change) → pathname matches → auto-advance → step 3
    await act(async () => fireEvent.click(screen.getByText("Next")));
    await waitFor(() => {
      expect(screen.getByText("Done")).toBeInTheDocument();
    });
  });

  it("backward entry: Back onto a completed route_change step stays put", async () => {
    mockFetch.mockResolvedValueOnce({
      script: ROUTE_CHANGE_SCRIPT as any,
      mode: "preview",
      moduleStatus: "draft",
    } as any);
    mockPath = "/settings"; // matches route_change from start

    render(
      <TourProvider>
        <StartHarness preview />
        <TourRunner />
      </TourProvider>,
    );
    await act(async () => fireEvent.click(screen.getByTestId("start")));
    // Step 1 (informational)
    expect(screen.getByText("Step 1")).toBeInTheDocument();
    // Next → step 2 auto-advances → step 3
    await act(async () => fireEvent.click(screen.getByText("Next")));
    await waitFor(() => expect(screen.getByText("Done")).toBeInTheDocument());

    // Back onto step 2. Pathname still /settings — but because this was
    // caused by back(), the auto-advance effect must SKIP.
    await act(async () => fireEvent.click(screen.getByText("Back")));
    expect(screen.getByText("Waiting for /settings")).toBeInTheDocument();
    expect(screen.queryByText("Done")).toBeNull();
  });

  it("already-on-route as initial step: auto-advances immediately", async () => {
    const SCRIPT = {
      ...ROUTE_CHANGE_SCRIPT,
      steps: [
        {
          id: "s1-route",
          order: 1,
          targetId: null,
          title: "Route waiter",
          bodyContent: [{ type: "paragraph", text: "..." }],
          placement: "center",
          interaction: { kind: "route_change", expectedRoute: "/notifications" },
          optional: false,
        },
        {
          id: "s2-done",
          order: 2,
          targetId: null,
          title: "Landed",
          bodyContent: [{ type: "paragraph", text: "..." }],
          placement: "center",
          interaction: { kind: "informational" },
          optional: false,
        },
      ],
    };
    mockFetch.mockResolvedValueOnce({
      script: SCRIPT as any,
      mode: "preview",
      moduleStatus: "draft",
    } as any);
    mockPath = "/notifications";

    render(
      <TourProvider>
        <StartHarness preview />
        <TourRunner />
      </TourProvider>,
    );
    await act(async () => fireEvent.click(screen.getByTestId("start")));
    await waitFor(() => {
      expect(screen.getByText("Landed")).toBeInTheDocument();
    });
  });

  it("repeated Back/Next: rewinding past route_change then advancing forward re-arms auto-advance", async () => {
    mockFetch.mockResolvedValueOnce({
      script: ROUTE_CHANGE_SCRIPT as any,
      mode: "preview",
      moduleStatus: "draft",
    } as any);
    mockPath = "/settings"; // matches route_change

    render(
      <TourProvider>
        <StartHarness preview />
        <TourRunner />
      </TourProvider>,
    );
    await act(async () => fireEvent.click(screen.getByTestId("start")));

    // Step 1 → Next → auto-advance route_change → Done (cycle 1)
    await act(async () => fireEvent.click(screen.getByText("Next")));
    await waitFor(() => expect(screen.getByText("Done")).toBeInTheDocument());

    // Back → route_change (stays)
    await act(async () => fireEvent.click(screen.getByText("Back")));
    expect(screen.getByText("Waiting for /settings")).toBeInTheDocument();

    // Back → step 1 (informational)
    await act(async () => fireEvent.click(screen.getByText("Back")));
    expect(screen.getByText("Step 1")).toBeInTheDocument();

    // Next → route_change re-armed → auto-advance → Done (cycle 2)
    await act(async () => fireEvent.click(screen.getByText("Next")));
    await waitFor(() => expect(screen.getByText("Done")).toBeInTheDocument());

    // Back → route_change (stays) — proving direction guard remains
    // protective across cycles.
    await act(async () => fireEvent.click(screen.getByText("Back")));
    expect(screen.getByText("Waiting for /settings")).toBeInTheDocument();
    expect(screen.queryByText("Done")).toBeNull();

    // Back → step 1 again
    await act(async () => fireEvent.click(screen.getByText("Back")));
    expect(screen.getByText("Step 1")).toBeInTheDocument();

    // Next → route_change → auto-advance → Done (cycle 3)
    await act(async () => fireEvent.click(screen.getByText("Next")));
    await waitFor(() => expect(screen.getByText("Done")).toBeInTheDocument());
  });
});

// ─── Issue 3 — Malformed response validation ────────────────────────────────

describe("Issue 3 — assertTourGetResponse rejects malformed shapes", () => {
  const malformedCases: Array<{ label: string; payload: unknown }> = [
    {
      label: "steps is null",
      payload: {
        script: {
          id: "s",
          lessonId: "pcert-l01",
          certificationId: CERT,
          scriptVersion: "1.0.0",
          steps: null,
        },
        mode: "preview",
        moduleStatus: "draft",
      },
    },
    {
      label: "step missing bodyContent",
      payload: {
        script: {
          id: "s",
          lessonId: "pcert-l01",
          certificationId: CERT,
          scriptVersion: "1.0.0",
          steps: [
            {
              id: "s1",
              order: 1,
              targetId: null,
              title: "x",
              placement: "center",
              optional: false,
              interaction: { kind: "informational" },
            },
          ],
        },
        mode: "preview",
        moduleStatus: "draft",
      },
    },
    {
      label: "unknown interaction kind",
      payload: {
        script: {
          id: "s",
          lessonId: "pcert-l01",
          certificationId: CERT,
          scriptVersion: "1.0.0",
          steps: [
            {
              id: "s1",
              order: 1,
              targetId: null,
              title: "x",
              placement: "center",
              optional: false,
              bodyContent: [],
              interaction: { kind: "arbitrary_js" },
            },
          ],
        },
        mode: "preview",
        moduleStatus: "draft",
      },
    },
    {
      label: "content node with unknown type",
      payload: {
        script: {
          id: "s",
          lessonId: "pcert-l01",
          certificationId: CERT,
          scriptVersion: "1.0.0",
          steps: [
            {
              id: "s1",
              order: 1,
              targetId: null,
              title: "x",
              placement: "center",
              optional: false,
              bodyContent: [{ type: "iframe", src: "https://evil" }],
              interaction: { kind: "informational" },
            },
          ],
        },
        mode: "preview",
        moduleStatus: "draft",
      },
    },
    {
      label: "list with undefined items",
      payload: {
        script: {
          id: "s",
          lessonId: "pcert-l01",
          certificationId: CERT,
          scriptVersion: "1.0.0",
          steps: [
            {
              id: "s1",
              order: 1,
              targetId: null,
              title: "x",
              placement: "center",
              optional: false,
              bodyContent: [{ type: "list", ordered: false, items: undefined }],
              interaction: { kind: "informational" },
            },
          ],
        },
        mode: "preview",
        moduleStatus: "draft",
      },
    },
    {
      label: "bad placement",
      payload: {
        script: {
          id: "s",
          lessonId: "pcert-l01",
          certificationId: CERT,
          scriptVersion: "1.0.0",
          steps: [
            {
              id: "s1",
              order: 1,
              targetId: null,
              title: "x",
              placement: "diagonal",
              optional: false,
              bodyContent: [],
              interaction: { kind: "informational" },
            },
          ],
        },
        mode: "preview",
        moduleStatus: "draft",
      },
    },
    {
      label: "route_change missing expectedRoute",
      payload: {
        script: {
          id: "s",
          lessonId: "pcert-l01",
          certificationId: CERT,
          scriptVersion: "1.0.0",
          steps: [
            {
              id: "s1",
              order: 1,
              targetId: null,
              title: "x",
              placement: "center",
              optional: false,
              bodyContent: [],
              interaction: { kind: "route_change" },
            },
          ],
        },
        mode: "preview",
        moduleStatus: "draft",
      },
    },
    {
      label: "empty steps array",
      payload: {
        script: {
          id: "s",
          lessonId: "pcert-l01",
          certificationId: CERT,
          scriptVersion: "1.0.0",
          steps: [],
        },
        mode: "preview",
        moduleStatus: "draft",
      },
    },
    {
      label: "unknown mode",
      payload: {
        script: {
          id: "s",
          lessonId: "pcert-l01",
          certificationId: CERT,
          scriptVersion: "1.0.0",
          steps: [
            {
              id: "s1",
              order: 1,
              targetId: null,
              title: "x",
              placement: "center",
              optional: false,
              bodyContent: [],
              interaction: { kind: "informational" },
            },
          ],
        },
        mode: "arbitrary",
        moduleStatus: "draft",
      },
    },
    {
      label: "unknown moduleStatus",
      payload: {
        script: {
          id: "s",
          lessonId: "pcert-l01",
          certificationId: CERT,
          scriptVersion: "1.0.0",
          steps: [
            {
              id: "s1",
              order: 1,
              targetId: null,
              title: "x",
              placement: "center",
              optional: false,
              bodyContent: [],
              interaction: { kind: "informational" },
            },
          ],
        },
        mode: "learner",
        moduleStatus: "banana",
      },
    },
    {
      label: "top-level body is null",
      payload: null,
    },
  ];

  it.each(malformedCases)(
    "$label → throws TourResponseShapeError",
    ({ payload }) => {
      expect(() => assertTourGetResponse(payload)).toThrow(
        TourResponseShapeError,
      );
    },
  );

  it("well-formed payload passes", () => {
    expect(() =>
      assertTourGetResponse({
        script: ROUTE_CHANGE_SCRIPT,
        mode: "preview",
        moduleStatus: "draft",
      }),
    ).not.toThrow();
  });

  it("TourProvider surfaces graceful error when fetch throws TourResponseShapeError", async () => {
    mockFetch.mockRejectedValueOnce(new TourResponseShapeError("bad shape"));

    render(
      <TourProvider>
        <StartHarness />
        <TourRunner />
      </TourProvider>,
    );
    await act(async () => fireEvent.click(screen.getByTestId("start")));
    await waitFor(() => {
      expect(screen.getByTestId("error").textContent).toMatch(
        /server returned an unexpected response/i,
      );
    });
    // Runner rendered nothing (no script).
    expect(screen.queryByText("Step 1")).toBeNull();
  });
});

// ─── Issue 4 — Preview intent preserved across mode field mutation ──────────

describe("Issue 4 — preview intent survives server responding mode='learner'", () => {
  it("start({preview:true}) + response.mode='learner' → mode stays preview, finish() does NOT POST", async () => {
    mockFetch.mockResolvedValueOnce({
      script: ROUTE_CHANGE_SCRIPT as any,
      // Race: server returned learner because module was flipped to
      // published mid-fetch. Client MUST still treat this as preview
      // because the user opted into preview.
      mode: "learner",
      moduleStatus: "published",
    } as any);

    function FinishHarness() {
      const t = useTour();
      return (
        <div>
          <button
            data-testid="start"
            onClick={() =>
              t.start({
                certificationId: CERT,
                lessonId: "pcert-l01",
                preview: true,
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
        <FinishHarness />
      </TourProvider>,
    );

    await act(async () => fireEvent.click(screen.getByTestId("start")));

    // Preview intent wins over server response.
    expect(screen.getByTestId("mode").textContent).toBe("preview");

    // finish() must NOT POST.
    await act(async () => fireEvent.click(screen.getByTestId("finish")));
    expect(mockSubmit).not.toHaveBeenCalled();
    expect(screen.getByTestId("completed").textContent).toBe("y");
  });

  it("start({preview:false}) + response.mode='learner' + finish() → POSTs (learner path unaffected)", async () => {
    mockFetch.mockResolvedValueOnce({
      script: ROUTE_CHANGE_SCRIPT as any,
      mode: "learner",
      moduleStatus: "published",
    } as any);
    mockSubmit.mockResolvedValueOnce({
      ok: true,
      lesson_id: "pcert-l01",
      status: "completed",
    } as any);

    function FinishHarness() {
      const t = useTour();
      return (
        <div>
          <button
            data-testid="start"
            onClick={() =>
              t.start({
                certificationId: CERT,
                lessonId: "pcert-l01",
                preview: false,
              })
            }
          >
            start
          </button>
          <button data-testid="finish" onClick={t.finish}>
            finish
          </button>
          <span data-testid="mode">{t.mode}</span>
        </div>
      );
    }
    render(
      <TourProvider>
        <FinishHarness />
      </TourProvider>,
    );
    await act(async () => fireEvent.click(screen.getByTestId("start")));
    expect(screen.getByTestId("mode").textContent).toBe("learner");
    await act(async () => fireEvent.click(screen.getByTestId("finish")));
    expect(mockSubmit).toHaveBeenCalledTimes(1);
  });

  it("re-start after preview session with preview=false is not contaminated by prior preview intent", async () => {
    // First session: preview
    mockFetch.mockResolvedValueOnce({
      script: ROUTE_CHANGE_SCRIPT as any,
      mode: "preview",
      moduleStatus: "draft",
    } as any);
    // Second session: learner
    mockFetch.mockResolvedValueOnce({
      script: ROUTE_CHANGE_SCRIPT as any,
      mode: "learner",
      moduleStatus: "published",
    } as any);
    mockSubmit.mockResolvedValueOnce({
      ok: true,
      lesson_id: "pcert-l02",
      status: "completed",
    } as any);

    function DualHarness() {
      const t = useTour();
      return (
        <div>
          <button
            data-testid="start-preview"
            onClick={() =>
              t.start({
                certificationId: CERT,
                lessonId: "pcert-l02",
                preview: true,
              })
            }
          >
            preview
          </button>
          <button
            data-testid="start-learner"
            onClick={() =>
              t.start({
                certificationId: CERT,
                lessonId: "pcert-l02",
                preview: false,
              })
            }
          >
            learner
          </button>
          <button data-testid="finish" onClick={t.finish}>
            finish
          </button>
        </div>
      );
    }
    render(
      <TourProvider>
        <DualHarness />
      </TourProvider>,
    );

    // Preview session — no POST
    await act(async () => fireEvent.click(screen.getByTestId("start-preview")));
    await act(async () => fireEvent.click(screen.getByTestId("finish")));
    expect(mockSubmit).not.toHaveBeenCalled();

    // Learner session — SHOULD POST (prior preview intent must be cleared)
    await act(async () => fireEvent.click(screen.getByTestId("start-learner")));
    await act(async () => fireEvent.click(screen.getByTestId("finish")));
    expect(mockSubmit).toHaveBeenCalledTimes(1);
  });
});
