// ============================================================================
// AP2 tour — runner behavior tests
// ============================================================================
// Validates:
//   * step ordering + Next/Back
//   * incorrect clicks do not advance
//   * target_click only advances on the matched target
//   * missing target renders the fallback + does NOT auto-advance
// ============================================================================

import { render, screen, fireEvent, act } from "@testing-library/react";
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

    // Missing-target fallback appears.
    expect(screen.getByText(/Element not found on this screen/)).toBeInTheDocument();
    // Both Exit and Retry are reachable.
    expect(screen.getByText(/Exit tour/)).toBeInTheDocument();
    expect(screen.getByText(/Retry from step 1/)).toBeInTheDocument();
    // Step 3 title ("Done") does NOT appear — proof we did not auto-advance
    // past the missing-target step.
    expect(screen.queryByText("Done")).toBeNull();
  });
});
