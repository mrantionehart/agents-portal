// ============================================================================
// P4H-14 × FL-CAT-1 — the /workspace/new wizard must send a business line
// ============================================================================
// The create route requires an explicit business_line (brokerage |
// acquisition) and the wizard never sent one, so EVERY wizard create — Buyer
// Rep included — was refused with "business_line is required". Found in the
// isolated UAT. The wizard now asks for it on step 1: no default, no inference.
// ============================================================================
import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";

jest.mock("next/navigation", () => ({ useRouter: jest.fn(), useSearchParams: jest.fn() }));
import { useRouter, useSearchParams } from "next/navigation";
import WizardShell from "../WizardShell";
import { emptySession } from "../wizard-session";
import { toCreateBody } from "../submit-orchestrator";
import { validateStep } from "../wizard-validation";

const replace = jest.fn();
beforeEach(() => {
  window.localStorage.clear();
  replace.mockClear();
  (useRouter as unknown as jest.Mock).mockReturnValue({ replace, push: jest.fn() });
  (useSearchParams as unknown as jest.Mock).mockReturnValue({ get: () => null });
});

describe("[P4H-14] wizard business line", () => {
  it("step 1 asks for it with NO default, and Next is refused until it is chosen", async () => {
    render(<WizardShell />);
    const brokerage = await screen.findByRole("radio", { name: /^Brokerage/ });
    expect(brokerage).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("radio", { name: /^Acquisition/ })).toHaveAttribute("aria-checked", "false");
    fireEvent.click(screen.getByRole("radio", { name: /Buyer Rep/ }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect((await screen.findAllByText("Choose Brokerage or Acquisition.")).length).toBeGreaterThan(0);
    expect(replace).not.toHaveBeenCalledWith(expect.stringContaining("step=property"));
    fireEvent.click(brokerage);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(replace).toHaveBeenCalledWith(expect.stringContaining("step=property"));
  });

  it("the create body carries the chosen line (and a Buyer Rep type)", () => {
    const body = toCreateBody({ ...emptySession(), transaction_type: "buyer_rep", business_line: "brokerage", property: { address: "1 A St" } });
    expect(body).toMatchObject({ type: "buyer_rep", business_line: "brokerage" });
    expect(toCreateBody({ ...emptySession(), transaction_type: "purchase", business_line: "acquisition" }).business_line).toBe("acquisition");
  });

  it("a session that does not carry the field (training) is not asked", () => {
    expect(validateStep("type", { ...emptySession(), transaction_type: "purchase" }).valid).toBe(true);
    expect(validateStep("type", { ...emptySession(), transaction_type: "purchase", business_line: null }).valid).toBe(false);
  });
});
