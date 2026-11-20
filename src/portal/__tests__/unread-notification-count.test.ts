// LEAD-DISPO-QA — the unread-count query behind the TopBar bell.
import * as fs from "fs";
import * as path from "path";
jest.mock("@/lib/supabase", () => ({ getAccessToken: async () => "tok" }));
import { fetchUnreadCount, parseContentRangeTotal } from "../useUnreadNotificationCount";

describe("[LEAD-DISPO-QA] unread count query", () => {
  it("asks only for the caller's unread, unarchived rows, count only", async () => {
    const f = jest.fn(async () => ({ ok: true, status: 206, headers: { get: () => "0-0/25" } }) as unknown as Response);
    expect(await fetchUnreadCount("u1", f as unknown as typeof fetch)).toBe(25);
    const [url, init] = (f.mock.calls[0] as unknown) as [string, RequestInit];
    expect(url).toContain("user_id=eq.u1");
    expect(url).toContain("read_at=is.null");
    expect(url).toContain("archived_at=is.null");
    expect(init.method).toBe("HEAD");
    expect((init.headers as Record<string, string>).Prefer).toBe("count=exact");
  });
  it("any failure is null, never zero", async () => {
    expect(await fetchUnreadCount("u1", (async () => ({ ok: false, status: 401, headers: { get: () => null } })) as unknown as typeof fetch)).toBeNull();
    expect(await fetchUnreadCount("u1", (async () => { throw new Error("x"); }) as unknown as typeof fetch)).toBeNull();
    expect(parseContentRangeTotal("*/0")).toBe(0);
    expect(parseContentRangeTotal(null)).toBeNull();
  });
  it("every class the badge uses is generated (TopBar.tsx is not in tailwind content)", () => {
    const top = fs.readFileSync(path.resolve(__dirname, "../TopBar.tsx"), "utf8");
    const badge = top.match(/data-testid="topbar-unread" className="([^"]+)"/)![1].split(/\s+/);
    const read = (d: string): string => fs.readdirSync(d, { withFileTypes: true }).map((e) => e.isDirectory() ? (e.name === "node_modules" ? "" : read(path.join(d, e.name))) : /\.(tsx?|jsx?)$/.test(e.name) ? fs.readFileSync(path.join(d, e.name), "utf8") : "").join("\n");
    const app = read(path.resolve(__dirname, "../../../app"));
    const missing = badge.filter((c) => !new RegExp(`(^|[\\s"'\`])${c.replace(/[[\]#.]/g, "\\$&")}($|[\\s"'\`])`, "m").test(app));
    expect(missing).toEqual([]);
  });
});
