// Real render + fireEvent UI test for the learner simulator (jest + RTL).
// Entry point → primary action (fill + save + submit) → result appears; and the
// dark (flag-off) state shows "coming soon" instead of the entry.

import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const prepareExercise = jest.fn();
const saveDraft = jest.fn();
const submitAttempt = jest.fn();
jest.mock("@/lib/matrix/vault-matrix-client", () => ({
  __esModule: true,
  prepareExercise: (...a: unknown[]) => prepareExercise(...a),
  saveDraft: (...a: unknown[]) => saveDraft(...a),
  submitAttempt: (...a: unknown[]) => submitAttempt(...a),
  MatrixApiError: class MatrixApiError extends Error {
    notEnabled = false; code: string | null = null; fieldErrors?: Record<string, string>;
  },
}));

import { MatrixExperience } from "../_components/matrix-experience";

const F = "NEXT_PUBLIC_MATRIX_SIMULATOR_ENABLED";
const prev = process.env[F];
afterEach(() => { if (prev === undefined) delete process.env[F]; else process.env[F] = prev; jest.clearAllMocks(); });

const PREPARED = {
  attemptId: "att-1",
  scenarioId: "matrix-fl-rental-a1",
  scenarioLabel: "Miami-Dade Condo — Annual Lease",
  briefing: "Correct the prior agent's draft.",
  fields: [
    { id: "streetAddress", label: "Street Address", type: "text", required: true },
    { id: "classification", label: "Classification", type: "enum", required: true, options: ["Residential Rental", "Residential Sale"] },
  ],
  values: { streetAddress: "48 Larch Terrace", classification: "Residential Sale" },
  hints: [{ fieldId: "classification", hint: "This listing is an annual rental, not a sale." }],
};

describe("MatrixExperience — flag off (dark)", () => {
  it("shows a coming-soon state and NOT the entry action", () => {
    delete process.env[F];
    render(<MatrixExperience />);
    expect(screen.getByText(/coming soon/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /start module a/i })).not.toBeInTheDocument();
  });
});

describe("MatrixExperience — learner journey (flag on)", () => {
  beforeEach(() => { process.env[F] = "true"; });

  it("offers all three modules and starts the chosen scenario family", async () => {
    prepareExercise.mockResolvedValue(PREPARED);
    render(<MatrixExperience />);
    // All three module entry points present (Florida v3 scenario ids).
    expect(document.querySelector('[data-matrix-module="matrix-fl-rental-a1"]')).toBeInTheDocument();
    expect(document.querySelector('[data-matrix-module="matrix-fl-sales-b1"]')).toBeInTheDocument();
    expect(document.querySelector('[data-matrix-module="matrix-fl-maint-c1"]')).toBeInTheDocument();
    // Starting Module B requests the Florida Sales scenario specifically.
    fireEvent.click(screen.getByRole("button", { name: /start module b/i }));
    await waitFor(() => expect(prepareExercise).toHaveBeenCalledWith("matrix-fl-sales-b1"));
  });

  it("entry → start → fields render → edit → save → submit → result", async () => {
    prepareExercise.mockResolvedValue(PREPARED);
    saveDraft.mockResolvedValue({ ok: true });
    submitAttempt.mockResolvedValue({ submissionId: "sub-1", scorePct: 100, passed: true, criticalErrorCount: 0, coaching: [], reviewStatus: "submitted" });

    render(<MatrixExperience />);

    // Entry point present
    const start = screen.getByRole("button", { name: /start module a/i });
    fireEvent.click(start);

    // Fields render (primary surface), with the injected-error hint visible
    const addr = await screen.findByLabelText("Street Address");
    expect(addr).toHaveValue("48 Larch Terrace");
    expect(screen.getByText(/annual rental, not a sale/i)).toBeInTheDocument();

    // Edit + correct the seeded error
    fireEvent.change(screen.getByLabelText("Classification"), { target: { value: "Residential Rental" } });

    // Save Incomplete fires the draft save with the attempt id
    fireEvent.click(screen.getByRole("button", { name: /save incomplete/i }));
    await waitFor(() => expect(saveDraft).toHaveBeenCalledWith("att-1", expect.objectContaining({ classification: "Residential Rental" })));

    // Submit → result appears (score shown)
    fireEvent.click(screen.getByRole("button", { name: /submit for review/i }));
    expect(await screen.findByText(/submitted for review/i)).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(submitAttempt).toHaveBeenCalledWith("att-1");
  });

  it("a 422 with fieldErrors keeps the learner on the form with the error shown", async () => {
    prepareExercise.mockResolvedValue(PREPARED);
    saveDraft.mockResolvedValue({ ok: true });
    const e = Object.assign(new Error("invalid"), { code: "invalid", notEnabled: false, fieldErrors: { streetAddress: "Street Address is required." } });
    // make it an instanceof the mocked MatrixApiError
    const { MatrixApiError } = jest.requireMock("@/lib/matrix/vault-matrix-client") as { MatrixApiError: new () => Error };
    Object.setPrototypeOf(e, MatrixApiError.prototype);
    submitAttempt.mockRejectedValue(e);

    render(<MatrixExperience />);
    fireEvent.click(screen.getByRole("button", { name: /start module a/i }));
    await screen.findByLabelText("Street Address");
    fireEvent.click(screen.getByRole("button", { name: /submit for review/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/street address is required/i);
    // still on the form (submit button present), not on a result screen
    expect(screen.getByRole("button", { name: /submit for review/i })).toBeInTheDocument();
  });
});
