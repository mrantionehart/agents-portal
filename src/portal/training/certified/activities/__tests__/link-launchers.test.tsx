// ============================================================================
// V4 UNIFIED LEARNER EXPERIENCE — Link-launcher behavioral tests
// ============================================================================
// WizardLaunchLink, ChecklistLauncher, QuizLauncher are pure link generators.
// These tests lock the exact query strings + fail-closed activity_type checks.
// ============================================================================

import { render, screen } from "@testing-library/react";

import ChecklistLauncher from "../ChecklistLauncher";
import QuizLauncher from "../QuizLauncher";
import WizardLaunchLink from "../WizardLaunchLink";
import type { LessonSessionUiSpec } from "../../types";

const wizardSpec: LessonSessionUiSpec = {
  activity_type: "transaction_wizard",
  required_steps: ["type", "property", "parties", "dates", "review"],
  requires_reflection: false,
  minimum_reflection_length: 0,
};

const scenarioSpec: LessonSessionUiSpec = {
  activity_type: "scenario",
  required_steps: ["open-package", "identify-required", "identify-blocked", "read-blocked-reason"],
  requires_reflection: true,
  minimum_reflection_length: 40,
};

describe("WizardLaunchLink", () => {
  it("links to /training/wizard with the canonical evaluator query", () => {
    render(<WizardLaunchLink lessonId="pcert-l04" spec={wizardSpec} />);
    const link = screen.getByRole("link", { name: /open the training wizard/i });
    const href = link.getAttribute("href") ?? "";
    expect(href).toContain("/training/wizard?");
    const q = new URLSearchParams(href.split("?")[1] ?? "");
    expect(q.get("lesson")).toBe("pcert-l04");
    expect(q.get("activity")).toBe("transaction_wizard");
    expect(q.get("evaluator_key")).toBe("transaction_wizard.completed.v1");
    expect(q.get("criterion_version")).toBe("1");
    expect(q.get("certification")).toBe("hartfelt-platform-certified");
  });

  it("fails closed with an inline error for non-wizard activity_type", () => {
    render(
      <WizardLaunchLink lessonId="pcert-l11" spec={scenarioSpec} />,
    );
    expect(screen.getByText(/Wizard link requires activity_type/i)).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("shows a passive success chip when alreadyCompleted", () => {
    render(
      <WizardLaunchLink
        lessonId="pcert-l04"
        spec={wizardSpec}
        alreadyCompleted={true}
      />,
    );
    expect(screen.getByText(/wizard practice completed/i)).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });
});

describe("ChecklistLauncher", () => {
  it("links to /training/checklist with the canonical evaluator query", () => {
    render(<ChecklistLauncher lessonId="pcert-l11" spec={scenarioSpec} />);
    const link = screen.getByRole("link", { name: /open the checklist/i });
    const href = link.getAttribute("href") ?? "";
    expect(href).toContain("/training/checklist?");
    const q = new URLSearchParams(href.split("?")[1] ?? "");
    expect(q.get("lesson")).toBe("pcert-l11");
    expect(q.get("activity")).toBe("scenario");
    expect(q.get("evaluator_key")).toBe("checklist-reflection.completed.v1");
    expect(q.get("criterion_version")).toBe("1");
  });

  it("shows the reflection minimum length when reflection is required", () => {
    render(<ChecklistLauncher lessonId="pcert-l11" spec={scenarioSpec} />);
    expect(screen.getByText(/at least 40 characters/i)).toBeInTheDocument();
  });

  it("shows 'No written reflection required' when requires_reflection is false", () => {
    const noReflection: LessonSessionUiSpec = { ...scenarioSpec, requires_reflection: false, minimum_reflection_length: 0 };
    render(<ChecklistLauncher lessonId="pcert-l17" spec={noReflection} />);
    expect(screen.getByText(/no written reflection required/i)).toBeInTheDocument();
  });

  it("fails closed on non-scenario activity_type", () => {
    render(<ChecklistLauncher lessonId="pcert-l04" spec={wizardSpec} />);
    expect(screen.getByText(/Checklist launcher requires activity_type/i)).toBeInTheDocument();
  });
});

describe("QuizLauncher", () => {
  it("labels the final exam and passes the lesson id", () => {
    render(<QuizLauncher lessonId="pcert-l32" />);
    expect(screen.getByText(/final certification exam/i)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /take the final exam/i });
    expect(link.getAttribute("href")).toBe("/training/quiz?lesson=pcert-l32");
  });

  it("uses generic quiz copy for non-final lessons", () => {
    render(<QuizLauncher lessonId="pcert-l12" />);
    expect(screen.getByText(/knowledge quiz/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /take the quiz/i })).toBeInTheDocument();
  });

  it("shows the passive success chip when alreadyPassed", () => {
    render(<QuizLauncher lessonId="pcert-l12" alreadyPassed={true} />);
    expect(screen.getByText(/quiz passed/i)).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("shows the 'certification issued' chip when the final exam has been passed", () => {
    render(<QuizLauncher lessonId="pcert-l32" alreadyPassed={true} />);
    expect(screen.getByText(/certification issued/i)).toBeInTheDocument();
  });
});
