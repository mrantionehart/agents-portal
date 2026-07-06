/**
 * @jest-environment node
 */
// ============================================================================
// TRANSACTION OS 3.3B.3A — wizard step-config tests (pure)
// ============================================================================

import {
  WIZARD_STEPS,
  NAVIGABLE_STEPS,
  DEFAULT_STEP,
  isValidStep,
  parseStep,
  stepIndex,
  nextStep,
  prevStep,
  stepHref,
  stepPositionLabel,
  type StepId,
} from "../wizard-steps";

describe("WIZARD_STEPS journey", () => {
  it("has the 7 nodes in fixed order", () => {
    expect(WIZARD_STEPS.map((s) => s.id)).toEqual([
      "type",
      "property",
      "parties",
      "dates",
      "review",
      "create",
      "package",
    ]);
  });

  it("marks the first six navigable and package terminal", () => {
    expect(NAVIGABLE_STEPS).toEqual([
      "type",
      "property",
      "parties",
      "dates",
      "review",
      "create",
    ]);
    expect(WIZARD_STEPS.find((s) => s.id === "package")!.navigable).toBe(false);
  });

  it("DEFAULT_STEP is the first step", () => {
    expect(DEFAULT_STEP).toBe("type");
  });
});

describe("isValidStep / parseStep", () => {
  it("accepts navigable steps only", () => {
    for (const id of NAVIGABLE_STEPS) expect(isValidStep(id)).toBe(true);
  });
  it("rejects the terminal, unknown, null and empty values", () => {
    for (const raw of ["package", "nonsense", "", null, undefined]) {
      expect(isValidStep(raw)).toBe(false);
      expect(parseStep(raw)).toBe(DEFAULT_STEP);
    }
  });
  it("parseStep passes valid steps through", () => {
    expect(parseStep("dates")).toBe("dates");
  });
});

describe("stepIndex / next / prev", () => {
  it("indexes navigable steps; terminal is -1", () => {
    expect(stepIndex("type")).toBe(0);
    expect(stepIndex("create")).toBe(5);
    expect(stepIndex("package")).toBe(-1);
  });
  it("nextStep walks forward and stops at the last navigable step", () => {
    expect(nextStep("type")).toBe("property");
    expect(nextStep("dates")).toBe("review");
    expect(nextStep("create")).toBeNull();
    expect(nextStep("package")).toBeNull();
  });
  it("prevStep walks back and stops at the first step", () => {
    expect(prevStep("property")).toBe("type");
    expect(prevStep("type")).toBeNull();
    expect(prevStep("package")).toBeNull();
  });
});

describe("stepHref", () => {
  it("omits the param for the default step, sets it otherwise", () => {
    expect(stepHref("type")).toBe("/workspace/new");
    expect(stepHref("parties")).toBe("/workspace/new?step=parties");
    expect(stepHref("create")).toBe("/workspace/new?step=create");
  });
});

describe("stepPositionLabel", () => {
  it("is 1-of-6 based over the navigable steps", () => {
    expect(stepPositionLabel("type")).toBe("Step 1 of 6");
    expect(stepPositionLabel("create")).toBe("Step 6 of 6");
  });
  it("is empty for the terminal node", () => {
    expect(stepPositionLabel("package" as StepId)).toBe("");
  });
});
