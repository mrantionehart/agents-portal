// Real render + fireEvent UI test for the broker review queue (jest + RTL).

import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const getReviewQueue = jest.fn();
const certifySubmission = jest.fn();
jest.mock("@/lib/matrix/vault-matrix-client", () => ({
  __esModule: true,
  getReviewQueue: (...a: unknown[]) => getReviewQueue(...a),
  certifySubmission: (...a: unknown[]) => certifySubmission(...a),
  MatrixApiError: class extends Error { notEnabled = false; },
}));

import { MatrixReview } from "../_components/matrix-review";

const F = "NEXT_PUBLIC_MATRIX_SIMULATOR_ENABLED";
const prev = process.env[F];
beforeEach(() => { process.env[F] = "true"; });
afterEach(() => { if (prev === undefined) delete process.env[F]; else process.env[F] = prev; jest.clearAllMocks(); });

const QUEUE = [
  { submissionId: "sub-pass", learnerId: "L1", scenarioId: "matrix-rental-a1", scorePct: 100, criticalErrorCount: 0, passed: true, reviewStatus: "submitted", submittedAt: null },
  { submissionId: "sub-fail", learnerId: "L2", scenarioId: "matrix-rental-a1", scorePct: 70, criticalErrorCount: 2, passed: false, reviewStatus: "submitted", submittedAt: null },
];

describe("MatrixReview", () => {
  it("lists the queue; Certify is enabled for a passing row and disabled below the bar", async () => {
    getReviewQueue.mockResolvedValue({ queue: QUEUE });
    render(<MatrixReview />);
    await screen.findByText(/pending review/i);
    expect(screen.getByLabelText("Certify sub-pass")).toBeEnabled();
    expect(screen.getByLabelText("Certify sub-fail")).toBeDisabled();
  });

  it("certifies a passing submission and removes it from the queue", async () => {
    getReviewQueue.mockResolvedValue({ queue: QUEUE });
    certifySubmission.mockResolvedValue({ certified: true, issued: false, reviewStatus: "approved" });
    render(<MatrixReview />);
    const certify = await screen.findByLabelText("Certify sub-pass");
    fireEvent.click(certify);
    await waitFor(() => expect(certifySubmission).toHaveBeenCalledWith("sub-pass", "approve"));
    await waitFor(() => expect(screen.queryByLabelText("Certify sub-pass")).not.toBeInTheDocument());
  });

  it("returns (rejects) a submission and removes it from the queue", async () => {
    getReviewQueue.mockResolvedValue({ queue: QUEUE });
    certifySubmission.mockResolvedValue({ certified: false, issued: false, reviewStatus: "rejected" });
    render(<MatrixReview />);
    const ret = await screen.findByLabelText("Return sub-fail");
    fireEvent.click(ret);
    await waitFor(() => expect(certifySubmission).toHaveBeenCalledWith("sub-fail", "reject"));
    await waitFor(() => expect(screen.queryByLabelText("Return sub-fail")).not.toBeInTheDocument());
  });

  it("dark flag shows coming-soon, no queue fetch", () => {
    delete process.env[F];
    render(<MatrixReview />);
    expect(screen.getByText(/coming soon/i)).toBeInTheDocument();
    expect(getReviewQueue).not.toHaveBeenCalled();
  });
});
