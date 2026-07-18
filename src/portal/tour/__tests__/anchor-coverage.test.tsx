// ============================================================================
// AP2 tour — anchor coverage
// ============================================================================
// Two layers:
//   1. RENDERED coverage — Sidebar (client component) is rendered in
//      jsdom and each nav anchor is queried from the actual DOM tree.
//      This is the strong-form guarantee for the five nav anchors.
//
//   2. STATIC coverage — the three page-level anchors (home dashboard,
//      notifications inbox, settings profile) sit inside server
//      components that carry heavy external deps and cannot be rendered
//      here without an extensive mock harness. For those, we read the
//      shipped page files directly and assert that the exact
//      `data-training-id="…"` attribute is present. This is not a
//      superficial substring scan — it targets the specific attribute
//      that the tour engine queries, in the file the shell renders.
//      A future PR that strips or renames the attribute will fail here.
//
// Scope note (Remaining Tour Authoring phase):
//   Track 3 (pcert-l11..l15) reuses the Track 2 workspace anchors
//   verbatim; Track 4 (pcert-l16..l22) introduces zero anchors because
//   EASE runs outside the browser tour engine. No new coverage checks
//   are required for either track — this file already covers everything
//   in the allowlist.
// ============================================================================

import { render } from "@testing-library/react";
import * as fs from "node:fs";
import * as path from "node:path";
import Sidebar from "../../Sidebar";
import { TRAINING_ANCHORS } from "../anchors";

// Next.js hooks used by Sidebar — stub for jsdom.
jest.mock("next/navigation", () => ({
  usePathname: () => "/home",
}));
jest.mock("next/link", () => {
  function MockLink({
    children,
    href,
    ...rest
  }: React.PropsWithChildren<{ href: string } & Record<string, unknown>>) {
    // eslint-disable-next-line jsx-a11y/anchor-has-content
    return (
      <a href={href} {...(rest as Record<string, unknown>)}>
        {children}
      </a>
    );
  }
  return { __esModule: true, default: MockLink };
});

const REPO_ROOT = path.join(__dirname, "..", "..", "..", "..");

function readShipped(rel: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, rel), "utf-8");
}

// ─── 1. Rendered coverage (Sidebar) ─────────────────────────────────────────

function q(container: HTMLElement, id: string) {
  return container.querySelector(`[data-training-id="${id}"]`);
}

describe("anchor coverage — Sidebar (rendered)", () => {
  it("<aside> carries portal.navigation.sidebar", () => {
    const { container } = render(<Sidebar role="agent" open={true} />);
    const el = q(container, TRAINING_ANCHORS.navSidebar);
    expect(el?.tagName.toLowerCase()).toBe("aside");
  });

  it("Home nav row carries portal.navigation.home", () => {
    const { container } = render(<Sidebar role="agent" open={true} />);
    const el = q(container, TRAINING_ANCHORS.navHome);
    expect(el).not.toBeNull();
    expect(el?.getAttribute("href")).toBe("/home");
  });

  it("Transactions nav row carries portal.navigation.workspace", () => {
    const { container } = render(<Sidebar role="agent" open={true} />);
    const el = q(container, TRAINING_ANCHORS.navWorkspace);
    expect(el).not.toBeNull();
    expect(el?.getAttribute("href")).toBe("/workspace");
  });

  it("Notifications nav row carries portal.navigation.notifications", () => {
    const { container } = render(<Sidebar role="agent" open={true} />);
    const el = q(container, TRAINING_ANCHORS.navNotifications);
    expect(el).not.toBeNull();
    expect(el?.getAttribute("href")).toBe("/notifications");
  });

  it("Settings nav row carries portal.navigation.settings", () => {
    const { container } = render(<Sidebar role="agent" open={true} />);
    const el = q(container, TRAINING_ANCHORS.navSettings);
    expect(el).not.toBeNull();
    expect(el?.getAttribute("href")).toBe("/settings");
  });

  it("does NOT stamp any tour anchor on unlisted nav rows (ai/calendar/training/library/clients)", () => {
    const { container } = render(<Sidebar role="agent" open={true} />);
    const anchors = Array.from(
      container.querySelectorAll("[data-training-id]"),
    );
    const trainingIds = anchors.map((el) => el.getAttribute("data-training-id"));
    const ALLOWED = [
      TRAINING_ANCHORS.navSidebar,
      TRAINING_ANCHORS.navHome,
      TRAINING_ANCHORS.navWorkspace,
      TRAINING_ANCHORS.navNotifications,
      TRAINING_ANCHORS.navSettings,
    ] as string[];
    for (const id of trainingIds) {
      if (id != null) {
        expect(ALLOWED).toContain(id);
      }
    }
  });
});

// ─── 2. Static coverage (page-level anchors on server components) ───────────

describe("anchor coverage — page-level anchors (static)", () => {
  it("home page renders portal.home.dashboard on the shell wrapper div", () => {
    const src = readShipped("app/(portal)/home/page.tsx");
    expect(src).toMatch(
      /<div data-training-id="portal\.home\.dashboard">/,
    );
  });

  it("notifications page renders portal.notifications.inbox on the root div", () => {
    const src = readShipped("app/(portal)/notifications/page.tsx");
    expect(src).toMatch(
      /<div data-training-id="portal\.notifications\.inbox">/,
    );
  });

  it("settings page wraps the Profile card in portal.settings.profile", () => {
    const src = readShipped("app/(portal)/settings/page.tsx");
    expect(src).toMatch(
      /<div data-training-id="portal\.settings\.profile">\s*\n?\s*<Card title="Profile"/,
    );
  });

  it("no ADDITIONAL page anchors have been planted outside the allowlist", () => {
    // Guardrail: scan the three pages and confirm the only data-training-id
    // values are from the allowlist. A rogue anchor would be caught here.
    const pages = [
      "app/(portal)/home/page.tsx",
      "app/(portal)/notifications/page.tsx",
      "app/(portal)/settings/page.tsx",
    ];
    for (const p of pages) {
      const src = readShipped(p);
      const matches =
        src.match(/data-training-id="([^"]+)"/g) ?? [];
      for (const m of matches) {
        const val = m.slice('data-training-id="'.length, -1);
        expect(Object.values(TRAINING_ANCHORS)).toContain(val);
      }
    }
  });
});
