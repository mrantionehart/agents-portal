// ============================================================================
// Static source-guard — training vs production isolation
// ============================================================================
// Pins load-bearing invariants at the source level so a refactor that
// silently violates them fails the suite:
//
//   * Training route + adapters + banner + client page NEVER call the
//     production `/api/transactions/create` or `/api/transactions/[id]/parties`
//     endpoints.
//   * Training code NEVER calls `submitWizard(` directly (only the
//     adapter definition may import it).
//   * Training code NEVER writes to localStorage.
//   * WizardShell.tsx still contains its `handleCreate` call to the
//     injected `submitAdapter` (guards against a refactor that
//     accidentally re-hardcodes submitWizard).
//   * The `banner` render slot in WizardShell is preserved.
// ============================================================================

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const TRAINING_FILES = [
  "src/portal/training/wizard/session-store.ts",
  "src/portal/training/wizard/production-store.ts",
  "src/portal/training/wizard/training-store.ts",
  "src/portal/training/wizard/session-api.ts",
  "src/portal/training/wizard/submit-adapter.ts",
  "src/portal/training/wizard/TrainingBanner.tsx",
  "src/portal/training/wizard/TrainingWizardPage.tsx",
  "app/(portal)/training/wizard/page.tsx",
];

function read(rel: string) {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

/** Return exec-only source (strip block + line comments). */
function readExec(rel: string): string {
  return read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("training source-guard", () => {
  for (const rel of TRAINING_FILES) {
    describe(rel, () => {
      const exec = readExec(rel);

      it("does NOT call /api/transactions/create", () => {
        expect(exec).not.toMatch(/\/api\/transactions\/create/);
      });

      it("does NOT call /api/transactions/[id]/parties", () => {
        expect(exec).not.toMatch(/\/api\/transactions\/[^"'`\s]+\/parties/);
      });

      it("does NOT use localStorage in executable code", () => {
        // production-store.ts intentionally does NOT touch localStorage
        // directly — it goes through wizard-session.ts helpers. If the
        // string appears, it must be inside a comment (which readExec
        // has stripped).
        expect(exec).not.toMatch(/localStorage\./);
        expect(exec).not.toMatch(/window\.localStorage/);
      });

      // Only submit-adapter.ts is allowed to import submitWizard.
      if (!rel.endsWith("submit-adapter.ts")) {
        it("does NOT import or call submitWizard directly", () => {
          expect(exec).not.toMatch(/\bsubmitWizard\b/);
        });
      }
    });
  }
});

describe("WizardShell integration guard", () => {
  const rel = "src/portal/workspace/new/WizardShell.tsx";
  const src = read(rel);
  const exec = readExec(rel);

  it("still passes to the injected submitAdapter (not a hardcoded submitWizard)", () => {
    expect(exec).toMatch(/submitAdapter\(wiz\.session,/);
    // submitWizard is imported ONLY in submit-orchestrator.ts and
    // re-exposed through submit-adapter.ts; WizardShell never calls it
    // directly.
    expect(exec).not.toMatch(/\bsubmitWizard\(/);
  });

  it("exposes optional banner prop", () => {
    expect(src).toMatch(/banner\?:\s*ReactNode/);
    expect(src).toMatch(/\{banner\}/);
  });

  it("exposes optional wizardConfig prop plumbed to useWizardSession", () => {
    expect(src).toMatch(/wizardConfig\?:\s*UseWizardSessionConfig/);
    expect(src).toMatch(/useWizardSession\(wizardConfig\)/);
  });

  it("still defaults to productionSubmitAdapter when no adapter injected", () => {
    expect(src).toMatch(/submitAdapter = productionSubmitAdapter/);
  });
});
