// ============================================================================
// AP2 tour — BrokerCertPreviewSection (mounted on /training)
// ============================================================================

import { render, screen, fireEvent, act } from "@testing-library/react";

import { BrokerCertPreviewSection } from "../BrokerCertPreviewSection";
import { TourProvider, useTour } from "../TourProvider";
import { TourRunner } from "../TourRunner";

jest.mock("../api", () => ({
  fetchTourScript: jest.fn(),
  submitTourCompletion: jest.fn(),
  TourApiError: class extends Error {},
}));
jest.mock("next/navigation", () => ({
  usePathname: () => "/training",
}));

import { fetchTourScript, submitTourCompletion } from "../api";
const mockFetch = fetchTourScript as jest.MockedFunction<typeof fetchTourScript>;
const mockSubmit = submitTourCompletion as jest.MockedFunction<
  typeof submitTourCompletion
>;

const SCRIPT = {
  id: "portal.foundations.welcome",
  lessonId: "pcert-l01",
  certificationId: "hartfelt-platform-certified",
  scriptVersion: "1.0.0",
  steps: [
    {
      id: "s1",
      order: 1,
      targetId: null,
      title: "Welcome",
      bodyContent: [{ type: "paragraph", text: "Hello" }],
      placement: "center",
      interaction: { kind: "informational" },
      optional: false,
    },
  ],
};

beforeEach(() => {
  mockFetch.mockReset();
  mockSubmit.mockReset();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe("BrokerCertPreviewSection — role gating", () => {
  it("renders NOTHING for agent role", () => {
    const { container } = render(
      <TourProvider>
        <BrokerCertPreviewSection role="agent" />
      </TourProvider>,
    );
    expect(container.querySelector("[data-broker-cert-preview]")).toBeNull();
  });

  it("renders NOTHING for null role", () => {
    const { container } = render(
      <TourProvider>
        <BrokerCertPreviewSection role={null} />
      </TourProvider>,
    );
    expect(container.querySelector("[data-broker-cert-preview]")).toBeNull();
  });

  it.each(["broker", "admin", "office_manager"])(
    "renders 3 pilot launcher buttons for %s",
    (role) => {
      render(
        <TourProvider>
          <BrokerCertPreviewSection role={role} />
        </TourProvider>,
      );
      const buttons = screen.getAllByRole("button");
      // Exactly 3 preview buttons — one per pilot lesson.
      const previewButtons = buttons.filter((b) =>
        b.textContent?.startsWith("Preview pcert-l"),
      );
      expect(previewButtons).toHaveLength(3);
      const labels = previewButtons.map((b) => b.textContent);
      expect(labels).toContain("Preview pcert-l01");
      expect(labels).toContain("Preview pcert-l02");
      expect(labels).toContain("Preview pcert-l03");
    },
  );

  it("provides context that progress will not be saved", () => {
    render(
      <TourProvider>
        <BrokerCertPreviewSection role="broker" />
      </TourProvider>,
    );
    expect(
      screen.getByText(/Progress will not be saved/i),
    ).toBeInTheDocument();
  });
});

describe("BrokerCertPreviewSection — end-to-end preview flow", () => {
  it("launches lesson in preview, shows persistent banner, and finishing displays the completion message with no POST", async () => {
    mockFetch.mockResolvedValueOnce({
      script: SCRIPT as unknown as Awaited<ReturnType<typeof mockFetch>>["script"],
      mode: "preview",
      moduleStatus: "draft",
    } as Awaited<ReturnType<typeof mockFetch>>);

    render(
      <TourProvider>
        <BrokerCertPreviewSection role="broker" userId="u-broker-1" />
        <TourRunner />
      </TourProvider>,
    );

    await act(async () => {
      fireEvent.click(screen.getByText("Preview pcert-l01"));
    });

    // Persistent banner
    expect(
      screen.getByText(/PREVIEW — PROGRESS WILL NOT BE SAVED/i),
    ).toBeInTheDocument();

    // Advance to finish
    await act(async () => {
      fireEvent.click(screen.getByText(/Finish/));
    });

    // Completion card renders required copy
    expect(
      screen.getByText("Preview complete. No progress was saved."),
    ).toBeInTheDocument();

    // No POST completion write.
    expect(mockSubmit).not.toHaveBeenCalled();
    // Learner storage also stays empty.
    expect(window.localStorage.length).toBe(0);
  });
});
