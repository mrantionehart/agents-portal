/**
 * @jest-environment jsdom
 */
// ============================================================================
// TRANSACTION OS 3.3E — Submit for Review action + forward contract
// ============================================================================

import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { readFileSync } from "fs";
import { join } from "path";

const mockRefresh = jest.fn();
jest.mock("next/navigation", () => ({
  __esModule: true,
  useRouter: () => ({ refresh: mockRefresh }),
}));

import SubmitForReviewButton from "../SubmitForReviewButton";

function fetchMock(status: number, data: any) {
  return jest.fn(async () => ({ ok: status >= 200 && status < 300, status, json: async () => data })) as any;
}

beforeEach(() => mockRefresh.mockClear());

describe("SubmitForReviewButton", () => {
  it("submits via the portal forward and refreshes on success", async () => {
    const f = fetchMock(200, { ok: true, broker_review_status: "submitted" });
    render(<SubmitForReviewButton transactionId="txn-1" fetchImpl={f} />);

    fireEvent.click(screen.getByRole("button", { name: /Submit for Review/ }));

    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
    // hit the thin forward, POST
    expect(f).toHaveBeenCalledWith(
      "/api/transactions/txn-1/submit-review",
      expect.objectContaining({ method: "POST" })
    );
    expect(await screen.findByText("Submitted")).toBeInTheDocument();
  });

  it("surfaces an error and does not refresh on failure", async () => {
    const f = fetchMock(400, { error: "Not ready to submit." });
    render(<SubmitForReviewButton transactionId="txn-1" fetchImpl={f} />);

    fireEvent.click(screen.getByRole("button", { name: /Submit for Review/ }));

    expect(await screen.findByText("Not ready to submit.")).toBeInTheDocument();
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});

describe("submit-review forward route (source contract)", () => {
  const src = readFileSync(
    join(process.cwd(), "app/api/transactions/[id]/submit-review/route.ts"),
    "utf8"
  );
  it("carries requireAuth + proxies to the Vault submit-review endpoint", () => {
    expect(src).toMatch(/\brequireAuth\b/);
    expect(src).toContain("proxyToVault");
    expect(src).toContain("/paperwork/transactions/${id}/submit-review");
    expect(src).toContain("export async function POST");
  });
});
