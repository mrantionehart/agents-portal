/**
 * @jest-environment jsdom
 */
// ============================================================================
// HOTFIX.AP.STR.001 — BuildingsClient (Portal 2.0 view) tests
// ============================================================================
// Locks the four data states, the approved copy, the search affordance, the
// unchanged endpoint, and the compliance guardrails.
// ============================================================================

import React from "react";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";

import BuildingsClient from "../BuildingsClient";

function mockFetchOnce(payload: any, ok = true) {
  return jest.fn(async () => ({
    ok,
    status: ok ? 200 : 500,
    json: async () => payload,
  })) as any;
}

const SAMPLE = {
  buildings: [
    { id: "1", name: "The Setai", address: "101 20th St", city: "Miami Beach", neighborhood: "South Beach", category: "daily", hoa_verification: "verified" },
    { id: "2", name: "Brickell House", address: "55 SW 9th", city: "Miami", neighborhood: "Brickell", category: "weekly", hoa_verification: "unverified" },
  ],
  pagination: { total: 2, totalPages: 1 },
};

const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
  jest.clearAllMocks();
});

describe("BuildingsClient — chrome + copy", () => {
  it("renders the page title, the Airbnb Friendly category label, and the disclaimer", async () => {
    global.fetch = mockFetchOnce(SAMPLE);
    await act(async () => {
      render(<BuildingsClient />);
    });
    expect(await screen.findByRole("heading", { name: /buildings/i })).toBeInTheDocument();
    expect(screen.getByText(/airbnb friendly/i)).toBeInTheDocument();
    expect(
      screen.getByText(/rental policies can change and should be independently verified/i)
    ).toBeInTheDocument();
  });

  it("makes NO 'all buildings' / permission claim anywhere in the rendered output", async () => {
    global.fetch = mockFetchOnce(SAMPLE);
    let container: HTMLElement;
    await act(async () => {
      ({ container } = render(<BuildingsClient />));
    });
    await screen.findByText(/the setai/i);
    const text = container!.textContent!.toLowerCase();
    for (const phrase of ["all buildings", "every building", "approved for airbnb", "airbnb permitted", "guaranteed eligibility"]) {
      expect(text.includes(phrase)).toBe(false);
    }
  });
});

describe("BuildingsClient — data states", () => {
  it("shows a loading state before data resolves", async () => {
    let resolve: (v: any) => void;
    global.fetch = jest.fn(() => new Promise((r) => { resolve = () => r({ ok: true, status: 200, json: async () => SAMPLE } as any); })) as any;
    render(<BuildingsClient />);
    expect(screen.getByTestId("buildings-loading")).toBeInTheDocument();
    await act(async () => { resolve!(undefined); });
  });

  it("shows the populated state (building names) on success", async () => {
    global.fetch = mockFetchOnce(SAMPLE);
    await act(async () => { render(<BuildingsClient />); });
    expect(await screen.findByText(/the setai/i)).toBeInTheDocument();
    expect(screen.getByText(/brickell house/i)).toBeInTheDocument();
  });

  it("shows an empty state when the dataset is empty", async () => {
    global.fetch = mockFetchOnce({ buildings: [], pagination: { total: 0, totalPages: 1 } });
    await act(async () => { render(<BuildingsClient />); });
    expect(await screen.findByTestId("buildings-empty")).toBeInTheDocument();
  });

  it("shows an error state (with retry) when the request fails", async () => {
    global.fetch = jest.fn(async () => { throw new Error("network"); }) as any;
    await act(async () => { render(<BuildingsClient />); });
    expect(await screen.findByTestId("buildings-error")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry|try again/i })).toBeInTheDocument();
  });
});

describe("BuildingsClient — wiring + search", () => {
  it("fetches from /api/broker/str-directory (endpoint unchanged)", async () => {
    const fetchMock = mockFetchOnce(SAMPLE);
    global.fetch = fetchMock;
    await act(async () => { render(<BuildingsClient />); });
    await screen.findByText(/the setai/i);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/broker/str-directory");
  });

  it("exposes a keyboard-accessible search input over the returned dataset", async () => {
    global.fetch = mockFetchOnce(SAMPLE);
    await act(async () => { render(<BuildingsClient />); });
    await screen.findByText(/the setai/i);
    const input = screen.getByRole("searchbox");
    expect(input).toBeInTheDocument();
    await act(async () => { fireEvent.change(input, { target: { value: "setai" } }); });
    expect((input as HTMLInputElement).value).toBe("setai");
  });
});
