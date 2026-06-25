/**
 * @jest-environment node
 */
// ============================================================================
// AGENT PORTAL 2.1 — R5 — Training Hub helpers + boundary lint
// ============================================================================

import { RESOURCE_CATALOG, SCRIPT_CATALOG } from "../catalogs";
import {
  applyHubFilters,
  deriveModuleProgress,
  hubCounts,
  modulesToHubItems,
  pickContinueWatching,
  progressLabel,
  tabLabel,
} from "../helpers";
import type {
  HubItem,
  TrainingModuleRow,
  TrainingVideoProgressRow,
  TrainingVideoRow,
} from "../types";

const M = (over: Partial<TrainingModuleRow> = {}): TrainingModuleRow => ({
  id: "m1",
  volume: 1,
  module_num: 1,
  title_en: "Buyer Discovery",
  sort_order: 1,
  ...over,
});

const V = (over: Partial<TrainingVideoRow> = {}): TrainingVideoRow => ({
  id: "v1",
  module_id: "m1",
  duration_en_sec: 300,
  sort_order: 1,
  ...over,
});

const P = (over: Partial<TrainingVideoProgressRow> = {}): TrainingVideoProgressRow => ({
  video_id: "v1",
  watched_seconds: 300,
  completed: true,
  ...over,
});

describe("deriveModuleProgress", () => {
  it("computes per-module pct + completion", () => {
    const videos: TrainingVideoRow[] = [
      V({ id: "v1", module_id: "m1" }),
      V({ id: "v2", module_id: "m1" }),
      V({ id: "v3", module_id: "m1" }),
      V({ id: "v4", module_id: "m2" }),
      V({ id: "v5", module_id: "m2" }),
    ];
    const progress: TrainingVideoProgressRow[] = [
      P({ video_id: "v1" }),
      P({ video_id: "v2" }),
      P({ video_id: "v4", completed: false }), // started but not done
      P({ video_id: "v5" }),
    ];
    const out = deriveModuleProgress(videos, progress);
    expect(out.get("m1")).toEqual({
      module_id: "m1",
      total_videos: 3,
      completed_videos: 2,
      progress_pct: 67,
      completed: false,
    });
    expect(out.get("m2")).toEqual({
      module_id: "m2",
      total_videos: 2,
      completed_videos: 1,
      progress_pct: 50,
      completed: false,
    });
  });
  it("100% completion → completed=true", () => {
    const videos = [V({ id: "v1" })];
    const progress = [P({ video_id: "v1", completed: true })];
    const out = deriveModuleProgress(videos, progress);
    expect(out.get("m1")?.completed).toBe(true);
    expect(out.get("m1")?.progress_pct).toBe(100);
  });
  it("zero videos → pct 0, completed=false", () => {
    const out = deriveModuleProgress([], []);
    expect(out.size).toBe(0);
  });
  it("ignores progress for unknown video_ids", () => {
    const out = deriveModuleProgress(
      [V({ id: "v1", module_id: "m1" })],
      [P({ video_id: "v999" })]
    );
    expect(out.get("m1")?.completed_videos).toBe(0);
  });
});

describe("modulesToHubItems", () => {
  it("emits one item per module + carries progress", () => {
    const modules = [M({ id: "m1", title_en: "Discovery", volume: 1, module_num: 1, sort_order: 1 })];
    const progress = deriveModuleProgress(
      [V({ id: "v1", module_id: "m1" })],
      [P({ video_id: "v1" })]
    );
    const items = modulesToHubItems(modules, progress);
    expect(items.length).toBe(1);
    expect(items[0]).toMatchObject({
      tab: "training",
      title: "Discovery",
      category: "Volume 1",
      progress_pct: 100,
      completed: true,
    });
    expect(items[0].open_url).toBe("/training-legacy#module-m1");
  });
  it("preserves sort_order even when input is shuffled", () => {
    const modules = [
      M({ id: "m3", sort_order: 3, title_en: "C" }),
      M({ id: "m1", sort_order: 1, title_en: "A" }),
      M({ id: "m2", sort_order: 2, title_en: "B" }),
    ];
    const items = modulesToHubItems(modules, new Map());
    expect(items.map((i) => i.title)).toEqual(["A", "B", "C"]);
  });
});

describe("pickContinueWatching", () => {
  function tr(over: Partial<HubItem> = {}): HubItem {
    return {
      id: "training/module/m1",
      tab: "training",
      title: "Test",
      category: "Volume 1",
      description: null,
      open_url: "/training-legacy#module-m1",
      progress_pct: 50,
      completed: false,
      ...over,
    };
  }
  it("picks the highest-progress in-progress module", () => {
    const items = [tr({ progress_pct: 30 }), tr({ progress_pct: 70, title: "Closer" }), tr({ progress_pct: 50 })];
    const cw = pickContinueWatching(items);
    expect(cw?.title).toBe("Closer");
    expect(cw?.progress_pct).toBe(70);
  });
  it("excludes 0% (not started)", () => {
    const items = [tr({ progress_pct: 0 })];
    expect(pickContinueWatching(items)).toBeNull();
  });
  it("excludes 100% (complete)", () => {
    const items = [tr({ progress_pct: 100, completed: true })];
    expect(pickContinueWatching(items)).toBeNull();
  });
  it("empty → null", () => {
    expect(pickContinueWatching([])).toBeNull();
  });
});

describe("applyHubFilters", () => {
  const everything: HubItem[] = [
    {
      id: "training/m1",
      tab: "training",
      title: "Buyer Discovery",
      category: "Volume 1",
      description: "Discovery calls",
      open_url: "/training-legacy#module-m1",
      progress_pct: 50,
    },
    ...SCRIPT_CATALOG,
    ...RESOURCE_CATALOG,
  ];

  it("tab=training → only training items", () => {
    const out = applyHubFilters(everything, { tab: "training", search: "" });
    expect(out.length).toBe(1);
    expect(out[0].tab).toBe("training");
  });
  it("tab=scripts → only script catalog items", () => {
    const out = applyHubFilters(everything, { tab: "scripts", search: "" });
    expect(out.length).toBe(SCRIPT_CATALOG.length);
    expect(out.every((i) => i.tab === "scripts")).toBe(true);
  });
  it("tab=resources → only resource catalog items", () => {
    const out = applyHubFilters(everything, { tab: "resources", search: "" });
    expect(out.length).toBe(RESOURCE_CATALOG.length);
    expect(out.every((i) => i.tab === "resources")).toBe(true);
  });
  it("tab=null + search → matches across all tabs by title/category/description", () => {
    expect(
      applyHubFilters(everything, { tab: null, search: "buyer" }).length
    ).toBeGreaterThan(0);
    // "buyer" appears in: training module + scripts/buyer
    const titles = applyHubFilters(everything, { tab: null, search: "buyer" }).map((i) => i.title);
    expect(titles).toContain("Buyer Discovery");
    expect(titles).toContain("Buyer scripts");
  });
  it("search no-match → empty", () => {
    expect(applyHubFilters(everything, { tab: null, search: "zzz_nothing" })).toEqual([]);
  });
  it("case-insensitive search", () => {
    expect(
      applyHubFilters(everything, { tab: "scripts", search: "LUXURY" }).length
    ).toBe(1);
  });
  it("search hits description, not just title", () => {
    expect(
      applyHubFilters(everything, { tab: "scripts", search: "cap-rate" }).length
    ).toBe(1);
  });
  it("trims whitespace search", () => {
    expect(
      applyHubFilters(everything, { tab: "scripts", search: "  buyer  " }).length
    ).toBeGreaterThan(0);
  });
});

describe("hubCounts", () => {
  it("counts per tab", () => {
    const c = hubCounts({
      training: [
        {
          id: "a",
          tab: "training",
          title: "A",
          category: "x",
          description: null,
          open_url: "/x",
        } as HubItem,
      ],
      scripts: [...SCRIPT_CATALOG],
      resources: [...RESOURCE_CATALOG],
    });
    expect(c).toEqual({
      training: 1,
      scripts: SCRIPT_CATALOG.length,
      resources: RESOURCE_CATALOG.length,
      total: 1 + SCRIPT_CATALOG.length + RESOURCE_CATALOG.length,
    });
  });
});

describe("labels", () => {
  it("tabLabel", () => {
    expect(tabLabel("training")).toBe("Training");
    expect(tabLabel("scripts")).toBe("Script Library");
    expect(tabLabel("resources")).toBe("Resources");
    expect(tabLabel(null)).toBe("All");
  });
  it("progressLabel", () => {
    expect(progressLabel(undefined, undefined)).toBe("—");
    expect(progressLabel(0, false)).toBe("Not Started");
    expect(progressLabel(50, false)).toBe("50%");
    expect(progressLabel(100, true)).toBe("Completed");
    expect(progressLabel(undefined, true)).toBe("Completed");
  });
});

describe("Static catalogs", () => {
  it("Script catalog has the 7 categories the R5 brief lists", () => {
    expect(SCRIPT_CATALOG.length).toBe(7);
    const titles = SCRIPT_CATALOG.map((c) => c.title);
    expect(titles).toEqual(
      expect.arrayContaining([
        "Buyer scripts",
        "Seller scripts",
        "Listing scripts",
        "Investor scripts",
        "Luxury scripts",
        "Objection handling",
        "Appointment setting",
      ])
    );
  });
  it("Resource catalog has the 6 categories the R5 brief lists", () => {
    expect(RESOURCE_CATALOG.length).toBe(6);
    const titles = RESOURCE_CATALOG.map((c) => c.title);
    expect(titles).toEqual(
      expect.arrayContaining([
        "PDFs",
        "Manuals",
        "Downloads",
        "Checklists",
        "Brokerage documents",
        "Marketing resources that actually work",
      ])
    );
  });
  it("every script entry deep-links to /scripts", () => {
    for (const e of SCRIPT_CATALOG) {
      expect(e.open_url.startsWith("/scripts")).toBe(true);
    }
  });
  it("every resource entry deep-links to /resources", () => {
    for (const e of RESOURCE_CATALOG) {
      expect(e.open_url.startsWith("/resources")).toBe(true);
    }
  });
});

describe("R5 boundary lint — read-only, no writes, no uploads, no AI", () => {
  it("loader is server-only + no writes", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/portal/training/loader.ts"),
      "utf-8"
    );
    expect(src).toMatch(/import\s+["']server-only["']/);
    expect(src).not.toMatch(/\.from\([^)]+\)[\s\S]*?\.insert\(/);
    expect(src).not.toMatch(/\.from\([^)]+\)[\s\S]*?\.update\(/);
    expect(src).not.toMatch(/\.from\([^)]+\)[\s\S]*?\.upsert\(/);
    expect(src).not.toMatch(/\.from\([^)]+\)[\s\S]*?\.delete\(/);
    expect(src).not.toMatch(/\.rpc\(['"]/);
    expect(src).not.toMatch(/method:\s*['"](POST|PUT|PATCH|DELETE)['"]/);
  });

  it("TrainingHubClient + page are read-only", async () => {
    const fs = await import("fs");
    const path = await import("path");
    for (const f of [
      "src/portal/training/TrainingHubClient.tsx",
      "src/portal/training/helpers.ts",
      "src/portal/training/types.ts",
      "src/portal/training/catalogs.ts",
      "app/(portal)/training/page.tsx",
    ]) {
      const src = fs.readFileSync(path.join(process.cwd(), f), "utf-8");
      expect(src).not.toMatch(/\.from\([^)]+\)[\s\S]*?\.insert\(/);
      expect(src).not.toMatch(/\.from\([^)]+\)[\s\S]*?\.update\(/);
      expect(src).not.toMatch(/\.from\([^)]+\)[\s\S]*?\.upsert\(/);
      expect(src).not.toMatch(/\.from\([^)]+\)[\s\S]*?\.delete\(/);
      expect(src).not.toMatch(/\.rpc\(['"]/);
      expect(src).not.toMatch(/method:\s*['"](POST|PUT|PATCH|DELETE)['"]/);
    }
  });

  it("no upload, no editing, no AI generation surfaces in the hub", async () => {
    const fs = await import("fs");
    const path = await import("path");
    for (const f of [
      "src/portal/training/TrainingHubClient.tsx",
      "src/portal/training/loader.ts",
      "src/portal/training/helpers.ts",
      "app/(portal)/training/page.tsx",
    ]) {
      const src = fs.readFileSync(path.join(process.cwd(), f), "utf-8");
      // Strip top comment to avoid false positives on the descriptive
      // "No new AI generation" line in the file headers.
      const codeOnly = src.replace(/^\/\/[\s\S]*?(?=\n[a-zA-Z])/, "");
      expect(codeOnly).not.toMatch(/<input\s+type=["']file["']/i);
      expect(codeOnly).not.toMatch(/FormData\(/);
      expect(codeOnly).not.toMatch(/handleUpload|onUpload|handleSave|handleEdit/i);
      expect(codeOnly).not.toMatch(/contentEditable/);
      expect(codeOnly).not.toMatch(
        /openai|claude\.ai|anthropic|gpt-4|generate-text|completions/i
      );
    }
  });

  it("no email/SMS/push send anywhere in R5 surfaces", async () => {
    const fs = await import("fs");
    const path = await import("path");
    for (const f of [
      "src/portal/training/TrainingHubClient.tsx",
      "src/portal/training/loader.ts",
      "src/portal/training/helpers.ts",
      "src/portal/training/catalogs.ts",
      "app/(portal)/training/page.tsx",
    ]) {
      const src = fs.readFileSync(path.join(process.cwd(), f), "utf-8");
      expect(src).not.toMatch(/sendgrid|twilio|onesignal|firebase\/messaging|resend|mailgun/i);
    }
  });

  it("hub deep-links target the existing legacy surfaces (no new endpoints)", () => {
    const all: HubItem[] = [
      ...SCRIPT_CATALOG,
      ...RESOURCE_CATALOG,
    ];
    for (const e of all) {
      expect(e.open_url.startsWith("/scripts") || e.open_url.startsWith("/resources")).toBe(true);
    }
  });
});
