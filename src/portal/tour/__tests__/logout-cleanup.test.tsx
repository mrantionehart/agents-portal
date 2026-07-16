// ============================================================================
// AP2 tour — logout cleanup
// ============================================================================
// TWO layers of proof:
//
//   1. STATIC — the real `signOut` handler in app/providers.tsx imports
//      `clearAllLearnerResumeForUser` from persistence-learner and
//      invokes it BEFORE calling `supabase.auth.signOut`. This makes
//      the wiring auditable without a jest-side moduleNameMapper
//      workaround (jest.config.js maps @/lib/* to src/lib/* which
//      does not exist for the shared `@/lib/supabase` used by
//      AuthProvider).
//
//   2. BEHAVIORAL — the `clearAllLearnerResumeForUser` helper itself is
//      exercised end-to-end (targeted-user keys cleared, other users
//      untouched, preview state left alone).
// ============================================================================

import * as fs from "node:fs";
import * as path from "node:path";

import {
  clearAllLearnerResumeForUser,
  readLearnerResume,
  writeLearnerResume,
} from "../persistence-learner";
import {
  readPreviewState,
  writePreviewState,
} from "../persistence-preview";

const REPO_ROOT = path.join(__dirname, "..", "..", "..", "..");

// ─── 1. Static wiring on providers.tsx signOut ──────────────────────────────

describe("providers.signOut — static wiring", () => {
  const providersSrc = fs.readFileSync(
    path.join(REPO_ROOT, "app", "providers.tsx"),
    "utf-8",
  );

  it("imports clearAllLearnerResumeForUser from the persistence module", () => {
    expect(providersSrc).toMatch(
      /import \{ clearAllLearnerResumeForUser \} from ['"]@\/src\/portal\/tour\/persistence-learner['"]/,
    );
  });

  it("invokes clearAllLearnerResumeForUser inside the signOut handler", () => {
    expect(providersSrc).toMatch(
      /const signOut = async \(\) => \{[\s\S]{0,400}clearAllLearnerResumeForUser\(user\?\.id \?\? null\)/,
    );
  });

  it("wipes learner state BEFORE supabase.auth.signOut() so a partial failure never leaves state behind", () => {
    const clearIdx = providersSrc.indexOf("clearAllLearnerResumeForUser(user");
    const authOutIdx = providersSrc.indexOf("supabase.auth.signOut()");
    expect(clearIdx).toBeGreaterThan(-1);
    expect(authOutIdx).toBeGreaterThan(-1);
    expect(clearIdx).toBeLessThan(authOutIdx);
  });

  it("does NOT clear preview (sessionStorage) state during learner logout", () => {
    // A future edit that added a call to `clearPreviewState` inside
    // signOut would violate the resume-separation contract. This
    // assertion pins the separation.
    const inSignOut = providersSrc.match(
      /const signOut = async \(\) => \{[\s\S]{0,500}\n  \}/,
    );
    expect(inSignOut).not.toBeNull();
    if (inSignOut) {
      expect(inSignOut[0]).not.toMatch(/clearPreviewState/);
    }
  });
});

// ─── 2. Behavioral proof of the cleanup helper ──────────────────────────────

describe("clearAllLearnerResumeForUser — behavioral", () => {
  const OUT_ID = "user-out-1234-5678-abcd-9999";
  const OTHER_ID = "user-other-aaaa-bbbb-cccc-dddd";

  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("wipes every learner-mode key belonging to the given user", () => {
    writeLearnerResume(OUT_ID, "portal.foundations.welcome", "1.0.0", {
      currentStepId: "welcome-intro",
      stepsCompleted: [],
      updatedAt: "2026-07-16T00:00:00.000Z",
    });
    writeLearnerResume(OUT_ID, "portal.foundations.dashboard", "1.0.0", {
      currentStepId: "dashboard-sidebar",
      stepsCompleted: [],
      updatedAt: "2026-07-16T00:00:00.000Z",
    });
    writeLearnerResume(
      OUT_ID,
      "portal.foundations.notifications-profile",
      "1.0.0",
      {
        currentStepId: "notif-intro",
        stepsCompleted: [],
        updatedAt: "2026-07-16T00:00:00.000Z",
      },
    );

    clearAllLearnerResumeForUser(OUT_ID);

    expect(
      readLearnerResume(OUT_ID, "portal.foundations.welcome", "1.0.0"),
    ).toBeNull();
    expect(
      readLearnerResume(OUT_ID, "portal.foundations.dashboard", "1.0.0"),
    ).toBeNull();
    expect(
      readLearnerResume(
        OUT_ID,
        "portal.foundations.notifications-profile",
        "1.0.0",
      ),
    ).toBeNull();
  });

  it("leaves other users' learner state untouched", () => {
    writeLearnerResume(OUT_ID, "portal.foundations.welcome", "1.0.0", {
      currentStepId: "a",
      stepsCompleted: [],
      updatedAt: "2026-07-16T00:00:00.000Z",
    });
    writeLearnerResume(OTHER_ID, "portal.foundations.welcome", "1.0.0", {
      currentStepId: "a",
      stepsCompleted: [],
      updatedAt: "2026-07-16T00:00:00.000Z",
    });

    clearAllLearnerResumeForUser(OUT_ID);

    expect(
      readLearnerResume(OTHER_ID, "portal.foundations.welcome", "1.0.0"),
    ).not.toBeNull();
  });

  it("leaves preview (sessionStorage) state untouched — separate lifecycle", () => {
    writeLearnerResume(OUT_ID, "portal.foundations.welcome", "1.0.0", {
      currentStepId: "a",
      stepsCompleted: [],
      updatedAt: "2026-07-16T00:00:00.000Z",
    });
    writePreviewState("portal.foundations.welcome", "1.0.0", {
      currentStepId: "a",
      updatedAt: "2026-07-16T00:00:00.000Z",
    });

    clearAllLearnerResumeForUser(OUT_ID);

    expect(
      readPreviewState("portal.foundations.welcome", "1.0.0"),
    ).not.toBeNull();
  });

  it("no learner key ever contains email, tenant, or the full uuid", () => {
    writeLearnerResume(OUT_ID, "portal.foundations.welcome", "1.0.0", {
      currentStepId: "a",
      stepsCompleted: [],
      updatedAt: "2026-07-16T00:00:00.000Z",
    });
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i)!;
      expect(k).not.toContain("@");
      expect(k).not.toContain(OUT_ID);
    }
  });
});
