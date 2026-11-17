// PDI lesson page: renders Vault content blocks, records acknowledgement,
// shows the practical panel on the practical lesson, and hides when unassigned.
jest.mock("../pdi-api", () => ({
  fetchLessonContent: jest.fn(),
  acknowledgeLesson: jest.fn(),
  fetchPracticalSubmissions: jest.fn(),
  submitPractical: jest.fn(),
}));

import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import * as pdiApi from "../pdi-api";
import PdiLessonClient from "../PdiLessonClient";
import { CertApiError } from "../../certified/api";

const fetchContent = pdiApi.fetchLessonContent as jest.Mock;
const ack = pdiApi.acknowledgeLesson as jest.Mock;
const fetchSubs = pdiApi.fetchPracticalSubmissions as jest.Mock;
const CERT = "hartfelt-real-estate-pdi-ownership-fl";

beforeEach(() => {
  process.env.NEXT_PUBLIC_PDI_TRAINING_ENABLED = "true";
  fetchContent.mockReset();
  ack.mockReset();
  fetchSubs.mockReset();
});
afterAll(() => {
  delete process.env.NEXT_PUBLIC_PDI_TRAINING_ENABLED;
});

it("renders the lesson's blocks and records the acknowledgement", async () => {
  fetchContent.mockResolvedValue({
    lesson_id: "pdi1-l0101", certification_id: CERT, title: "Parcels, Folios and PCNs",
    objective: "After this lesson you can read a folio.", requirements: ["acknowledgement"], prerequisite_lesson_id: null,
    blocks: [
      { kind: "callout", variant: "scope", title: "Research, not determinations", text: "Tag every statement." },
      { kind: "heading", text: "Formats by county" },
      { kind: "paragraph", text: [{ text: "The first two digits are the " }, { text: "municipality code", style: "bold" }] },
      { kind: "table", headers: ["County", "Format"], rows: [["Miami-Dade", "13 digits"]] },
    ],
  });
  ack.mockResolvedValue(undefined);
  render(<PdiLessonClient certificationId={CERT} lessonId="pdi1-l0101" />);
  expect(await screen.findByRole("heading", { name: "Parcels, Folios and PCNs" })).toBeInTheDocument();
  expect(screen.getByRole("note")).toHaveTextContent("Research, not determinations");
  expect(screen.getByText("municipality code").tagName).toBe("STRONG");
  expect(screen.getByRole("cell", { name: "13 digits" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "I have read this lesson" }));
  await waitFor(() => expect(ack).toHaveBeenCalledWith(CERT, "pdi1-l0101"));
  expect(await screen.findByRole("button", { name: "Marked complete" })).toBeDisabled();
});

it("the practical lesson shows the submission panel, not lesson content", async () => {
  fetchSubs.mockResolvedValue({ certification_id: CERT, lesson_id: "pdi1-l1201", max_submissions: 3, approved_parcels: [], submissions: [] });
  render(<PdiLessonClient certificationId={CERT} lessonId="pdi1-l1201" />);
  expect(await screen.findByRole("region", { name: "Graded practical submission" })).toBeInTheDocument();
  expect(fetchContent).not.toHaveBeenCalled();
});

it("an unassigned learner (403) gets the not-yet-available state", async () => {
  fetchContent.mockRejectedValue(new CertApiError("denied", 403, "no_assignment", null));
  render(<PdiLessonClient certificationId={CERT} lessonId="pdi1-l0201" />);
  expect(await screen.findByText("Not yet available")).toBeInTheDocument();
});

it("flag off: no Vault call", () => {
  delete process.env.NEXT_PUBLIC_PDI_TRAINING_ENABLED;
  render(<PdiLessonClient certificationId={CERT} lessonId="pdi1-l0101" />);
  expect(screen.getByText("Not yet available")).toBeInTheDocument();
  expect(fetchContent).not.toHaveBeenCalled();
});
