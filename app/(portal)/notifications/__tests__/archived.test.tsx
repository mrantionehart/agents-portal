/**
 * @jest-environment jsdom
 */
// [NOTIF-ARCH-AP] the Portal inbox lists only non-archived rows, and "Mark all
// read" never touches an archived row (Vault's rule: archived_at IS NULL).
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

jest.mock("@/lib/supabase", () => ({ getAccessToken: jest.fn(async () => "tok") }));
jest.mock("@/app/providers", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("next/link", () => ({ __esModule: true, default: ({ children, href }: any) => <a href={href}>{children}</a> }));

import NotificationsPage from "../page";

let calls: Array<{ url: string; method: string }> = [];
beforeEach(() => {
  calls = [];
  (global as any).fetch = jest.fn(async (url: string, init: RequestInit = {}) => {
    calls.push({ url: String(url), method: init.method ?? "GET" });
    if ((init.method ?? "GET") === "GET") {
      return {
        ok: true,
        status: 200,
        json: async () => [
          { id: "n1", user_id: "u1", title: "Deadline approaching", body: "b", type: "deal_update", read_at: null, created_at: new Date().toISOString(), action_url: null, related_type: null, related_id: null },
        ],
      };
    }
    return { ok: true, status: 204, json: async () => ({}) };
  });
});

describe("[NOTIF-ARCH-AP]", () => {
  it("the list request excludes archived rows", async () => {
    render(<NotificationsPage />);
    await screen.findByText("Deadline approaching");
    const list = calls.find((c) => c.method === "GET" && c.url.includes("/notifications?"))!;
    expect(list.url).toContain("user_id=eq.u1");
    expect(list.url).toContain("archived_at=is.null");
  });
  it("Mark all read only patches the caller's non-archived unread rows", async () => {
    render(<NotificationsPage />);
    await screen.findByText("Deadline approaching");
    fireEvent.click(screen.getByText(/Mark all read/));
    await waitFor(() => expect(calls.some((c) => c.method === "PATCH")).toBe(true));
    const patch = calls.find((c) => c.method === "PATCH")!;
    expect(patch.url).toContain("user_id=eq.u1");
    expect(patch.url).toContain("read_at=is.null");
    expect(patch.url).toContain("archived_at=is.null");
  });
});
