/**
 * @jest-environment jsdom
 */
// ============================================================================
// TRANSACTION OS 3.3B.3A — WizardShell integration tests
// ============================================================================
// Exercises the real useWizardSession hook (state + localStorage + ?step= URL
// sync) through the shell. next/navigation is mocked so we can drive the URL
// step and capture router.replace / router.push. NO API is touched — the shell
// creates no transaction (there is no fetch anywhere in these modules).
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
import { WIZARD_SESSION_KEY, emptySession, setStep, mergeProperty } from "../wizard-session";

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

describe("WizardShell — mount / portal shell", () => {
  it("renders the wizard chrome on the first step", async () => {
    render(<WizardShell />);
    expect(await screen.findByText("New Transaction")).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 6")).toBeInTheDocument();
    expect(screen.getByTestId("wizard-step-type")).toBeInTheDocument();
    // Stepper present
    expect(
      screen.getByRole("navigation", { name: "Transaction wizard progress" })
    ).toBeInTheDocument();
  });
});

describe("WizardShell — navigation", () => {
  it("Next advances and syncs the ?step= URL (after the step validates)", async () => {
    render(<WizardShell />);
    await screen.findByTestId("wizard-step-type");

    fireEvent.click(screen.getByRole("radio", { name: /Purchase/ })); // type valid
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));

    expect(await screen.findByTestId("wizard-step-property")).toBeInTheDocument();
    expect(mockReplace).toHaveBeenCalledWith("/workspace/new?step=property");
  });

  it("Back returns to the previous step", async () => {
    render(<WizardShell />);
    await screen.findByTestId("wizard-step-type");

    fireEvent.click(screen.getByRole("radio", { name: /Purchase/ }));
    fireEvent.click(screen.getByRole("button", { name: /Next/ })); // → property
    await screen.findByTestId("wizard-step-property");
    fireEvent.click(screen.getByRole("button", { name: /Back/ })); // → type

    expect(await screen.findByTestId("wizard-step-type")).toBeInTheDocument();
  });

  it("the Stepper jumps back to a visited step", async () => {
    render(<WizardShell />);
    await screen.findByTestId("wizard-step-type");
    fireEvent.click(screen.getByRole("radio", { name: /Purchase/ }));
    fireEvent.click(screen.getByRole("button", { name: /Next/ })); // → property
    await screen.findByTestId("wizard-step-property");

    fireEvent.click(screen.getByRole("button", { name: "Go to Transaction Type" }));
    expect(await screen.findByTestId("wizard-step-type")).toBeInTheDocument();
  });
});

describe("WizardShell — validation gate (real rules)", () => {
  it("blocks Next on the type step until a type is chosen", async () => {
    render(<WizardShell />);
    await screen.findByTestId("wizard-step-type");

    fireEvent.click(screen.getByRole("button", { name: /Next/ }));

    // Stays on type; message shown (banner + inline); no forward navigation.
    expect(screen.getByTestId("wizard-step-type")).toBeInTheDocument();
    expect(
      screen.getAllByText("Select a transaction type.").length
    ).toBeGreaterThan(0);
    expect(mockReplace).not.toHaveBeenCalledWith("/workspace/new?step=property");
  });

  it("blocks Next on property when the address is empty", async () => {
    render(<WizardShell />);
    await screen.findByTestId("wizard-step-type");
    fireEvent.click(screen.getByRole("radio", { name: /Purchase/ }));
    fireEvent.click(screen.getByRole("button", { name: /Next/ })); // → property
    await screen.findByTestId("wizard-step-property");

    fireEvent.click(screen.getByRole("button", { name: /Next/ })); // blocked
    expect(screen.getByTestId("wizard-step-property")).toBeInTheDocument();
    expect(
      screen.getAllByText("Property address is required.").length
    ).toBeGreaterThan(0);
  });

  it("Back NEVER validates (bypasses a failing current step) and clears errors", async () => {
    render(<WizardShell />);
    await screen.findByTestId("wizard-step-type");
    fireEvent.click(screen.getByRole("radio", { name: /Purchase/ }));
    fireEvent.click(screen.getByRole("button", { name: /Next/ })); // → property (empty)
    await screen.findByTestId("wizard-step-property");

    fireEvent.click(screen.getByRole("button", { name: /Next/ })); // blocked
    expect(
      screen.getAllByText("Property address is required.").length
    ).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /Back/ })); // Back bypasses
    expect(await screen.findByTestId("wizard-step-type")).toBeInTheDocument();
    expect(
      screen.queryByText("Property address is required.")
    ).not.toBeInTheDocument();
  });
});

describe("WizardShell — restore / URL sync", () => {
  it("restores the step + fields from localStorage on refresh", async () => {
    seed({ ...setStep(mergeProperty(emptySession(), { city: "Miami" }), "dates") });
    render(<WizardShell />);
    expect(await screen.findByTestId("wizard-step-dates")).toBeInTheDocument();
  });

  it("a valid ?step= deep-link wins over the stored step", async () => {
    seed(setStep(emptySession(), "review")); // stored says review
    mockNav.step = "parties"; // URL says parties
    render(<WizardShell />);
    expect(await screen.findByTestId("wizard-step-parties")).toBeInTheDocument();
  });

  it("normalises the URL when no valid ?step= is present", async () => {
    render(<WizardShell />);
    await screen.findByTestId("wizard-step-type");
    expect(mockReplace).toHaveBeenCalledWith("/workspace/new");
  });
});

describe("WizardShell — cancel", () => {
  it("discards the draft and leaves the wizard", async () => {
    seed(setStep(emptySession(), "review"));
    render(<WizardShell />);
    await screen.findByTestId("wizard-step-review");

    fireEvent.click(screen.getByRole("button", { name: /Cancel/ }));

    expect(window.localStorage.getItem(WIZARD_SESSION_KEY)).toBeNull();
    expect(mockPush).toHaveBeenCalledWith("/workspace");
  });
});
