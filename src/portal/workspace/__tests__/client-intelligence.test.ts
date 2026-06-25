/**
 * @jest-environment node
 */
// ============================================================================
// AGENT PORTAL 2.0 — AP2.1D — Client Intelligence helper tests
// ============================================================================

import { channelLabel, formatBudgetRange, temperatureLabel } from "../client-intelligence";

describe("formatBudgetRange", () => {
  it("null + null → null", () => {
    expect(formatBudgetRange(null, null)).toBeNull();
  });
  it("min only → '$Xk+' or '$X.YM+'", () => {
    expect(formatBudgetRange(500_000, null)).toBe("$500K+");
    expect(formatBudgetRange(1_500_000, null)).toBe("$1.5M+");
  });
  it("max only → 'Up to …'", () => {
    expect(formatBudgetRange(null, 900_000)).toBe("Up to $900K");
  });
  it("both → range", () => {
    expect(formatBudgetRange(750_000, 1_250_000)).toBe("$750K – $1.3M");
  });
});

describe("temperatureLabel", () => {
  it("hot / warm / cold map correctly", () => {
    expect(temperatureLabel("hot")).toBe("Hot");
    expect(temperatureLabel("warm")).toBe("Warm");
    expect(temperatureLabel("cold")).toBe("Cold");
  });
  it("null / unknown → em-dash", () => {
    expect(temperatureLabel(null)).toBe("—");
    expect(temperatureLabel("magma")).toBe("—");
  });
});

describe("channelLabel", () => {
  it("maps the documented channel ids", () => {
    expect(channelLabel("phone")).toBe("Phone");
    expect(channelLabel("email")).toBe("Email");
    expect(channelLabel("text")).toBe("Text");
    expect(channelLabel("sms")).toBe("Text (SMS)");
    expect(channelLabel("in_person")).toBe("In person");
  });
  it("null → em-dash, unknown → passthrough", () => {
    expect(channelLabel(null)).toBe("—");
    expect(channelLabel("carrier_pigeon")).toBe("carrier_pigeon");
  });
});

describe("AP2.1D boundary lint — no writes / no new tools / no migrations", () => {
  it("CI helper + panel + page integration contain no write surface", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const files = [
      "src/portal/workspace/client-intelligence.ts",
      "src/portal/workspace/ClientIntelligencePanel.tsx",
      "app/(portal)/workspace/[transactionId]/page.tsx",
    ];
    for (const f of files) {
      const src = fs.readFileSync(path.join(process.cwd(), f), "utf-8");
      // No DB write methods on supabase calls in the CI surface
      // (the AI panel POSTs to /ai/chat — that's the only exception
      // and lives in a separate file, AIAssistantPanel.tsx).
      if (!f.endsWith("page.tsx")) {
        expect(src).not.toMatch(/method:\s*['"]POST['"]/);
      }
      expect(src.includes(".insert(")).toBe(false);
      expect(src.includes(".update(")).toBe(false);
      expect(src.includes(".delete(")).toBe(false);
      expect(src.includes(".upsert(")).toBe(false);
      expect(src.includes(".rpc(")).toBe(false);
      // No paperwork-engine imports
      expect(src).not.toMatch(/from\s+['"][^'"]*paperwork[^'"]*['"]/);
      // No new AI tool symbols
      expect(src).not.toMatch(/REQUEST_PARTY_ATTESTATION_TOOL|UPDATE_TRANSACTION_FIELD_TOOL|GET_TRANSACTION_PAPERWORK_STATE_TOOL/);
      // No DocuSign / envelope-send imports
      expect(src).not.toMatch(/from\s+['"][^'"]*docusign[^'"]*['"]/i);
      expect(src).not.toMatch(/sendEnvelopeFor|issuePortalToken/);
    }
  });

  it("server-only marker present in CI helper", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/portal/workspace/client-intelligence.ts"),
      "utf-8"
    );
    expect(src).toMatch(/import\s+["']server-only["']/);
  });

  it("page still calls only Vault + Supabase reads — no new Portal API routes", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.join(process.cwd(), "app/(portal)/workspace/[transactionId]/page.tsx"),
      "utf-8"
    );
    // The page may POST through the AI panel (client component imports
    // its own POST). The page itself must contain no POST verbs.
    expect(src).not.toMatch(/method:\s*['"]POST['"]/);
    // No fetch calls to /api/portal/* (would indicate a new Portal API
    // route being introduced).
    expect(src).not.toMatch(/fetch\(\s*['"]\/api\/portal/);
  });
});
