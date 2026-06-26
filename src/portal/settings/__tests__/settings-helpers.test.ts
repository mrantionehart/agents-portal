/**
 * @jest-environment node
 */
// ============================================================================
// AGENT PORTAL 2.1 — R7 — Settings Hub helpers + boundary lint
// ============================================================================

import { displayName, initials, roleLabel } from "../helpers";
import type { SettingsProfile } from "../types";

const P = (over: Partial<SettingsProfile> = {}): SettingsProfile => ({
  full_name: "Bobby Khullar",
  email: "bobby@example.com",
  role: "agent",
  ...over,
});

describe("displayName", () => {
  it("uses full_name when present", () => {
    expect(displayName(P())).toBe("Bobby Khullar");
  });
  it("trims surrounding whitespace", () => {
    expect(displayName(P({ full_name: "  Alice  " }))).toBe("Alice");
  });
  it("falls back to email-local when no name", () => {
    expect(displayName(P({ full_name: null, email: "alice@x.com" }))).toBe("alice");
  });
  it("returns em-dash when nothing on file", () => {
    expect(displayName(P({ full_name: null, email: null }))).toBe("—");
    expect(displayName(P({ full_name: "  ", email: null }))).toBe("—");
  });
});

describe("initials", () => {
  it("two-letter initials for two-word names", () => {
    expect(initials(P({ full_name: "Bobby Khullar" }))).toBe("BK");
  });
  it("single-letter for one-word names", () => {
    expect(initials(P({ full_name: "Madonna" }))).toBe("M");
  });
  it("uses first + last word for 3+ word names", () => {
    expect(initials(P({ full_name: "Anne Marie Carson" }))).toBe("AC");
  });
  it("falls back to ? when no name/email", () => {
    expect(initials(P({ full_name: null, email: null }))).toBe("?");
  });
});

describe("roleLabel", () => {
  it.each([
    ["broker", "Broker"],
    ["admin", "Admin"],
    ["office_manager", "Office Manager"],
    ["agent", "Agent"],
    [null, "Agent"],
    [undefined, "Agent"],
    ["future_role_x", "Future role x"],
  ])("role=%s → %s", (input, expected) => {
    expect(roleLabel(input as string | null)).toBe(expected);
  });
});

describe("R7 boundary lint — read-only, no writes, no new APIs", () => {
  it("Settings page has no Supabase mutation chains", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.join(process.cwd(), "app/(portal)/settings/page.tsx"),
      "utf-8"
    );
    expect(src).not.toMatch(/\.from\([^)]+\)[\s\S]*?\.insert\(/);
    expect(src).not.toMatch(/\.from\([^)]+\)[\s\S]*?\.update\(/);
    expect(src).not.toMatch(/\.from\([^)]+\)[\s\S]*?\.upsert\(/);
    expect(src).not.toMatch(/\.from\([^)]+\)[\s\S]*?\.delete\(/);
    expect(src).not.toMatch(/\.rpc\(['"]/);
    expect(src).not.toMatch(/method:\s*['"](POST|PUT|PATCH|DELETE)['"]/);
  });

  it("Settings page has no inline edit / save / submit affordances", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.join(process.cwd(), "app/(portal)/settings/page.tsx"),
      "utf-8"
    );
    expect(src).not.toMatch(/<form/i);
    expect(src).not.toMatch(/<input/i);
    expect(src).not.toMatch(/<textarea/i);
    expect(src).not.toMatch(/<select/i);
    expect(src).not.toMatch(/<button[\s\S]*?onClick=/);
    expect(src).not.toMatch(
      /\b(handleSave|handleUpdate|onSubmit|handleSubmit|handleEdit|onSave)\b/i
    );
    expect(src).not.toMatch(/contentEditable/);
    expect(src).not.toMatch(/FormData\(/);
  });

  it("Settings page links ONLY to existing routes / mailto", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.join(process.cwd(), "app/(portal)/settings/page.tsx"),
      "utf-8"
    );
    const hrefs = [...src.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    // Allowlist: existing routes referenced in the R7 brief.
    const ALLOWED = new Set<string | RegExp>([
      "/profile",
      "/business-card",
      "/commissions",
      "/commission-calculator",
      "/crm/settings",
      "/notifications",
      "/training",
      "/training?tab=resources",
      /^mailto:/,
    ]);
    for (const h of hrefs) {
      const ok = [...ALLOWED].some((entry) =>
        typeof entry === "string" ? entry === h : entry.test(h)
      );
      expect(ok).toBe(true);
    }
    // Sanity — at least 8 hrefs ship (each card has at least one link;
    // some have multiple SubLinks).
    expect(hrefs.length).toBeGreaterThanOrEqual(8);
  });

  it("placeholder 'Settings UI is coming soon' copy is removed", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.join(process.cwd(), "app/(portal)/settings/page.tsx"),
      "utf-8"
    );
    expect(src).not.toMatch(/Settings UI is coming soon/i);
    expect(src).not.toMatch(/coming soon/i);
  });

  it("no email/SMS/push/realtime send infra anywhere in R7 surfaces", async () => {
    const fs = await import("fs");
    const path = await import("path");
    for (const f of [
      "app/(portal)/settings/page.tsx",
      "src/portal/settings/helpers.ts",
      "src/portal/settings/types.ts",
    ]) {
      const src = fs.readFileSync(path.join(process.cwd(), f), "utf-8");
      expect(src).not.toMatch(/sendgrid|twilio|onesignal|firebase\/messaging|resend|mailgun/i);
      expect(src).not.toMatch(/\.channel\(|onPostgresChanges|subscribe\(/);
    }
  });

  it("renders the 6 documented cards (R7 brief)", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.join(process.cwd(), "app/(portal)/settings/page.tsx"),
      "utf-8"
    );
    const required = [
      'title="Profile"',
      'title="Business Card"',
      'title="Earnings"',
      'title="CRM / Email Sync"',
      'title="Notifications"',
      'title="Support / Broker"',
    ];
    for (const t of required) {
      expect(src.includes(t)).toBe(true);
    }
  });
});
