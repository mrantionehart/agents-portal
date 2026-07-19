// ============================================================================
// V4 UNIFIED LEARNER EXPERIENCE — FamilyAGuidanceCard behavioral tests
// ============================================================================
// Locks the invariants for pcert-l03:
//   1. Never displays a phone number or notification content.
//   2. Verify Completion triggers a POST to Vault's practical-complete route.
//   3. Server envelope drives success vs friendly-error copy.
//   4. Card renders even when the learner hasn't performed the actions yet.
// ============================================================================

jest.mock("../../api", () => ({
  requestPracticalCompletion: jest.fn(),
  CertApiError: class CertApiError extends Error {
    status = 0;
    code: string | null = null;
    constructor(message: string, status: number, code: string | null) {
      super(message);
      this.name = "CertApiError";
      this.status = status;
      this.code = code;
    }
  },
}));

import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import FamilyAGuidanceCard from "../FamilyAGuidanceCard";
import { CertApiError, requestPracticalCompletion } from "../../api";
import type { LessonPracticalUiSpec } from "../../types";

const requestPracticalCompletionMock =
  requestPracticalCompletion as jest.MockedFunction<
    typeof requestPracticalCompletion
  >;

const spec: LessonPracticalUiSpec = {
  kind: "external_signals",
  required_signals: ["notification_read", "profile_phone_set"],
};

beforeEach(() => {
  requestPracticalCompletionMock.mockReset();
});

describe("FamilyAGuidanceCard", () => {
  it("shows guidance for both allowlisted signals and never displays raw signal values", () => {
    render(
      <FamilyAGuidanceCard lessonId="pcert-l03" spec={spec} />,
    );
    // Two signal cards + two CTAs.
    expect(screen.getByText(/mark a notification as read/i)).toBeInTheDocument();
    expect(screen.getByText(/save your phone number/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open notifications/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open settings/i })).toBeInTheDocument();
    // Neither the phone number nor notification body ever renders.
    // (Sanity: nothing in the visible text should look like a phone number or JSON payload.)
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/\+?\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/); // no phone-like sequences
    expect(text).not.toContain("read_at");
    expect(text).not.toContain("notification_body");
  });

  it("POSTs to the practical-complete route when Verify Completion is clicked", async () => {
    requestPracticalCompletionMock.mockResolvedValueOnce({
      ok: true,
      lesson_id: "pcert-l03",
      status: "completed",
    });
    const onVerified = jest.fn();
    render(
      <FamilyAGuidanceCard
        lessonId="pcert-l03"
        spec={spec}
        onVerified={onVerified}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /verify completion/i }));
    await waitFor(() =>
      expect(requestPracticalCompletionMock).toHaveBeenCalledWith({
        lessonId: "pcert-l03",
      }),
    );
    await waitFor(() => expect(onVerified).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("status").textContent).toMatch(/signals verified/i);
  });

  it("renders a friendly attestation_missing error when the server refuses", async () => {
    requestPracticalCompletionMock.mockRejectedValueOnce(
      new CertApiError("Signals missing", 409, "attestation_missing", null),
    );
    render(<FamilyAGuidanceCard lessonId="pcert-l03" spec={spec} />);
    fireEvent.click(screen.getByRole("button", { name: /verify completion/i }));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toMatch(
        /Not all required signals are recorded yet/i,
      ),
    );
  });

  it("hides Verify Completion when alreadyCompleted is true", () => {
    render(
      <FamilyAGuidanceCard
        lessonId="pcert-l03"
        spec={spec}
        alreadyCompleted={true}
      />,
    );
    expect(screen.queryByRole("button", { name: /verify completion/i })).toBeNull();
    expect(screen.getByText(/signals previously verified/i)).toBeInTheDocument();
  });
});
