// ============================================================================
// FL-CAT-1 — the agent answers the two deal-fact questions in the Agent Portal
// ============================================================================
// Runner: jest + @testing-library/react. Vault is the authority (route tests
// there); this proves the agent can SEE the questions, answer them, save, is
// told when they are locked for broker review, and sees Vault's refusal.
// ============================================================================
import "@testing-library/jest-dom";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import DealFactsCard from "../DealFactsCard";

const json = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body }) as unknown as Response;
const facts = (over: Record<string, unknown> = {}) => ({ available: true, applies: true, editable: true, brokerage_relationship: null, earnest_money_status: null, ...over });

describe("[FL-CAT-1] DealFactsCard", () => {
  it("shows both questions with no default answer and the review-required notes", async () => {
    const f = jest.fn().mockResolvedValue(json(200, facts()));
    render(<DealFactsCard transactionId="t1" fetchImpl={f} />);
    const rel = (await screen.findByLabelText("Brokerage relationship")) as HTMLSelectElement;
    expect(rel.value).toBe("");
    expect((screen.getByLabelText("Earnest-money requirement") as HTMLSelectElement).value).toBe("");
    expect(screen.getByText(/Brokerage Relationship Disclosure stays required/)).toBeInTheDocument();
    expect(screen.getByText(/Proof of earnest money stays required/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save answers" })).toBeDisabled();
    expect(f).toHaveBeenCalledWith("/api/transactions/t1/compliance-facts", { credentials: "include" });
  });

  it("the agent answers and saves; the POST carries exactly the answers", async () => {
    const f = jest.fn().mockResolvedValueOnce(json(200, facts())).mockResolvedValueOnce(json(200, { ok: true }));
    render(<DealFactsCard transactionId="t1" fetchImpl={f} />);
    fireEvent.change(await screen.findByLabelText("Brokerage relationship"), { target: { value: "single_agent" } });
    fireEvent.change(screen.getByLabelText("Earnest-money requirement"), { target: { value: "required" } });
    fireEvent.click(screen.getByRole("button", { name: "Save answers" }));
    await screen.findByRole("status");
    const [url, init] = f.mock.calls[1];
    expect(url).toBe("/api/transactions/t1/compliance-facts");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ brokerage_relationship: "single_agent", earnest_money_status: "required" });
  });

  it("after submission the answers are shown read-only and only the broker can change them", async () => {
    const f = jest.fn().mockResolvedValue(json(200, facts({ editable: false, brokerage_relationship: "transaction_broker", earnest_money_status: "not_required" })));
    render(<DealFactsCard transactionId="t1" fetchImpl={f} />);
    expect(await screen.findByTestId("deal-facts-locked")).toHaveTextContent("only your broker can change");
    expect(screen.getByLabelText("Brokerage relationship")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Save answers" })).toBeNull();
  });

  it("Vault's refusal is shown, never swallowed", async () => {
    const f = jest.fn().mockResolvedValueOnce(json(200, facts())).mockResolvedValueOnce(json(409, { error: "This deal has been submitted for broker review." }));
    render(<DealFactsCard transactionId="t1" fetchImpl={f} />);
    fireEvent.change(await screen.findByLabelText("Brokerage relationship"), { target: { value: "unknown" } });
    fireEvent.click(screen.getByRole("button", { name: "Save answers" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("submitted for broker review");
  });

  it("renders nothing for types without these requirements, or before Vault has the fields", async () => {
    for (const body of [facts({ applies: false }), facts({ available: false })]) {
      const f = jest.fn().mockResolvedValue(json(200, body));
      const { container, unmount } = render(<DealFactsCard transactionId="t1" fetchImpl={f} />);
      await waitFor(() => expect(f).toHaveBeenCalled());
      await new Promise((r) => setTimeout(r, 0));
      expect(container).toBeEmptyDOMElement();
      unmount();
    }
  });
});
