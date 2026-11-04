/** Matrix certification readiness — real render tests (jest + RTL). */
import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";

const getMatrixReadiness = jest.fn();
// Spy for every write/grant-ish client fn to prove the readiness surface is read-only.
const enrollMatrixLearner = jest.fn();
const certifySubmission = jest.fn();
const submitAttempt = jest.fn();

jest.mock("@/lib/matrix/vault-matrix-client", () => ({
  __esModule: true,
  getMatrixReadiness: (...a: unknown[]) => getMatrixReadiness(...a),
  enrollMatrixLearner: (...a: unknown[]) => enrollMatrixLearner(...a),
  certifySubmission: (...a: unknown[]) => certifySubmission(...a),
  submitAttempt: (...a: unknown[]) => submitAttempt(...a),
  MatrixApiError: class extends Error {
    status = 500;
    notEnabled = false;
  },
}));

jest.mock("../_lib/matrix-flags", () => ({ matrixSimulatorEnabled: jest.fn(() => true) }));

import { matrixSimulatorEnabled } from "../_lib/matrix-flags";
import { MatrixReadiness } from "../_components/matrix-readiness";

const mockedFlag = matrixSimulatorEnabled as jest.Mock;

function readiness(overrides: Record<string, unknown> = {}) {
  return {
    learnerId: "L1",
    certificationVersion: "2.0.0",
    knowledgeQuizPassed: true,
    modules: [
      { module: "A", scenarioFamily: "rental", label: "Residential Rental", approved: true, scorePct: 100, criticalErrorCount: 0 },
      { module: "B", scenarioFamily: "sales", label: "Residential Sales", approved: true, scorePct: 90, criticalErrorCount: 0 },
      { module: "C", scenarioFamily: "maintenance", label: "Listing Maintenance", approved: true, scorePct: 88, criticalErrorCount: 0 },
    ],
    certificationReady: true,
    issuedCredential: null,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedFlag.mockReturnValue(true);
});

describe("MatrixReadiness", () => {
  it("shows READY when the quiz + all three modules are approved, and never calls a write/grant", async () => {
    getMatrixReadiness.mockResolvedValue(readiness());
    render(<MatrixReadiness />);
    await waitFor(() =>
      expect(document.querySelector('[data-matrix-readiness-overall="ready"]')).toBeInTheDocument(),
    );
    expect(screen.getByText(/Ready for certification/i)).toBeInTheDocument();
    // Read-only: no enrollment / certify / submit calls fired.
    expect(enrollMatrixLearner).not.toHaveBeenCalled();
    expect(certifySubmission).not.toHaveBeenCalled();
    expect(submitAttempt).not.toHaveBeenCalled();
  });

  it("shows NOT READY and lists exactly what is missing (separate evidence preserved)", async () => {
    getMatrixReadiness.mockResolvedValue(
      readiness({
        knowledgeQuizPassed: false,
        modules: [
          { module: "A", scenarioFamily: "rental", label: "Residential Rental", approved: true, scorePct: 100, criticalErrorCount: 0 },
          { module: "B", scenarioFamily: "sales", label: "Residential Sales", approved: false, scorePct: null, criticalErrorCount: null },
          { module: "C", scenarioFamily: "maintenance", label: "Listing Maintenance", approved: false, scorePct: null, criticalErrorCount: null },
        ],
        certificationReady: false,
      }),
    );
    render(<MatrixReadiness />);
    const missing = await waitFor(() => {
      const el = document.querySelector("[data-matrix-readiness-missing]");
      if (!el) throw new Error("no missing panel");
      return el as HTMLElement;
    });
    expect(document.querySelector('[data-matrix-readiness-overall="not_ready"]')).toBeInTheDocument();
    expect(within(missing).getByText(/Knowledge Quiz/)).toBeInTheDocument();
    expect(within(missing).getByText(/Residential Sales/)).toBeInTheDocument();
    expect(within(missing).getByText(/Listing Maintenance/)).toBeInTheDocument();
    // Module A (approved) must NOT appear in the missing list.
    expect(within(missing).queryByText(/Residential Rental/)).toBeNull();
  });

  it("surfaces an existing credential as still-valid (versioned, not reinterpreted)", async () => {
    getMatrixReadiness.mockResolvedValue(
      readiness({ issuedCredential: { certificationVersion: "1.0.0", issuedAt: new Date().toISOString() } }),
    );
    render(<MatrixReadiness />);
    await waitFor(() =>
      expect(document.querySelector("[data-matrix-readiness-credential]")).toBeInTheDocument(),
    );
    expect(screen.getByText(/remain valid/i)).toBeInTheDocument();
  });

  it("flag off → coming-soon, no fetch", () => {
    mockedFlag.mockReturnValue(false);
    render(<MatrixReadiness />);
    expect(screen.getByText(/coming soon/i)).toBeInTheDocument();
    expect(getMatrixReadiness).not.toHaveBeenCalled();
  });
});
