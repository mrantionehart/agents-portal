// PDI graded practical — learner submission panel + the Vault client's URL/body.
jest.mock("../pdi-api", () => ({
  fetchPracticalSubmissions: jest.fn(),
  submitPractical: jest.fn(),
}));

import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import * as pdiApi from "../pdi-api";
import PracticalSubmissionPanel, { SUBMIT_ERROR_COPY } from "../PracticalSubmissionPanel";
import { CertApiError } from "../../certified/api";

const fetchSubs = pdiApi.fetchPracticalSubmissions as jest.MockedFunction<typeof pdiApi.fetchPracticalSubmissions>;
const submit = pdiApi.submitPractical as jest.MockedFunction<typeof pdiApi.submitPractical>;
const CERT = "hartfelt-real-estate-pdi-ownership-fl";
const LESSON = "pdi1-l1201";
const REPORT = "x".repeat(250);

function state(submissions = 0) {
  return {
    certification_id: CERT,
    lesson_id: LESSON,
    max_submissions: 3,
    approved_parcels: [
      { id: "p-1", county: "miami-dade", parcelReference: "30-4021-012-0340", label: "Training lot A", approvedAt: "2026-11-11T00:00:00Z" },
    ],
    submissions: Array.from({ length: submissions }, (_, i) => ({
      id: `s-${i}`, submissionNumber: i + 1, trainingParcelId: "p-1", submittedAt: "2026-11-11T15:00:00Z", reportText: REPORT,
    })),
  };
}

beforeEach(() => {
  fetchSubs.mockReset();
  submit.mockReset();
});

it("renders approved parcels, the n-of-3 count and the standing reminder; no deadline", async () => {
  fetchSubs.mockResolvedValue(state(1));
  render(<PracticalSubmissionPanel certificationId={CERT} lessonId={LESSON} />);
  expect(await screen.findByText("Submissions used: 1 of 3")).toBeInTheDocument();
  expect(screen.getByRole("option", { name: /30-4021-012-0340 — Training lot A/ })).toBeInTheDocument();
  expect(screen.getByText(/never an official zoning, title, valuation or development determination/)).toBeInTheDocument();
  expect(screen.queryByText(/deadline|due/i)).not.toBeInTheDocument();
  expect(fetchSubs).toHaveBeenCalledWith(CERT, LESSON);
});

it("submits the chosen parcel and report to Vault", async () => {
  fetchSubs.mockResolvedValue(state(0));
  submit.mockResolvedValue({ id: "s-new", submissionNumber: 1, trainingParcelId: "p-1", submittedAt: "2026-11-11T16:00:00Z", reportText: REPORT });
  render(<PracticalSubmissionPanel certificationId={CERT} lessonId={LESSON} />);
  fireEvent.change(await screen.findByLabelText("Training parcel"), { target: { value: "p-1" } });
  fireEvent.change(screen.getByLabelText("Practical report"), { target: { value: REPORT } });
  fireEvent.click(screen.getByRole("button", { name: "Submit for broker review" }));
  await waitFor(() => expect(submit).toHaveBeenCalledWith(CERT, LESSON, { training_parcel_id: "p-1", report_text: REPORT }));
  expect(await screen.findByText("Submitted. Your broker will review it.")).toBeInTheDocument();
});

it.each(["assessment_not_passed", "submission_limit_reached", "already_passed"])(
  "maps the 409 %s refusal to plain language",
  async (code) => {
    fetchSubs.mockResolvedValue(state(0));
    submit.mockRejectedValue(new CertApiError("x", 409, code, null));
    render(<PracticalSubmissionPanel certificationId={CERT} lessonId={LESSON} />);
    fireEvent.change(await screen.findByLabelText("Training parcel"), { target: { value: "p-1" } });
    fireEvent.change(screen.getByLabelText("Practical report"), { target: { value: REPORT } });
    fireEvent.click(screen.getByRole("button", { name: "Submit for broker review" }));
    expect(await screen.findByText(SUBMIT_ERROR_COPY[code])).toBeInTheDocument();
  },
);

it("blocks submitting a too-short report and hides the form after 3 submissions", async () => {
  fetchSubs.mockResolvedValueOnce(state(0));
  const { unmount } = render(<PracticalSubmissionPanel certificationId={CERT} lessonId={LESSON} />);
  fireEvent.change(await screen.findByLabelText("Training parcel"), { target: { value: "p-1" } });
  fireEvent.change(screen.getByLabelText("Practical report"), { target: { value: "too short" } });
  expect(screen.getByRole("button", { name: "Submit for broker review" })).toBeDisabled();
  unmount();
  fetchSubs.mockResolvedValueOnce(state(3));
  render(<PracticalSubmissionPanel certificationId={CERT} lessonId={LESSON} />);
  expect(await screen.findByText(SUBMIT_ERROR_COPY.submission_limit_reached)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Submit for broker review" })).not.toBeInTheDocument();
});

it("an unassigned learner (403) sees the not-assigned message", async () => {
  fetchSubs.mockRejectedValue(new CertApiError("denied", 403, "no_assignment", null));
  render(<PracticalSubmissionPanel certificationId={CERT} lessonId={LESSON} />);
  expect(await screen.findByRole("alert")).toHaveTextContent(SUBMIT_ERROR_COPY.no_assignment);
});
