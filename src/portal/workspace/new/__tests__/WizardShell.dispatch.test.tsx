/**
 * @jest-environment jsdom
 */
// ============================================================================
// TRANSACTION OS 3.3B.3B — WizardShell step-dispatch tests
// ============================================================================
// Confirms the shell now renders the REAL step components (not the 3.3B.3A
// placeholders) and that a selection flows through the live session. Reuses the
// next/navigation mock pattern from WizardShell.test.tsx. No API.
// ============================================================================

import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";

jest.mock("next/navigation", () => ({
  __esModule: true,
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
}));

import { useRouter, useSearchParams } from "next/navigation";
import WizardShell from "../WizardShell";
import {
  WIZARD_SESSION_KEY,
  emptySession,
  setStep,
} from "../wizard-session";

const mockUseRouter = useRouter as unknown as jest.Mock;
const mockUseSearchParams = useSearchParams as unknown as jest.Mock;
const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockNav: { step: string | null } = { step: null };

beforeEach(() => {
  window.localStorage.clear();
  mockReplace.mockClear();
  mockPush.mockClear();
  mockNav.step = null;
  mockUseRouter.mockReturnValue({ replace: mockReplace, push: mockPush });
  mockUseSearchParams.mockReturnValue({
    get: (k: string) => (k === "step" ? mockNav.step : null),
  });
});

function seed(over: Partial<ReturnType<typeof emptySession>>) {
  window.localStorage.setItem(
    WIZARD_SESSION_KEY,
    JSON.stringify({ ...emptySession(), ...over })
  );
}

it("dispatches the real TransactionTypeStep on the first step", async () => {
  render(<WizardShell />);
  await screen.findByTestId("wizard-step-type");
  // real component, not the placeholder copy
  expect(screen.getByRole("radio", { name: /Purchase/ })).toBeInTheDocument();
  expect(
    screen.queryByText(/form is added in a later phase/)
  ).not.toBeInTheDocument();
});

it("selecting a type updates the live session (radio becomes checked)", async () => {
  render(<WizardShell />);
  await screen.findByTestId("wizard-step-type");
  fireEvent.click(screen.getByRole("radio", { name: /Listing/ }));
  expect(screen.getByRole("radio", { name: /Listing/ })).toHaveAttribute(
    "aria-checked",
    "true"
  );
});

it("dispatches the real ReviewStep summary on the review step", async () => {
  seed(
    setStep(
      { ...emptySession(), transaction_type: "purchase" },
      "review"
    )
  );
  render(<WizardShell />);
  expect(await screen.findByTestId("wizard-review")).toBeInTheDocument();
  expect(screen.getByText("Purchase")).toBeInTheDocument();
});

it("keeps a placeholder on the terminal create step (creation is 3.3B.3D)", async () => {
  seed(setStep(emptySession(), "create"));
  render(<WizardShell />);
  expect(await screen.findByTestId("wizard-step-create")).toBeInTheDocument();
  expect(screen.getByText("Ready to create")).toBeInTheDocument();
});
