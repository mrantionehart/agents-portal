// COMM-1C — SellerCertificationCard: renders authoritative progress; DARK-safe
// CTA (coming-soon when the Portal flag is off, Start when on); never asserts a
// pass or issuance client-side.

import { render, screen, waitFor } from "@testing-library/react";

const getCertificationProgress = jest.fn();
const startAssessment = jest.fn();
jest.mock("@/lib/ring/vault-ring-client", () => {
  class RingApiError extends Error {
    status: number;
    code: string | null;
    notEnabled: boolean;
    constructor(status: number, code: string | null, notEnabled: boolean) {
      super(code ?? String(status));
      this.status = status;
      this.code = code;
      this.notEnabled = notEnabled;
    }
  }
  return {
    RingApiError,
    getCertificationProgress: (...a: unknown[]) => getCertificationProgress(...a),
    startAssessment: (...a: unknown[]) => startAssessment(...a),
  };
});

const assessmentEntryEnabled = jest.fn();
jest.mock("../_lib/ring-flags", () => ({ assessmentEntryEnabled: () => assessmentEntryEnabled() }));

import { SellerCertificationCard } from "../_components/seller-certification-card";

const PROGRESS_INPROGRESS = {
  certificationId: "hartfelt-seller-lead-certified",
  certificationVersion: "1.0.0",
  status: "in_progress",
  completed: 1,
  total: 4,
  requirements: [
    { requirementId: "seller_discovery", label: "Seller Discovery", status: "passed" },
    { requirementId: "price_motivation", label: "Price / Motivation", status: "not_started" },
    { requirementId: "objection_handling", label: "Objection Handling", status: "not_started" },
    { requirementId: "appointment_close", label: "Appointment Close", status: "not_started" },
  ],
  missing: ["Price / Motivation", "Objection Handling", "Appointment Close"],
};

beforeEach(() => {
  jest.clearAllMocks();
});

it("renders the 4 requirements and the passed count", async () => {
  assessmentEntryEnabled.mockReturnValue(false);
  getCertificationProgress.mockResolvedValue(PROGRESS_INPROGRESS);
  render(<SellerCertificationCard />);
  await waitFor(() => screen.getByText("Seller Discovery"));
  expect(screen.getByText("Price / Motivation")).toBeInTheDocument();
  expect(screen.getByText("1 of 4 certification assessments passed")).toBeInTheDocument();
  expect(screen.getByText("Not yet certified")).toBeInTheDocument();
});

it("DARK: flag off → honest coming-soon copy, no Start button", async () => {
  assessmentEntryEnabled.mockReturnValue(false);
  getCertificationProgress.mockResolvedValue(PROGRESS_INPROGRESS);
  render(<SellerCertificationCard />);
  await waitFor(() => screen.getByText(/coming soon/i));
  expect(screen.queryByRole("button", { name: /certification/i })).toBeNull();
});

it("flag on → Continue Certification button (completed > 0)", async () => {
  assessmentEntryEnabled.mockReturnValue(true);
  getCertificationProgress.mockResolvedValue(PROGRESS_INPROGRESS);
  render(<SellerCertificationCard />);
  await waitFor(() => screen.getByRole("button", { name: "Continue Certification" }));
});

it("requirements_met → SELLER LEAD CERTIFIED, never a Start CTA", async () => {
  assessmentEntryEnabled.mockReturnValue(true);
  getCertificationProgress.mockResolvedValue({ ...PROGRESS_INPROGRESS, status: "requirements_met", completed: 4 });
  render(<SellerCertificationCard />);
  await waitFor(() => screen.getByText("SELLER LEAD CERTIFIED ✓"));
  expect(screen.queryByRole("button")).toBeNull();
});
