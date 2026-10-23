// ============================================================================
// P4H-13 — the review panel, as the agent meets it
// ============================================================================
// Runner: jest + @testing-library/react.
//
// These mount the real component. The load-bearing ones are [CRP-3] — a
// blocking finding must be visible and must report NOT submittable — and
// [CRP-8], which pins that rule output is never labelled as AI.
// ============================================================================

import "@testing-library/jest-dom";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

const authFetch = jest.fn();
jest.mock("@/lib/supabase", () => ({
  authFetch: (...args: unknown[]) => authFetch(...args),
}));

import ComplianceReviewPanel from "../ComplianceReviewPanel";

const ok = (review: unknown) => ({
  ok: true,
  status: 200,
  json: async () => ({ ok: true, review }),
});

const PASS = {
  verdict: "pass",
  findings: [],
  submittable: true,
  disclaimer:
    "Automatic review checks the information and the document, not the law. A clear result does not approve the agreement or confirm legal compliance — the Broker of Record decides that.",
};

beforeEach(() => jest.clearAllMocks());

const props = {
  transactionId: "txn-1",
  formInstanceId: "fi-1",
  formId: "ERL-14",
};

describe("it runs automatically", () => {
  it("[CRP-1] reviews on mount — no button for the agent to forget", async () => {
    authFetch.mockResolvedValue(ok(PASS));
    render(<ComplianceReviewPanel {...props} />);
    await waitFor(() => expect(authFetch).toHaveBeenCalledTimes(1));
    expect(authFetch.mock.calls[0][0]).toBe(
      "/api/paperwork/compliance-review/txn-1/fi-1",
    );
    expect(screen.queryByRole("button", { name: /run review/i })).not.toBeInTheDocument();
  });

  it("[CRP-2] re-runs when the caller bumps refreshKey (save / submit)", async () => {
    authFetch.mockResolvedValue(ok(PASS));
    const { rerender } = render(<ComplianceReviewPanel {...props} refreshKey={0} />);
    await waitFor(() => expect(authFetch).toHaveBeenCalledTimes(1));
    rerender(<ComplianceReviewPanel {...props} refreshKey={1} />);
    await waitFor(() => expect(authFetch).toHaveBeenCalledTimes(2));
  });
});

describe("findings the agent can act on", () => {
  const NEEDS = {
    verdict: "needs_correction",
    submittable: false,
    disclaimer: PASS.disclaimer,
    findings: [
      {
        code: "MISSING:terms.listing.listing_expiration_date",
        kind: "blocking",
        label: "Missing: Listing expiration date",
        detail: "Required before the agreement can be submitted.",
        path: "terms.listing.listing_expiration_date",
      },
      {
        code: "LANDLORD_EMAIL_INVALID:p1",
        kind: "blocking",
        label: "Signing email is not a valid address for Olive Owner",
        detail: '"olive@" will not reach anyone.',
      },
      {
        code: "TERM_BACKDATED",
        kind: "judgment",
        label: "Listing is backdated",
        detail: "The effective date 2026-10-01 is before today.",
      },
    ],
  };

  it("[CRP-3] a blocking finding is shown, and submission is reported BLOCKED", async () => {
    authFetch.mockResolvedValue(ok(NEEDS));
    const onSubmittableChange = jest.fn();
    render(<ComplianceReviewPanel {...props} onSubmittableChange={onSubmittableChange} />);

    expect(await screen.findByTestId("review-verdict")).toHaveTextContent(
      /needs correction/i,
    );
    expect(
      screen.getByText("Missing: Listing expiration date"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/not a valid address for Olive Owner/),
    ).toBeInTheDocument();
    expect(onSubmittableChange).toHaveBeenCalledWith(false);
  });

  it("[CRP-4] findings are grouped so 'must fix' is not buried with advice", async () => {
    authFetch.mockResolvedValue(ok(NEEDS));
    render(<ComplianceReviewPanel {...props} />);
    expect(await screen.findByTestId("review-group-blocking")).toBeInTheDocument();
    expect(screen.getByTestId("review-group-judgment")).toBeInTheDocument();
    expect(screen.getByText(/Must be fixed/i)).toBeInTheDocument();
    expect(screen.getAllByTestId("review-finding")).toHaveLength(3);
  });

  it("[CRP-5] a clean review says so and reports submittable", async () => {
    authFetch.mockResolvedValue(ok(PASS));
    const onSubmittableChange = jest.fn();
    render(<ComplianceReviewPanel {...props} onSubmittableChange={onSubmittableChange} />);
    expect(await screen.findByTestId("review-verdict")).toHaveTextContent(/passed/i);
    expect(screen.queryAllByTestId("review-finding")).toHaveLength(0);
    expect(onSubmittableChange).toHaveBeenCalledWith(true);
  });

  it("[CRP-6] manual review is SUBMITTABLE — the broker is who should see it", async () => {
    authFetch.mockResolvedValue(
      ok({ ...NEEDS, verdict: "manual_review", submittable: true,
           findings: [NEEDS.findings[2]] }),
    );
    const onSubmittableChange = jest.fn();
    render(<ComplianceReviewPanel {...props} onSubmittableChange={onSubmittableChange} />);
    expect(await screen.findByTestId("review-verdict")).toHaveTextContent(
      /broker will need to look/i,
    );
    expect(onSubmittableChange).toHaveBeenCalledWith(true);
  });
});

describe("it cannot imply permission it does not have", () => {
  it("[CRP-7] a failed review reports NOT submittable, and offers a retry", async () => {
    authFetch.mockResolvedValue({
      ok: false, status: 500, json: async () => ({ error: "Vault unavailable" }),
    });
    const onSubmittableChange = jest.fn();
    render(<ComplianceReviewPanel {...props} onSubmittableChange={onSubmittableChange} />);
    expect(await screen.findByText("Vault unavailable")).toBeInTheDocument();
    // The important half: an unrun review is not a pass.
    expect(onSubmittableChange).toHaveBeenCalledWith(false);
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    await waitFor(() => expect(authFetch).toHaveBeenCalledTimes(2));
  });

  it("[CRP-8] deterministic findings are NEVER labelled as AI", async () => {
    authFetch.mockResolvedValue(ok(PASS));
    const { container } = render(<ComplianceReviewPanel {...props} />);
    await screen.findByTestId("review-verdict");
    // Rule output presented as a model's opinion would misrepresent both what
    // the agent is reading and what it is worth.
    expect(container.textContent).not.toMatch(/\bAI\b/);
    expect(container.textContent).not.toMatch(/artificial intelligence/i);
    expect(screen.getByTestId("review-disclaimer")).toHaveTextContent(
      /does not approve the agreement|legal compliance/i,
    );
  });

  it("[CRP-9] renders NOTHING for a form Vault will not review", async () => {
    const { container } = render(
      <ComplianceReviewPanel {...props} formId="FAR-BAR-ASIS-7x" />,
    );
    expect(container).toBeEmptyDOMElement();
    expect(authFetch).not.toHaveBeenCalled();
  });

  it("[CRP-10] renders nothing before a document exists", async () => {
    const { container } = render(
      <ComplianceReviewPanel {...props} formInstanceId={null} />,
    );
    expect(container).toBeEmptyDOMElement();
    expect(authFetch).not.toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════════════════════════════
// The entry point: it must actually be MOUNTED where the agent looks
// ══════════════════════════════════════════════════════════════════════════
// A component nobody renders is a feature nobody has. This repo has shipped a
// dead control before, which is why this asserts the mount rather than trusting
// the import.
describe("the panel is reachable from the form drawer", () => {
  it("[CRP-11] FormDetailDrawer renders it, with the form id and instance", () => {
    const fs = require("fs") as typeof import("fs");
    const path = require("path") as typeof import("path");
    const src = fs
      .readFileSync(
        path.join(__dirname, "..", "FormDetailDrawer.tsx"),
        "utf-8",
      )
      .replace(/\/\*[\s\S]*?\*\//g, "");

    expect(src).toContain("import ComplianceReviewPanel");
    // Anchored on the JSX element, not the import: importing without
    // rendering is exactly how a dead control happens.
    const i = src.indexOf("<ComplianceReviewPanel");
    expect(i).toBeGreaterThan(-1);
    const el = src.slice(i, src.indexOf("/>", i));
    expect(el).toContain("transactionId={transactionId}");
    expect(el).toContain("formInstanceId={formInstanceId}");
    expect(el).toContain("formId={document.form_id}");
  });

  it("[CRP-12] it sits ABOVE the editable fields, not buried below the audit", () => {
    const fs = require("fs") as typeof import("fs");
    const path = require("path") as typeof import("path");
    const src = fs.readFileSync(
      path.join(__dirname, "..", "FormDetailDrawer.tsx"),
      "utf-8",
    );
    const review = src.indexOf("<ComplianceReviewPanel");
    const fields = src.indexOf("<FormEditableSection");
    // Both indices must EXIST before comparing — `-1 < n` is true, so a
    // deleted element would otherwise pass this happily.
    expect(review).toBeGreaterThan(-1);
    expect(fields).toBeGreaterThan(-1);
    expect(review).toBeLessThan(fields);
  });
});
