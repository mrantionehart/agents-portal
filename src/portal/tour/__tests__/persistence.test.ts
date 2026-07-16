// ============================================================================
// AP2 tour — persistence separation
// ============================================================================
// Learner uses localStorage; preview uses sessionStorage. The two must
// never see each other's data, share prefixes, or leak keys.
// ============================================================================

import {
  clearAllLearnerResumeForUser,
  clearLearnerResume,
  readLearnerResume,
  writeLearnerResume,
} from "../persistence-learner";
import {
  clearPreviewState,
  readPreviewState,
  writePreviewState,
} from "../persistence-preview";

const USER_A = "11111111-2222-3333-4444-aaaabbbbcccc";
const SCRIPT = "portal.foundations.dashboard";
const V1 = "1.0.0";
const V2 = "1.1.0";

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe("learner persistence", () => {
  it("round-trips a state entry", () => {
    writeLearnerResume(USER_A, SCRIPT, V1, {
      currentStepId: "dashboard-sidebar",
      stepsCompleted: ["dashboard-intro"],
      updatedAt: "2026-07-16T00:00:00.000Z",
    });
    const back = readLearnerResume(USER_A, SCRIPT, V1);
    expect(back?.currentStepId).toBe("dashboard-sidebar");
    expect(back?.stepsCompleted).toEqual(["dashboard-intro"]);
  });

  it("invalidates on script version mismatch (returns null)", () => {
    writeLearnerResume(USER_A, SCRIPT, V1, {
      currentStepId: "dashboard-sidebar",
      stepsCompleted: [],
      updatedAt: "2026-07-16T00:00:00.000Z",
    });
    expect(readLearnerResume(USER_A, SCRIPT, V2)).toBeNull();
  });

  it("clearLearnerResume removes only the matched key", () => {
    writeLearnerResume(USER_A, SCRIPT, V1, {
      currentStepId: "a",
      stepsCompleted: [],
      updatedAt: "2026-07-16T00:00:00.000Z",
    });
    writeLearnerResume(USER_A, "other.script", V1, {
      currentStepId: "b",
      stepsCompleted: [],
      updatedAt: "2026-07-16T00:00:00.000Z",
    });
    clearLearnerResume(USER_A, SCRIPT, V1);
    expect(readLearnerResume(USER_A, SCRIPT, V1)).toBeNull();
    expect(readLearnerResume(USER_A, "other.script", V1)).not.toBeNull();
  });

  it("clearAllLearnerResumeForUser removes only that user's keys", () => {
    writeLearnerResume(USER_A, SCRIPT, V1, {
      currentStepId: "a",
      stepsCompleted: [],
      updatedAt: "2026-07-16T00:00:00.000Z",
    });
    const otherUser = "99999999-8888-7777-6666-555544443333";
    writeLearnerResume(otherUser, SCRIPT, V1, {
      currentStepId: "b",
      stepsCompleted: [],
      updatedAt: "2026-07-16T00:00:00.000Z",
    });
    clearAllLearnerResumeForUser(USER_A);
    expect(readLearnerResume(USER_A, SCRIPT, V1)).toBeNull();
    expect(readLearnerResume(otherUser, SCRIPT, V1)).not.toBeNull();
  });

  it("does NOT put email, tenant, or full uuid in the storage key", () => {
    writeLearnerResume(USER_A, SCRIPT, V1, {
      currentStepId: "a",
      stepsCompleted: [],
      updatedAt: "2026-07-16T00:00:00.000Z",
    });
    // Inspect all localStorage keys — no email, no tenant, no full user id.
    let inspected = 0;
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i)!;
      expect(k).not.toContain("@"); // no email
      expect(k).not.toContain(USER_A); // no full uuid
      inspected++;
    }
    expect(inspected).toBeGreaterThan(0);
  });
});

describe("preview persistence", () => {
  it("round-trips a state entry via sessionStorage", () => {
    writePreviewState(SCRIPT, V1, {
      currentStepId: "dashboard-recap",
      updatedAt: "2026-07-16T00:00:00.000Z",
    });
    // Learner MUST NOT see it.
    expect(readLearnerResume(USER_A, SCRIPT, V1)).toBeNull();
    // Preview MUST see it.
    expect(readPreviewState(SCRIPT, V1)?.currentStepId).toBe("dashboard-recap");
  });

  it("clearPreviewState leaves learner data untouched", () => {
    writeLearnerResume(USER_A, SCRIPT, V1, {
      currentStepId: "learner-step",
      stepsCompleted: [],
      updatedAt: "2026-07-16T00:00:00.000Z",
    });
    writePreviewState(SCRIPT, V1, {
      currentStepId: "preview-step",
      updatedAt: "2026-07-16T00:00:00.000Z",
    });
    clearPreviewState(SCRIPT, V1);
    expect(readPreviewState(SCRIPT, V1)).toBeNull();
    expect(readLearnerResume(USER_A, SCRIPT, V1)?.currentStepId).toBe(
      "learner-step",
    );
  });

  it("preview version mismatch returns null", () => {
    writePreviewState(SCRIPT, V1, {
      currentStepId: "a",
      updatedAt: "2026-07-16T00:00:00.000Z",
    });
    expect(readPreviewState(SCRIPT, V2)).toBeNull();
  });
});

describe("separation of storage backends", () => {
  it("learner writes never appear in sessionStorage", () => {
    writeLearnerResume(USER_A, SCRIPT, V1, {
      currentStepId: "a",
      stepsCompleted: [],
      updatedAt: "2026-07-16T00:00:00.000Z",
    });
    expect(window.sessionStorage.length).toBe(0);
  });

  it("preview writes never appear in localStorage", () => {
    writePreviewState(SCRIPT, V1, {
      currentStepId: "a",
      updatedAt: "2026-07-16T00:00:00.000Z",
    });
    expect(window.localStorage.length).toBe(0);
  });
});
