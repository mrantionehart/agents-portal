// ============================================================================
// AP2 tour — broker preview launcher
// ============================================================================

import { render, screen, fireEvent, act } from "@testing-library/react";
import { BrokerPreviewLauncher } from "../BrokerPreviewLauncher";
import { TourProvider, useTour } from "../TourProvider";

// The tour API talks to Vault; here we only care that start() is
// invoked with { preview: true }. Mock the module entirely.
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

const STUB_SCRIPT = {
  id: "portal.foundations.dashboard",
  lessonId: "pcert-l02",
  certificationId: "hartfelt-platform-certified",
  scriptVersion: "1.0.0",
  steps: [
    {
      id: "s1",
      order: 1,
      targetId: null,
      title: "Intro",
      bodyContent: [{ type: "paragraph", text: "Hello" }],
      placement: "center",
      interaction: { kind: "informational" },
      optional: false,
    },
  ],
} as const;

function Probe() {
  const t = useTour();
  return (
    <div>
      <span data-testid="mode">{t.mode}</span>
      <span data-testid="submitting">{t.submitting ? "y" : "n"}</span>
    </div>
  );
}

describe("BrokerPreviewLauncher", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  it("does NOT render for a plain agent", () => {
    render(
      <TourProvider>
        <BrokerPreviewLauncher
          role="agent"
          certificationId="hartfelt-platform-certified"
          lessonId="pcert-l02"
        />
      </TourProvider>,
    );
    expect(screen.queryByRole("button")).toBeNull();
  });

  it.each(["broker", "admin", "office_manager"])(
    "renders for %s",
    (role) => {
      render(
        <TourProvider>
          <BrokerPreviewLauncher
            role={role}
            certificationId="hartfelt-platform-certified"
            lessonId="pcert-l02"
          />
        </TourProvider>,
      );
      expect(screen.getByRole("button")).toBeInTheDocument();
    },
  );

  it("starts the tour in preview mode when clicked", async () => {
    mockFetch.mockResolvedValueOnce({
      script: STUB_SCRIPT as unknown as Parameters<typeof mockFetch>[0] extends unknown
        ? (typeof STUB_SCRIPT)
        : never,
      mode: "preview",
      moduleStatus: "draft",
    } as unknown as Awaited<ReturnType<typeof mockFetch>>);

    render(
      <TourProvider>
        <BrokerPreviewLauncher
          role="broker"
          certificationId="hartfelt-platform-certified"
          lessonId="pcert-l02"
        />
        <Probe />
      </TourProvider>,
    );
    const btn = screen.getByRole("button");
    await act(async () => {
      fireEvent.click(btn);
    });
    expect(mockFetch).toHaveBeenCalledWith({
      certificationId: "hartfelt-platform-certified",
      lessonId: "pcert-l02",
      preview: true,
    });
    expect(screen.getByTestId("mode").textContent).toBe("preview");
  });
});

describe("preview never writes progress", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  it("finish() in preview mode does NOT call submitTourCompletion", async () => {
    mockFetch.mockResolvedValueOnce({
      script: STUB_SCRIPT as unknown as Awaited<ReturnType<typeof mockFetch>>["script"],
      mode: "preview",
      moduleStatus: "draft",
    } as Awaited<ReturnType<typeof mockFetch>>);

    const { submitTourCompletion } = require("../api");

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
              })
            }
          >
            start
          </button>
          <button data-testid="finish" onClick={() => t.finish()}>
            finish
          </button>
          <span data-testid="completed">{t.completed ? "y" : "n"}</span>
          <span data-testid="mode">{t.mode}</span>
        </div>
      );
    }

    render(
      <TourProvider>
        <Harness />
      </TourProvider>,
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId("start"));
    });
    expect(screen.getByTestId("mode").textContent).toBe("preview");

    await act(async () => {
      fireEvent.click(screen.getByTestId("finish"));
    });

    expect(submitTourCompletion).not.toHaveBeenCalled();
    expect(screen.getByTestId("completed").textContent).toBe("y");
    // Preview never touches localStorage
    expect(window.localStorage.length).toBe(0);
  });
});
