// ============================================================================
// EASE-2.0-PLAN-STR-DESTINATION-1 — Your Matches on /buildings
// ============================================================================
// The scoping tests matter most. Vault narrows an agent-tier caller to
// `agent_id = caller AND tenant_id = caller's tenant` inside
// listStrMatchesForCaller; these prove the Portal never tries to widen that,
// and that `?match=` is decoration rather than authorization.
// ============================================================================

import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

import YourMatches from "../YourMatches";
import {
  ACTIVE_MATCH_STATUSES,
  MATCHES_ENDPOINT,
  fetchMyMatches,
  markMatchReviewed,
  toMatchRows,
} from "../matches-model";

const MINE = "aaaaaaaa-1111-4111-8111-111111111111";
const ALSO_MINE = "bbbbbbbb-2222-4222-8222-222222222222";

const vaultMatch = (over: Record<string, unknown> = {}) => ({
  id: MINE,
  tenant_id: "tenant-1",
  agent_id: "agent-1",
  profile_id: "client-1",
  building_id: "bldg-1",
  match_type: "building_only",
  status: "new",
  match_score: 87,
  match_reasons: ["Airbnb-friendly HOA", "Within target price band", "Third reason"],
  matched_listings_count: 3,
  is_read: false,
  read_at: null,
  superseded_by: null,
  created_at: "2026-09-17T00:00:00.000Z",
  building: { id: "bldg-1", name: "Sample Tower", city: "Miami", neighborhood: "Brickell" },
  client: { id: "client-1", full_name: "Jane Q Client" },
  ...over,
});

const okJson = (body: unknown) =>
  jest.fn(async () => ({ ok: true, json: async () => body })) as unknown as typeof fetch;

describe("request shape — the Portal never claims identity", () => {
  const original = global.fetch;
  afterEach(() => { global.fetch = original; });

  it("sends only the canonical active statuses, no agent or tenant id", async () => {
    const spy = okJson({ matches: [] });
    global.fetch = spy;
    await fetchMyMatches();

    const url = (spy as unknown as jest.Mock).mock.calls[0][0] as string;
    expect(url.startsWith(MATCHES_ENDPOINT)).toBe(true);
    expect(url).toContain(`status=${ACTIVE_MATCH_STATUSES.join("%2C")}`);
    for (const forbidden of ["agent_id", "agentId", "tenant_id", "tenantId", "user_id", "userId"]) {
      expect(url).not.toContain(forbidden);
    }
  });

  it("uses the EXISTING proxy — no new endpoint", () => {
    expect(MATCHES_ENDPOINT).toBe("/api/broker/str-matches");
  });
});

describe("display shaping", () => {
  it("never surfaces the client's name — PII Vault returns but the page must not show", () => {
    const rows = toMatchRows({ matches: [vaultMatch()] });
    expect(JSON.stringify(rows)).not.toContain("Jane Q Client");
    expect(JSON.stringify(rows)).not.toContain("client_id");
  });

  it("does not carry the raw match score — ranking stays Vault's", () => {
    const rows = toMatchRows({ matches: [vaultMatch()] });
    expect(JSON.stringify(rows)).not.toContain("87");
    expect(rows[0]).not.toHaveProperty("match_score");
  });

  it("preserves Vault's order rather than re-sorting", () => {
    const rows = toMatchRows({
      matches: [
        vaultMatch({ id: MINE, match_score: 10, building: { name: "Low first" } }),
        vaultMatch({ id: ALSO_MINE, match_score: 99, building: { name: "High second" } }),
      ],
    });
    expect(rows.map((r) => r.buildingLabel)).toEqual(["Low first", "High second"]);
  });

  it("shows at most two of Vault's own reasons, unedited", () => {
    const rows = toMatchRows({ matches: [vaultMatch()] });
    expect(rows[0].reasons).toEqual(["Airbnb-friendly HOA", "Within target price band"]);
  });

  it("survives missing building, reasons and counts", () => {
    const rows = toMatchRows({
      matches: [vaultMatch({ building: null, match_reasons: null, matched_listings_count: null })],
    });
    expect(rows[0].buildingLabel).toBe("Property match");
    expect(rows[0].locality).toBeNull();
    expect(rows[0].reasons).toEqual([]);
  });

  it("drops rows with no id, and tolerates a malformed payload", () => {
    expect(toMatchRows({ matches: [vaultMatch({ id: null })] })).toEqual([]);
    expect(toMatchRows({ matches: "nope" })).toEqual([]);
    expect(toMatchRows(null)).toEqual([]);
  });
});

describe("rendering", () => {
  const original = global.fetch;
  afterEach(() => { global.fetch = original; });

  it("renders only what the caller's own scoped response contained", async () => {
    global.fetch = okJson({ matches: [vaultMatch()] });
    render(<YourMatches />);
    expect(await screen.findByText("Sample Tower")).toBeInTheDocument();
    expect(screen.getByText("Brickell, Miami")).toBeInTheDocument();
    expect(screen.queryByText("Jane Q Client")).not.toBeInTheDocument();
  });

  it("hides itself entirely when the caller has no matches", async () => {
    global.fetch = okJson({ matches: [] });
    const { container } = render(<YourMatches />);
    await waitFor(() => expect(container.querySelector('[data-testid="your-matches"]')).toBeNull());
  });

  it("shows a retryable error without breaking the page", async () => {
    global.fetch = (jest.fn(async () => ({ ok: false, status: 503 })) as unknown) as typeof fetch;
    render(<YourMatches />);
    expect(await screen.findByTestId("your-matches-error")).toBeInTheDocument();
  });

  it("highlights the match named by ?match=", async () => {
    global.fetch = okJson({ matches: [vaultMatch({ id: MINE }), vaultMatch({ id: ALSO_MINE })] });
    render(<YourMatches highlightMatchId={MINE} />);
    const target = await screen.findByTestId(`your-match-${MINE}`);
    expect(target).toHaveAttribute("data-highlighted", "true");
    expect(screen.getByTestId(`your-match-${ALSO_MINE}`)).not.toHaveAttribute("data-highlighted");
  });

  it("a foreign ?match= highlights nothing and reveals nothing", async () => {
    global.fetch = okJson({ matches: [vaultMatch({ id: MINE })] });
    const { container } = render(<YourMatches highlightMatchId="ffffffff-9999-4999-8999-999999999999" />);
    await screen.findByTestId(`your-match-${MINE}`);
    expect(container.querySelectorAll('[data-highlighted="true"]')).toHaveLength(0);
    // The rendered set is exactly what Vault returned — the id added nothing.
    expect(container.querySelectorAll('[data-testid^="your-match-"]')).toHaveLength(1);
  });
});

describe("read state", () => {
  const original = global.fetch;
  afterEach(() => { global.fetch = original; });

  it("viewing the page does NOT mark anything read", async () => {
    const spy = okJson({ matches: [vaultMatch()] });
    global.fetch = spy;
    render(<YourMatches highlightMatchId={MINE} />);
    await screen.findByText("Sample Tower");

    const calls = (spy as unknown as jest.Mock).mock.calls;
    expect(calls).toHaveLength(1);
    expect(calls[0][1]?.method ?? "GET").toBe("GET");
    expect(calls.some((c: unknown[]) => (c[1] as RequestInit | undefined)?.method === "POST")).toBe(false);
  });

  it("explicit review uses the canonical POST with match_ids", async () => {
    const spy = jest.fn(async (_u: string, init?: RequestInit) =>
      init?.method === "POST"
        ? { ok: true, json: async () => ({ success: true, marked_read: 1 }) }
        : { ok: true, json: async () => ({ matches: [vaultMatch()] }) });
    global.fetch = spy as unknown as typeof fetch;

    render(<YourMatches />);
    fireEvent.click(await screen.findByTestId(`review-${MINE}`));
    expect(await screen.findByTestId(`reviewed-${MINE}`)).toBeInTheDocument();

    const post = spy.mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === "POST");
    expect(post).toBeDefined();
    expect(post![0]).toBe(MATCHES_ENDPOINT);
    expect(JSON.parse((post![1] as RequestInit).body as string)).toEqual({ match_ids: [MINE] });
  });

  it("invents no other mutation — mark-read is the only non-GET", async () => {
    const spy = jest.fn(async (_u: string, init?: RequestInit) =>
      init?.method === "POST"
        ? { ok: true, json: async () => ({ success: true }) }
        : { ok: true, json: async () => ({ matches: [vaultMatch()] }) });
    global.fetch = spy as unknown as typeof fetch;

    render(<YourMatches />);
    fireEvent.click(await screen.findByTestId(`review-${MINE}`));
    await screen.findByTestId(`reviewed-${MINE}`);

    for (const [, init] of spy.mock.calls as [string, RequestInit | undefined][]) {
      expect(["GET", "POST", undefined]).toContain(init?.method);
    }
  });

  it("leaves the row unread when the mutation fails", async () => {
    const spy = jest.fn(async (_u: string, init?: RequestInit) =>
      init?.method === "POST"
        ? { ok: false, status: 500 }
        : { ok: true, json: async () => ({ matches: [vaultMatch()] }) });
    global.fetch = spy as unknown as typeof fetch;

    render(<YourMatches />);
    fireEvent.click(await screen.findByTestId(`review-${MINE}`));
    await waitFor(() => expect(screen.getByTestId(`review-${MINE}`)).not.toBeDisabled());
    expect(screen.queryByTestId(`reviewed-${MINE}`)).not.toBeInTheDocument();
  });

  it("markMatchReviewed reports failure rather than throwing", async () => {
    global.fetch = (jest.fn(async () => ({ ok: false, status: 500 })) as unknown) as typeof fetch;
    await expect(markMatchReviewed(MINE)).resolves.toBe(false);
  });
});
