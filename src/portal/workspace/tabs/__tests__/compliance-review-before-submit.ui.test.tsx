// ============================================================================
// P4H-13 — the MOUNTED workspace tab invokes review-before-submit
// ============================================================================
// Runner: jest + @testing-library/react.
//
// The button and the review endpoint were each tested in isolation and both
// passed while the feature was unreachable: ComplianceTab rendered
// `<SubmitForReviewButton transactionId={...} />` and passed neither review
// prop, so the path could never run. A unit test of a component cannot see a
// parent that fails to pass its props.
//
// So these render the REAL tab with a real state fixture, click the real
// button, and assert on the network calls that actually leave.
// ============================================================================

import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const refresh = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import ComplianceTab, { resolveReviewedForm } from "../ComplianceTab";
import type { ComplianceTabState, RequiredFormSummary } from "../../compliance/types";

const TXN = "txn-1";

function form(over: Partial<RequiredFormSummary> = {}): RequiredFormSummary {
  return {
    form_id: "ERL-14",
    form_revision: "-14",
    form_category: "listing",
    status: "ready",
    reason: null,
    drawerHref: `/workspace/${TXN}?form=ERL-14`,
    vaultHref: "/paperwork/x",
    form_instance_id: "fi-1",
    ...over,
  };
}

function state(forms: RequiredFormSummary[]): ComplianceTabState {
  return {
    readiness: {
      score: 80,
      tier: "ready_for_review",
      stage: "Review",
      nextAction: "Submit",
      suggestedPrompt: "",
    },
    blockers: [],
    warnings: [],
    requiredForms: forms,
    statutory: [],
    // `draft` is what makes the Submit control render at all.
    brokerReview: { status: "draft", pill: { tone: "neutral", label: "Draft" } } as never,
    envelope: { pending: 0, signed: 0, ready_awaiting_send: 0 } as never,
    gates: [],
    paperworkPackageUrl: "/paperwork/package",
    payoutReadinessDegraded: false,
  };
}

const json = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

const reviewCalls = (f: jest.Mock) =>
  f.mock.calls.filter((c) => String(c[0]).includes("/compliance-review/"));
const submitCalls = (f: jest.Mock) =>
  f.mock.calls.filter((c) => String(c[0]).includes("/submit-review"));

const clickSubmit = () =>
  fireEvent.click(screen.getByRole("button", { name: /submit for review/i }));

let originalFetch: typeof global.fetch;
beforeEach(() => {
  jest.clearAllMocks();
  originalFetch = global.fetch;
});
afterEach(() => {
  global.fetch = originalFetch;
});

// ── The resolver ─────────────────────────────────────────────────────
describe("resolveReviewedForm", () => {
  it("[WIRE-1] finds the ERL and returns both identifiers", () => {
    expect(resolveReviewedForm([form()])).toEqual({
      formInstanceId: "fi-1",
      formId: "ERL-14",
    });
  });

  it("[WIRE-2] nulls when the requirement exists but no INSTANCE does", () => {
    // Passing an id we do not have would 404 the review and block a
    // submission that should have gone through.
    expect(resolveReviewedForm([form({ form_instance_id: null })])).toEqual({
      formInstanceId: null,
      formId: null,
    });
  });

  it("[WIRE-3] nulls for every other form", () => {
    expect(
      resolveReviewedForm([
        form({ form_id: "FAR-BAR-ASIS-7x" }),
        form({ form_id: "RLHD-3x" }),
      ]),
    ).toEqual({ formInstanceId: null, formId: null });
  });

  it("[WIRE-4] finds the ERL among other forms", () => {
    expect(
      resolveReviewedForm([
        form({ form_id: "CDS-1", form_instance_id: "fi-9" }),
        form(),
      ]),
    ).toEqual({ formInstanceId: "fi-1", formId: "ERL-14" });
  });
});

// ── The mounted tab ──────────────────────────────────────────────────
describe("the mounted ComplianceTab", () => {
  it("[WIRE-5] clicking Submit reviews FIRST, then submits", async () => {
    const fetchImpl = jest.fn(async (url: string) =>
      String(url).includes("compliance-review")
        ? json(200, {
            semantic: "skipped",
            review: { verdict: "pass", findings: [], submittable: true },
          })
        : json(200, { ok: true }),
    );
    global.fetch = fetchImpl as never;

    render(<ComplianceTab state={state([form()])} transactionId={TXN} />);
    clickSubmit();
    await waitFor(() => expect(screen.getByText(/submitted/i)).toBeInTheDocument());

    // This is the assertion the isolated tests could not make.
    expect(reviewCalls(fetchImpl as unknown as jest.Mock)).toHaveLength(1);
    expect(reviewCalls(fetchImpl as unknown as jest.Mock)[0][0]).toBe(
      `/api/paperwork/compliance-review/${TXN}/fi-1`,
    );
    expect(reviewCalls(fetchImpl as unknown as jest.Mock)[0][1]).toMatchObject({
      method: "POST",
    });
    const order = (fetchImpl as unknown as jest.Mock).mock.calls.map((c) => String(c[0]));
    expect(order[0]).toContain("compliance-review");
    expect(order[1]).toContain("submit-review");
  });

  it("[WIRE-6] a failing review BLOCKS the submission from the real tab", async () => {
    const fetchImpl = jest.fn(async () =>
      json(200, {
        semantic: "skipped",
        review: {
          verdict: "needs_correction",
          submittable: false,
          findings: [
            {
              code: "NO_LANDLORD",
              kind: "blocking",
              label: "No landlord on the transaction",
              detail: "x",
            },
          ],
        },
      }),
    );
    global.fetch = fetchImpl as never;

    render(<ComplianceTab state={state([form()])} transactionId={TXN} />);
    clickSubmit();

    expect(await screen.findByTestId("submit-review-blocked")).toBeInTheDocument();
    expect(screen.getByText("No landlord on the transaction")).toBeInTheDocument();
    expect(submitCalls(fetchImpl as unknown as jest.Mock)).toHaveLength(0);
  });

  it("[WIRE-7] a transaction with NO ERL submits with ONE call, as before", async () => {
    const fetchImpl = jest.fn(async () => json(200, { ok: true }));
    global.fetch = fetchImpl as never;

    render(
      <ComplianceTab
        state={state([form({ form_id: "FAR-BAR-ASIS-7x" })])}
        transactionId={TXN}
      />,
    );
    clickSubmit();
    await waitFor(() => expect(screen.getByText(/submitted/i)).toBeInTheDocument());

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(reviewCalls(fetchImpl as unknown as jest.Mock)).toHaveLength(0);
    expect(submitCalls(fetchImpl as unknown as jest.Mock)).toHaveLength(1);
  });

  it("[WIRE-8] an ERL requirement with no instance yet does NOT review", async () => {
    const fetchImpl = jest.fn(async () => json(200, { ok: true }));
    global.fetch = fetchImpl as never;

    render(
      <ComplianceTab
        state={state([form({ form_instance_id: null })])}
        transactionId={TXN}
      />,
    );
    clickSubmit();
    await waitFor(() => expect(screen.getByText(/submitted/i)).toBeInTheDocument());
    expect(reviewCalls(fetchImpl as unknown as jest.Mock)).toHaveLength(0);
  });

  it("[WIRE-9] the tab tells the agent when AI review did not run", async () => {
    const fetchImpl = jest.fn(async (url: string) =>
      String(url).includes("compliance-review")
        ? json(200, {
            semantic: "skipped",
            review: { verdict: "pass", findings: [], submittable: true },
          })
        : json(200, { ok: true }),
    );
    global.fetch = fetchImpl as never;
    render(<ComplianceTab state={state([form()])} transactionId={TXN} />);
    clickSubmit();
    expect(await screen.findByTestId("submit-review-notice")).toHaveTextContent(
      /AI review was not performed/i,
    );
  });

  it("[WIRE-10] no Submit control once already submitted — nothing to review", () => {
    const s = state([form()]);
    render(
      <ComplianceTab
        state={{ ...s, brokerReview: { status: "submitted", pill: s.brokerReview.pill } as never }}
        transactionId={TXN}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /submit for review/i }),
    ).not.toBeInTheDocument();
  });
});
