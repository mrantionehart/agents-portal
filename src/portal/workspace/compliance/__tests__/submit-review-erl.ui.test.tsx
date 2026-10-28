// ============================================================================
// P4H-13 — the submission sequence, as the agent experiences it
// ============================================================================
// Runner: jest + @testing-library/react.
//
// The required order is: deterministic checks decide, mandatory gaps block,
// the semantic pass runs only when enabled, PASS and MANUAL_REVIEW go to the
// broker, NEEDS_CORRECTION comes back to the agent.
//
// [SUB-7] is the one that protects everything else: a transaction with no
// reviewed agreement must submit with ONE call, exactly as before — this
// button also submits FAR-BAR and lease transactions.
// ============================================================================

import "@testing-library/jest-dom";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

const refresh = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import SubmitForReviewButton from "../SubmitForReviewButton";

const ERL = { reviewFormInstanceId: "fi-1", reviewFormId: "ERL-14" };
const TXN = "txn-1";

const json = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

const click = () => fireEvent.click(screen.getByRole("button", { name: /submit for review/i }));

const reviewCalls = (f: jest.Mock) =>
  f.mock.calls.filter((c) => String(c[0]).includes("/compliance-review/"));
const submitCalls = (f: jest.Mock) =>
  f.mock.calls.filter((c) => String(c[0]).includes("/submit-review"));

beforeEach(() => jest.clearAllMocks());

describe("the review runs first, and decides", () => {
  it("[SUB-1] a PASS reviews then submits, in that order", async () => {
    const fetchImpl = jest.fn(async (url: string) =>
      String(url).includes("compliance-review")
        ? json(200, { semantic: "ran", review: { verdict: "pass", findings: [], submittable: true } })
        : json(200, { ok: true }),
    ) as unknown as jest.Mock;

    render(<SubmitForReviewButton transactionId={TXN} fetchImpl={fetchImpl as never} {...ERL} />);
    click();
    await waitFor(() => expect(screen.getByText(/submitted/i)).toBeInTheDocument());

    expect(reviewCalls(fetchImpl)).toHaveLength(1);
    expect(submitCalls(fetchImpl)).toHaveLength(1);
    // Order matters: the review must not be an afterthought.
    const order = fetchImpl.mock.calls.map((c) => String(c[0]));
    expect(order[0]).toContain("compliance-review");
    expect(order[1]).toContain("submit-review");
  });

  it("[SUB-2] it uses POST — the only verb that can reach the semantic pass", async () => {
    const fetchImpl = jest.fn(async () =>
      json(200, { semantic: "skipped", review: { verdict: "pass", findings: [], submittable: true } }),
    ) as unknown as jest.Mock;
    render(<SubmitForReviewButton transactionId={TXN} fetchImpl={fetchImpl as never} {...ERL} />);
    click();
    await waitFor(() => expect(reviewCalls(fetchImpl)).toHaveLength(1));
    expect(reviewCalls(fetchImpl)[0][1]).toMatchObject({ method: "POST" });
  });

  it("[SUB-3] NEEDS_CORRECTION comes back to the agent and submits NOTHING", async () => {
    const fetchImpl = jest.fn(async () =>
      json(200, {
        semantic: "skipped",
        review: {
          verdict: "needs_correction",
          submittable: false,
          findings: [
            { code: "NO_LANDLORD", kind: "blocking", label: "No landlord on the transaction", detail: "x" },
            { code: "MISSING:a", kind: "blocking", label: "Missing: Listing expiration date", detail: "y" },
            { code: "ADV", kind: "advisory", label: "Minor", detail: "z" },
          ],
        },
      }),
    ) as unknown as jest.Mock;

    render(<SubmitForReviewButton transactionId={TXN} fetchImpl={fetchImpl as never} {...ERL} />);
    click();
    expect(await screen.findByTestId("submit-review-blocked")).toBeInTheDocument();
    expect(screen.getByText("No landlord on the transaction")).toBeInTheDocument();
    expect(screen.getByText("Missing: Listing expiration date")).toBeInTheDocument();
    // Advisory noise is not presented as a blocker.
    expect(screen.queryByText("Minor")).not.toBeInTheDocument();
    expect(submitCalls(fetchImpl)).toHaveLength(0);
    expect(screen.queryByText(/^Submitted$/)).not.toBeInTheDocument();
  });

  it("[SUB-4] MANUAL_REVIEW proceeds to the broker", async () => {
    const fetchImpl = jest.fn(async (url: string) =>
      String(url).includes("compliance-review")
        ? json(200, {
            semantic: "ran",
            review: {
              verdict: "manual_review",
              submittable: true,
              findings: [{ code: "TERM_BACKDATED", kind: "judgment", label: "Backdated", detail: "d" }],
            },
          })
        : json(200, { ok: true }),
    ) as unknown as jest.Mock;
    render(<SubmitForReviewButton transactionId={TXN} fetchImpl={fetchImpl as never} {...ERL} />);
    click();
    await waitFor(() => expect(screen.getByText(/submitted/i)).toBeInTheDocument());
    expect(submitCalls(fetchImpl)).toHaveLength(1);
  });

  it("[SUB-5] a review that could not RUN submits nothing", async () => {
    const fetchImpl = jest.fn(async () => json(500, { error: "Vault unavailable" })) as unknown as jest.Mock;
    render(<SubmitForReviewButton transactionId={TXN} fetchImpl={fetchImpl as never} {...ERL} />);
    click();
    expect(await screen.findByText("Vault unavailable")).toBeInTheDocument();
    expect(submitCalls(fetchImpl)).toHaveLength(0);
  });
});

describe("what the agent is told about AI", () => {
  const passWith = (semantic: string) =>
    jest.fn(async (url: string) =>
      String(url).includes("compliance-review")
        ? json(200, { semantic, review: { verdict: "pass", findings: [], submittable: true } })
        : json(200, { ok: true }),
    ) as unknown as jest.Mock;

  it("[SUB-6] disabled is stated plainly — not implied by silence", async () => {
    const fetchImpl = passWith("skipped");
    render(<SubmitForReviewButton transactionId={TXN} fetchImpl={fetchImpl as never} {...ERL} />);
    click();
    expect(await screen.findByTestId("submit-review-notice")).toHaveTextContent(
      /AI review was not performed/i,
    );
  });

  it("[SUB-6b] unavailable says the broker will review it — never 'passed'", async () => {
    const fetchImpl = passWith("unavailable");
    render(<SubmitForReviewButton transactionId={TXN} fetchImpl={fetchImpl as never} {...ERL} />);
    click();
    const n = await screen.findByTestId("submit-review-notice");
    expect(n).toHaveTextContent(/unavailable/i);
    expect(n).toHaveTextContent(/broker will review/i);
    expect(n.textContent).not.toMatch(/AI (review )?passed/i);
  });

  it("[SUB-6c] when it RAN, no 'not performed' claim is made", async () => {
    const fetchImpl = passWith("ran");
    render(<SubmitForReviewButton transactionId={TXN} fetchImpl={fetchImpl as never} {...ERL} />);
    click();
    await waitFor(() => expect(screen.getByText(/submitted/i)).toBeInTheDocument());
    expect(screen.queryByTestId("submit-review-notice")).not.toBeInTheDocument();
  });
});

describe("every other transaction is untouched", () => {
  it("[SUB-7] with no reviewed agreement it submits with ONE call, as before", async () => {
    const fetchImpl = jest.fn(async () => json(200, { ok: true })) as unknown as jest.Mock;
    render(<SubmitForReviewButton transactionId={TXN} fetchImpl={fetchImpl as never} />);
    click();
    await waitFor(() => expect(screen.getByText(/submitted/i)).toBeInTheDocument());
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(reviewCalls(fetchImpl)).toHaveLength(0);
    expect(submitCalls(fetchImpl)).toHaveLength(1);
  });

  it("[SUB-8] another form id does NOT trigger a review", async () => {
    const fetchImpl = jest.fn(async () => json(200, { ok: true })) as unknown as jest.Mock;
    render(
      <SubmitForReviewButton
        transactionId={TXN}
        fetchImpl={fetchImpl as never}
        reviewFormInstanceId="fi-9"
        reviewFormId="FAR-BAR-ASIS-7x"
      />,
    );
    click();
    await waitFor(() => expect(screen.getByText(/submitted/i)).toBeInTheDocument());
    expect(reviewCalls(fetchImpl)).toHaveLength(0);
  });

  it("[SUB-9] a form id with no instance does not review either", async () => {
    const fetchImpl = jest.fn(async () => json(200, { ok: true })) as unknown as jest.Mock;
    render(
      <SubmitForReviewButton transactionId={TXN} fetchImpl={fetchImpl as never} reviewFormId="ERL-14" />,
    );
    click();
    await waitFor(() => expect(screen.getByText(/submitted/i)).toBeInTheDocument());
    expect(reviewCalls(fetchImpl)).toHaveLength(0);
  });
});
