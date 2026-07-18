// ============================================================================
// TrainingBanner — renders context + never confusable with production
// ============================================================================

import "@testing-library/jest-dom";
import { act, render, screen } from "@testing-library/react";

import TrainingBanner from "../TrainingBanner";

describe("TrainingBanner", () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(new Date("2026-07-18T00:00:00Z")));
  afterEach(() => jest.useRealTimers());

  it("renders TRAINING SESSION label + lesson id + activity type", () => {
    render(
      <TrainingBanner
        lessonId="pcert-l04"
        activityType="transaction_wizard"
        expiresAt="2026-07-18T01:00:00Z"
      />,
    );
    expect(screen.getByText(/training session/i)).toBeInTheDocument();
    expect(screen.getByTestId("training-banner-lesson")).toHaveTextContent(
      "pcert-l04",
    );
    expect(screen.getByTestId("training-banner-activity")).toHaveTextContent(
      "transaction_wizard",
    );
  });

  it("carries the explicit 'no real transaction is created' notice", () => {
    render(
      <TrainingBanner
        lessonId="pcert-l04"
        activityType="transaction_wizard"
        expiresAt="2026-07-18T01:00:00Z"
      />,
    );
    expect(
      screen.getByText(/no real transaction is created/i),
    ).toBeInTheDocument();
  });

  it("shows a countdown that updates each tick", () => {
    render(
      <TrainingBanner
        lessonId="pcert-l04"
        activityType="transaction_wizard"
        expiresAt="2026-07-18T00:00:30Z"
      />,
    );
    // t=0 → 30s remaining
    expect(screen.getByTestId("training-banner-countdown")).toHaveTextContent("30s");
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(screen.getByTestId("training-banner-countdown")).toHaveTextContent("29s");
  });

  it("calls onExpired exactly once when countdown reaches zero", () => {
    const onExpired = jest.fn();
    render(
      <TrainingBanner
        lessonId="pcert-l04"
        activityType="transaction_wizard"
        expiresAt="2026-07-18T00:00:02Z"
        onExpired={onExpired}
      />,
    );
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(onExpired).toHaveBeenCalledTimes(1);
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    // Still exactly once — no repeat.
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it("is announced as a live region (role=status, aria-live=polite)", () => {
    render(
      <TrainingBanner
        lessonId="pcert-l04"
        activityType="transaction_wizard"
        expiresAt="2026-07-18T01:00:00Z"
      />,
    );
    const banner = screen.getByTestId("training-session-banner");
    expect(banner).toHaveAttribute("role", "status");
    expect(banner).toHaveAttribute("aria-live", "polite");
  });
});
