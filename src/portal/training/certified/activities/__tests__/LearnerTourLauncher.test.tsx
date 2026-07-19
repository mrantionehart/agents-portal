// ============================================================================
// V4 UNIFIED LEARNER EXPERIENCE — LearnerTourLauncher behavioral tests
// ============================================================================
// Locks the invariant that matters most for the pilot:
//   the learner launcher NEVER passes `preview: true` to TourProvider.start.
// Preview mode is a broker-only affordance and does not write completions.
// ============================================================================

const useTourMock = jest.fn();

jest.mock("@/src/portal/tour/TourProvider", () => ({
  useTour: () => useTourMock(),
}));

import { fireEvent, render, screen } from "@testing-library/react";

import LearnerTourLauncher from "../LearnerTourLauncher";

const startMock = jest.fn();

const defaultTourState = {
  script: null,
  currentIndex: 0,
  currentStep: null,
  mode: "learner" as const,
  loading: false,
  submitting: false,
  error: null,
  diagnostics: [],
  completed: false,
  start: startMock,
  next: jest.fn(),
  back: jest.fn(),
  exit: jest.fn(),
  retry: jest.fn(),
  reset: jest.fn(),
  goToStep: jest.fn(),
  registerMissingTarget: jest.fn(),
  finish: jest.fn(),
};

beforeEach(() => {
  startMock.mockReset();
  useTourMock.mockReturnValue(defaultTourState);
});

describe("LearnerTourLauncher", () => {
  it("calls tour.start with preview:false and the canonical certification id", async () => {
    render(<LearnerTourLauncher lessonId="pcert-l01" userId="user-1" />);
    const btn = screen.getByRole("button", { name: /start guided tour/i });
    fireEvent.click(btn);
    expect(startMock).toHaveBeenCalledTimes(1);
    const arg = startMock.mock.calls[0][0];
    expect(arg.preview).toBe(false);
    expect(arg.certificationId).toBe("hartfelt-platform-certified");
    expect(arg.lessonId).toBe("pcert-l01");
    expect(arg.userId).toBe("user-1");
  });

  it("renders a passive success chip when the lesson is already completed", () => {
    render(
      <LearnerTourLauncher lessonId="pcert-l01" alreadyCompleted={true} />,
    );
    // No Start button when already completed.
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText(/tour completed/i)).toBeInTheDocument();
  });

  it("passes userId through so learner-mode resume persistence keys correctly", () => {
    render(<LearnerTourLauncher lessonId="pcert-l06" userId="user-99" />);
    fireEvent.click(screen.getByRole("button"));
    expect(startMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-99", preview: false }),
    );
  });
});
