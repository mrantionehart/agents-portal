/**
 * @jest-environment jsdom
 */
// ============================================================================
// HOTFIX.AP.STR.001 — Sidebar renders the Buildings nav item
// ============================================================================
// Proves the item is reachable in the Portal 2.0 shell (desktop + mobile use
// the same list), sits after Clients, links to /buildings, and its icon
// resolves through the ICONS registry (no missing-icon crash).
// ============================================================================

import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("next/navigation", () => ({
  usePathname: () => "/home",
}));

import Sidebar from "../Sidebar";

describe("Sidebar — Buildings item", () => {
  it("renders a Buildings link pointing at /buildings", () => {
    render(<Sidebar role="agent" />);
    const link = screen.getByRole("link", { name: /buildings/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/buildings");
  });

  it("resolves an icon for Buildings (renders an svg, no missing-icon crash)", () => {
    render(<Sidebar role="agent" />);
    const link = screen.getByRole("link", { name: /buildings/i });
    expect(link.querySelector("svg")).toBeTruthy();
  });

  it("places Buildings immediately after Clients in the rendered order", () => {
    render(<Sidebar role="agent" />);
    const labels = screen
      .getAllByRole("link")
      .map((a) => (a.textContent || "").trim())
      .filter(Boolean);
    const ci = labels.findIndex((l) => /^clients$/i.test(l));
    const bi = labels.findIndex((l) => /^buildings$/i.test(l));
    expect(ci).toBeGreaterThanOrEqual(0);
    expect(bi).toBe(ci + 1);
  });
});
