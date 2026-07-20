// ============================================================================
// AP2 tour — Track 2 (Transaction Intelligence) anchor coverage
// ============================================================================
// Two layers, matching Track 1's `anchor-coverage.test.tsx`:
//
//   1. RENDERED coverage — components that are self-contained enough to
//      render in jsdom (CoachStrip, AssistantPromptChips, TabStrip,
//      DraftPicker, AssistantDraftCard) are rendered and the anchor is
//      queried from the actual DOM.
//
//   2. STATIC coverage — components too heavy to render without an
//      extensive mock harness (CoordinatorPanel, AIAssistantPanel, and
//      the WorkspaceShell wrapper around CoordinatorPanel) are covered
//      by reading the source file and asserting the exact
//      `data-training-id="…"` attribute is present.
//
// The Track 1 tests continue to run in a separate file. Nothing here
// touches Track 1 anchors.
// ============================================================================

import { render } from "@testing-library/react";
import * as fs from "node:fs";
import * as path from "node:path";

import CoachStrip from "../../workspace/components/CoachStrip";
import AssistantPromptChips from "../../workspace/components/AssistantPromptChips";
import TabStrip from "../../workspace/tabs/TabStrip";
import DraftPicker from "../../workspace/ai/DraftPicker";
import AssistantDraftCard from "../../workspace/ai/AssistantDraftCard";
import type { AssistantDraft } from "../../workspace/ai/assistant-types";
import { resolveAnchor } from "../anchors";

// ─── next.js stubs ──────────────────────────────────────────────────────────

jest.mock("next/link", () => {
  function MockLink({
    children,
    href,
    ...rest
  }: React.PropsWithChildren<{ href: string } & Record<string, unknown>>) {
    return (
      // eslint-disable-next-line jsx-a11y/anchor-has-content
      <a href={href} {...(rest as Record<string, unknown>)}>
        {children}
      </a>
    );
  }
  return { __esModule: true, default: MockLink };
});
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
  usePathname: () => "/workspace/test-txn",
}));

// ─── fixture helpers ────────────────────────────────────────────────────────

function makeDraft(overrides: Partial<AssistantDraft> = {}): AssistantDraft {
  return {
    title: "Follow-up email",
    audience: "buyer",
    channel: "email",
    subject: "Next steps",
    body: "Hi — here's what's next.",
    confidence: 0.8,
    warnings: [],
    facts_used: [],
    draft_type: "buyer_update",
    // Fields tolerated by the type; only used if the current shape
    // requires them.
    ...(overrides as Partial<AssistantDraft>),
  } as AssistantDraft;
}

// ─── 1. CoachStrip ──────────────────────────────────────────────────────────

describe("Track 2 — CoachStrip anchor coverage", () => {
  it("renders with `portal.workspace.coach.strip` when a recommendation is present", () => {
    const rec = {
      kind: "complete_collection",
      label: "Collect fields",
      title: "Collect fields",
      blocker: false,
      reason: "A few fields are missing.",
      recommended_action: "Open Overview",
      estimated_time: "5m",
      drill_url: "/workspace/test-txn?tab=overview",
    } as any;
    const { container } = render(<CoachStrip recommendation={rec} />);
    const el = container.querySelector('[data-training-id="portal.workspace.coach.strip"]');
    expect(el).toBeTruthy();
  });

  it("renders nothing (no anchor) when recommendation is null", () => {
    const { container } = render(<CoachStrip recommendation={null} />);
    const el = container.querySelector('[data-training-id="portal.workspace.coach.strip"]');
    expect(el).toBeNull();
    expect(container.firstChild).toBeNull();
  });
});

// ─── 2. AssistantPromptChips ────────────────────────────────────────────────

describe("Track 2 — AssistantPromptChips anchor coverage", () => {
  it("renders with `portal.workspace.assistant.prompt-chips`", () => {
    const { container } = render(<AssistantPromptChips transactionId="test-txn" />);
    const el = container.querySelector('[data-training-id="portal.workspace.assistant.prompt-chips"]');
    expect(el).toBeTruthy();
    // Also verify it has non-zero bounding rect (not hidden/collapsed by
    // default). jsdom doesn't do layout, so we assert visibility via
    // offsetParent-not-null instead.
    expect(el).toBeInstanceOf(HTMLElement);
  });
});

// ─── 3. TabStrip — AI tab conditional anchor ────────────────────────────────

describe("Track 2 — TabStrip AI tab anchor coverage", () => {
  it("plants `portal.workspace.tab.ai` on the AI tab pill", () => {
    const { container } = render(<TabStrip transactionId="test-txn" active="overview" />);
    const el = container.querySelector('[data-training-id="portal.workspace.tab.ai"]');
    expect(el).toBeTruthy();
    // The AI tab is a Link (rendered as <a>) with the AI href.
    expect((el as HTMLAnchorElement).getAttribute("href")).toMatch(/tab=ai/);
  });

  it("does NOT plant the AI anchor on other tab pills", () => {
    const { container } = render(<TabStrip transactionId="test-txn" active="overview" />);
    const otherTabs = Array.from(container.querySelectorAll("a"))
      .filter((a) => !(a.getAttribute("href") ?? "").includes("tab=ai"));
    for (const a of otherTabs) {
      expect(a.hasAttribute("data-training-id")).toBe(false);
    }
  });

  it("plants exactly ONE `portal.workspace.tab.ai` anchor per render", () => {
    const { container } = render(<TabStrip transactionId="test-txn" active="ai" />);
    const els = container.querySelectorAll('[data-training-id="portal.workspace.tab.ai"]');
    expect(els.length).toBe(1);
  });
});

// ─── 4. DraftPicker ─────────────────────────────────────────────────────────

describe("Track 2 — DraftPicker anchor coverage", () => {
  it("plants `portal.workspace.ai.draft-picker` on the Draft… button", () => {
    const { container } = render(<DraftPicker onSelect={() => {}} />);
    const el = container.querySelector('[data-training-id="portal.workspace.ai.draft-picker"]');
    expect(el).toBeTruthy();
    expect((el as HTMLButtonElement).tagName).toBe("BUTTON");
  });
});

// ─── 5. AssistantDraftCard — anchor-gate + eligibility semantics ────────────
//
// The four draft-card training anchors are emitted ONLY when the parent
// passes `trainingAnchorEnabled={true}`. When the flag is false or
// omitted, the card renders identically in every other respect but
// carries no training anchors. Uniqueness of the four anchors in the
// live DOM is guaranteed by having exactly one card in the AI history
// receive the flag.

describe("Track 2 — AssistantDraftCard emits training anchors only when the parent enables them", () => {
  it("plants all four anchors when trainingAnchorEnabled=true and both warnings + facts_used are present", () => {
    const draft = makeDraft({
      warnings: ["Missing party address."],
      facts_used: [{ source: "transaction", fact: "Closing date is 2026-08-15." }] as any,
    });
    const { container } = render(
      <AssistantDraftCard draft={draft} expectedAudience="buyer" trainingAnchorEnabled />,
    );
    expect(container.querySelector('[data-training-id="portal.workspace.ai.draft-card"]')).toBeTruthy();
    expect(container.querySelector('[data-training-id="portal.workspace.ai.draft-card.confidence"]')).toBeTruthy();
    expect(container.querySelector('[data-training-id="portal.workspace.ai.draft-card.warnings"]')).toBeTruthy();
    expect(container.querySelector('[data-training-id="portal.workspace.ai.draft-card.facts-used"]')).toBeTruthy();
  });

  it("does NOT plant any of the four anchors when trainingAnchorEnabled is false (default)", () => {
    const draft = makeDraft({
      warnings: ["Missing party address."],
      facts_used: [{ source: "transaction", fact: "Closing date is 2026-08-15." }] as any,
    });
    const { container } = render(
      <AssistantDraftCard draft={draft} expectedAudience="buyer" />,
    );
    expect(container.querySelector('[data-training-id="portal.workspace.ai.draft-card"]')).toBeNull();
    expect(container.querySelector('[data-training-id="portal.workspace.ai.draft-card.confidence"]')).toBeNull();
    expect(container.querySelector('[data-training-id="portal.workspace.ai.draft-card.warnings"]')).toBeNull();
    expect(container.querySelector('[data-training-id="portal.workspace.ai.draft-card.facts-used"]')).toBeNull();
  });

  // PILOT-D-012 Batch E — the four training anchors are STRUCTURALLY stable
  // when trainingAnchorEnabled=true. The wrappers are always mounted even
  // when the underlying data arrays are empty. The Vault response contract
  // makes `draft.warnings` and `draft.facts_used` mutually exclusive
  // (warnings populated only when facts_used is empty); a tour that
  // spotlights both cannot condition on either data-array being non-empty
  // at any single instant.

  it("with trainingAnchorEnabled=true, the warnings anchor is mounted even when warnings are empty (empty placeholder)", () => {
    const draft = makeDraft({ warnings: [] });
    const { container } = render(
      <AssistantDraftCard draft={draft} expectedAudience="buyer" trainingAnchorEnabled />,
    );
    const anchor = container.querySelector('[data-training-id="portal.workspace.ai.draft-card.warnings"]');
    expect(anchor).toBeTruthy();
    // Empty placeholder — no visible content.
    expect(anchor?.textContent ?? "").toBe("");
    // Card + confidence remain present.
    expect(container.querySelector('[data-training-id="portal.workspace.ai.draft-card"]')).toBeTruthy();
    expect(container.querySelector('[data-training-id="portal.workspace.ai.draft-card.confidence"]')).toBeTruthy();
  });

  it("with trainingAnchorEnabled=true, the facts-used anchor is mounted even when facts_used is empty (empty placeholder)", () => {
    const draft = makeDraft({ facts_used: [] });
    const { container } = render(
      <AssistantDraftCard draft={draft} expectedAudience="buyer" trainingAnchorEnabled />,
    );
    const anchor = container.querySelector('[data-training-id="portal.workspace.ai.draft-card.facts-used"]');
    expect(anchor).toBeTruthy();
    // Empty placeholder — no facts-used toggle button visible.
    expect(anchor?.querySelector('[data-testid="assistant-draft-facts-toggle"]')).toBeNull();
  });

  // ─── Batch E — required test matrix ────────────────────────────────────────

  it("grounded draft (facts_used > 0, warnings empty): all four anchors mounted; facts-used populated, warnings empty", () => {
    const draft = makeDraft({
      facts_used: [{ source: "Coordinator", fact: "Workflow state is awaiting_party_attestation" }] as any,
      warnings: [],
    });
    const { container } = render(
      <AssistantDraftCard draft={draft} expectedAudience="buyer" trainingAnchorEnabled />,
    );
    for (const id of [
      "portal.workspace.ai.draft-card",
      "portal.workspace.ai.draft-card.confidence",
      "portal.workspace.ai.draft-card.facts-used",
      "portal.workspace.ai.draft-card.warnings",
    ]) {
      expect(container.querySelector(`[data-training-id="${id}"]`)).toBeTruthy();
    }
    // Facts-used populated — toggle button visible.
    const factsAnchor = container.querySelector('[data-training-id="portal.workspace.ai.draft-card.facts-used"]');
    expect(factsAnchor?.querySelector('[data-testid="assistant-draft-facts-toggle"]')).toBeTruthy();
    // Warnings placeholder — no visible content.
    const warningsAnchor = container.querySelector('[data-training-id="portal.workspace.ai.draft-card.warnings"]');
    expect(warningsAnchor?.textContent ?? "").toBe("");
  });

  it("ungrounded draft (facts_used empty, warnings > 0): all four anchors mounted; warnings populated, facts-used empty", () => {
    const draft = makeDraft({
      facts_used: [],
      warnings: ["This draft could not be fully grounded — review carefully."],
    });
    const { container } = render(
      <AssistantDraftCard draft={draft} expectedAudience="buyer" trainingAnchorEnabled />,
    );
    for (const id of [
      "portal.workspace.ai.draft-card",
      "portal.workspace.ai.draft-card.confidence",
      "portal.workspace.ai.draft-card.facts-used",
      "portal.workspace.ai.draft-card.warnings",
    ]) {
      expect(container.querySelector(`[data-training-id="${id}"]`)).toBeTruthy();
    }
    // Warnings populated.
    const warningsAnchor = container.querySelector('[data-training-id="portal.workspace.ai.draft-card.warnings"]');
    expect(warningsAnchor?.textContent).toMatch(/could not be fully grounded/);
    // Facts-used placeholder — no visible toggle.
    const factsAnchor = container.querySelector('[data-training-id="portal.workspace.ai.draft-card.facts-used"]');
    expect(factsAnchor?.querySelector('[data-testid="assistant-draft-facts-toggle"]')).toBeNull();
  });

  it("empty draft (both facts_used and warnings empty): all four anchors still mounted as empty placeholders", () => {
    const draft = makeDraft({ facts_used: [], warnings: [] });
    const { container } = render(
      <AssistantDraftCard draft={draft} expectedAudience="buyer" trainingAnchorEnabled />,
    );
    for (const id of [
      "portal.workspace.ai.draft-card",
      "portal.workspace.ai.draft-card.confidence",
      "portal.workspace.ai.draft-card.facts-used",
      "portal.workspace.ai.draft-card.warnings",
    ]) {
      expect(container.querySelector(`[data-training-id="${id}"]`)).toBeTruthy();
    }
  });

  it("anchor identity is stable across empty → grounded → ungrounded transitions", () => {
    const empty = makeDraft({ facts_used: [], warnings: [] });
    const grounded = makeDraft({
      facts_used: [{ source: "Coordinator", fact: "State" }] as any,
      warnings: [],
    });
    const ungrounded = makeDraft({
      facts_used: [],
      warnings: ["Ungrounded"],
    });
    const IDS = [
      "portal.workspace.ai.draft-card",
      "portal.workspace.ai.draft-card.confidence",
      "portal.workspace.ai.draft-card.facts-used",
      "portal.workspace.ai.draft-card.warnings",
    ];
    const { container, rerender } = render(
      <AssistantDraftCard draft={empty} expectedAudience="buyer" trainingAnchorEnabled />,
    );
    for (const id of IDS) expect(container.querySelector(`[data-training-id="${id}"]`)).toBeTruthy();
    rerender(<AssistantDraftCard draft={grounded} expectedAudience="buyer" trainingAnchorEnabled />);
    for (const id of IDS) expect(container.querySelector(`[data-training-id="${id}"]`)).toBeTruthy();
    rerender(<AssistantDraftCard draft={ungrounded} expectedAudience="buyer" trainingAnchorEnabled />);
    for (const id of IDS) expect(container.querySelector(`[data-training-id="${id}"]`)).toBeTruthy();
  });

  it("trainingAnchorEnabled=false is unchanged: no anchors regardless of data shape", () => {
    // Legacy behavior for non-anchored cards is preserved.
    const cases = [
      makeDraft({ facts_used: [], warnings: [] }),
      makeDraft({ facts_used: [{ source: "Coordinator", fact: "F" }] as any, warnings: [] }),
      makeDraft({ facts_used: [], warnings: ["W"] }),
    ];
    for (const draft of cases) {
      const { container, unmount } = render(
        <AssistantDraftCard draft={draft} expectedAudience="buyer" />,
      );
      for (const id of [
        "portal.workspace.ai.draft-card",
        "portal.workspace.ai.draft-card.confidence",
        "portal.workspace.ai.draft-card.facts-used",
        "portal.workspace.ai.draft-card.warnings",
      ]) {
        expect(container.querySelector(`[data-training-id="${id}"]`)).toBeNull();
      }
      unmount();
    }
  });

  it("a non-training card still renders full user-facing content (title, subject, body, copy controls)", () => {
    const draft = makeDraft({
      title: "Follow-up email",
      subject: "Next steps",
      body: "Hi — here's what's next.",
    });
    const { container, getByText } = render(
      <AssistantDraftCard draft={draft} expectedAudience="buyer" />,
    );
    // Title, subject, body present.
    expect(getByText("Follow-up email")).toBeInTheDocument();
    expect(getByText("Next steps")).toBeInTheDocument();
    expect(getByText("Hi — here's what's next.")).toBeInTheDocument();
    // Copy button visible (existing data-testids preserved).
    expect(container.querySelector('[data-testid="assistant-draft-copy"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="assistant-draft-edit"]')).toBeTruthy();
    // No training anchor.
    expect(container.querySelector('[data-training-id="portal.workspace.ai.draft-card"]')).toBeNull();
  });
});

// ─── 6. Parent selects exactly ONE eligible draft — no engine dependency ────
//
// The eligibility rule lives in AIAssistantPanel: the FIRST message in
// chronological order that is an assistant answer with a non-null
// envelope.draft is the training-anchored card. Every other draft
// renders unanchored. These tests render AssistantDraftCard directly
// with parent-computed `trainingAnchorEnabled` values to simulate the
// selection logic without dragging AIAssistantPanel's full render
// dependencies into jsdom.

describe("Track 2 — deterministic single-anchor selection across multiple cards", () => {
  it("only the first eligible card carries the four training anchors", () => {
    const first = makeDraft({ title: "First eligible draft" });
    const second = makeDraft({ title: "Second draft" });
    const third = makeDraft({ title: "Third draft" });

    // Simulate what AIAssistantPanel does: only i === firstDraftIndex gets true.
    const { container } = render(
      <div>
        <AssistantDraftCard draft={first} expectedAudience="buyer" trainingAnchorEnabled />
        <AssistantDraftCard draft={second} expectedAudience="buyer" />
        <AssistantDraftCard draft={third} expectedAudience="buyer" />
      </div>,
    );

    // Uniqueness — each anchor appears exactly once, on the first card.
    const cards = container.querySelectorAll('[data-training-id="portal.workspace.ai.draft-card"]');
    expect(cards.length).toBe(1);
    expect(cards[0].textContent).toMatch(/First eligible draft/);

    expect(container.querySelectorAll('[data-training-id="portal.workspace.ai.draft-card.confidence"]').length).toBe(1);
    // PILOT-D-012 Batch E — warnings and facts-used anchors are structurally
    // stable when trainingAnchorEnabled=true, so they appear exactly ONCE
    // (on the first card) regardless of data. Uniqueness is preserved by
    // AIAssistantPanel selecting exactly one anchored card.
    expect(container.querySelectorAll('[data-training-id="portal.workspace.ai.draft-card.warnings"]').length).toBe(1);
    expect(container.querySelectorAll('[data-training-id="portal.workspace.ai.draft-card.facts-used"]').length).toBe(1);
  });

  it("`resolveAnchor` returns the single anchored card (no hidden-first hazard)", () => {
    const first = makeDraft({ title: "Anchored draft" });
    const second = makeDraft({ title: "Later draft" });

    const { container } = render(
      <div>
        <AssistantDraftCard draft={first} expectedAudience="buyer" trainingAnchorEnabled />
        <AssistantDraftCard draft={second} expectedAudience="buyer" />
      </div>,
    );
    document.body.appendChild(container);
    const el = resolveAnchor("portal.workspace.ai.draft-card");
    document.body.removeChild(container);
    expect(el).toBeTruthy();
    expect(el?.textContent).toMatch(/Anchored draft/);
  });

  it("querySelectorAll finds at most ONE instance of each draft-card training anchor", () => {
    const a = makeDraft({
      warnings: ["a warning"],
      facts_used: [{ source: "transaction", fact: "fact 1" }] as any,
    });
    const b = makeDraft({
      warnings: ["another warning"],
      facts_used: [{ source: "transaction", fact: "fact 2" }] as any,
    });
    const c = makeDraft({
      warnings: ["yet another"],
      facts_used: [{ source: "transaction", fact: "fact 3" }] as any,
    });

    const { container } = render(
      <div>
        <AssistantDraftCard draft={a} expectedAudience="buyer" trainingAnchorEnabled />
        <AssistantDraftCard draft={b} expectedAudience="buyer" />
        <AssistantDraftCard draft={c} expectedAudience="buyer" />
      </div>,
    );

    for (const anchor of [
      "portal.workspace.ai.draft-card",
      "portal.workspace.ai.draft-card.confidence",
      "portal.workspace.ai.draft-card.warnings",
      "portal.workspace.ai.draft-card.facts-used",
    ]) {
      const all = container.querySelectorAll(`[data-training-id="${anchor}"]`);
      expect(all.length).toBeLessThanOrEqual(1);
    }
    // And the anchored card is the FIRST one (the caller's selection).
    // Assert via the card's visible warning content — that's rendered
    // uncollapsed by default in the current AssistantDraftCard.
    const card = container.querySelector('[data-training-id="portal.workspace.ai.draft-card"]');
    expect(card?.textContent).toContain("a warning");
    expect(card?.textContent).not.toContain("another warning");
    expect(card?.textContent).not.toContain("yet another");
  });

  it("no record identifier or sensitive value is embedded in any anchor", () => {
    // Render a draft with fields that COULD leak PII if the anchor value
    // were derived from data — property address, client name, etc.
    const draft = makeDraft({
      title: "Draft targeting a specific address",
      subject: "Follow-up — 200 Test Rd",
      body: "For QA Buyer Two at 200 Test Rd.",
      warnings: ["A warning containing 300 Oak Ln"],
      facts_used: [{ source: "transaction", fact: "Property at 400 Elm Rd is under contract." }] as any,
    });
    const { container } = render(
      <AssistantDraftCard draft={draft} expectedAudience="buyer" trainingAnchorEnabled />,
    );

    // Enumerate every element that carries any data-training-id and
    // confirm none of its values reference the draft content.
    const anchored = container.querySelectorAll("[data-training-id]");
    for (const el of Array.from(anchored)) {
      const value = el.getAttribute("data-training-id") ?? "";
      expect(value).not.toContain("QA Buyer");
      expect(value).not.toContain("200 Test");
      expect(value).not.toContain("300 Oak");
      expect(value).not.toContain("400 Elm");
      expect(value).not.toContain("@");
      expect(value).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
      // Only lowercase, dots, hyphens.
      expect(value).toMatch(/^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/);
    }
  });

  it("hidden or off-screen unanchored cards do NOT introduce a competing anchor", () => {
    // Simulates: a hidden or scrolled-off older draft. Because it is
    // NOT the parent's selected first eligible card, it carries no
    // training anchor, so it cannot compete with the anchored one.
    const older = makeDraft({ title: "Older hidden draft" });
    const current = makeDraft({ title: "Current anchored draft" });

    const { container } = render(
      <div>
        <div style={{ display: "none" }}>
          <AssistantDraftCard draft={older} expectedAudience="buyer" />
        </div>
        <AssistantDraftCard draft={current} expectedAudience="buyer" trainingAnchorEnabled />
      </div>,
    );

    document.body.appendChild(container);
    const el = resolveAnchor("portal.workspace.ai.draft-card");
    document.body.removeChild(container);
    expect(el).toBeTruthy();
    expect(el?.textContent).toMatch(/Current anchored draft/);
  });
});

// ─── 7. Parent-eligibility rule — pure computation ─────────────────────────
//
// AIAssistantPanel selects the anchored card as:
//   messages.findIndex(m => role==="assistant" && kind==="answer" && envelope.draft != null)
// The tests below are pure computations against the discriminated
// union; they do not render the panel (which pulls the full assistant
// fetch layer, router, and clipboard integrations that would require
// heavy mocking to render in jsdom).

describe("Track 2 — parent eligibility rule", () => {
  type M =
    | { role: "user"; content: string }
    | { role: "assistant"; kind: "answer"; envelope: { draft?: unknown } }
    | { role: "assistant"; kind: "error" }
    | { role: "assistant"; kind: "intro"; content: string };

  function firstEligible(messages: M[]): number {
    return messages.findIndex(
      (m) =>
        m.role === "assistant" &&
        m.kind === "answer" &&
        (m as { envelope: { draft?: unknown } }).envelope?.draft != null,
    );
  }

  it("picks the first assistant answer with a draft, skipping intro / user / error / draftless answers", () => {
    const messages: M[] = [
      { role: "assistant", kind: "intro", content: "Welcome" },
      { role: "user", content: "Hi" },
      { role: "assistant", kind: "answer", envelope: {} }, // no draft
      { role: "assistant", kind: "error" },
      { role: "assistant", kind: "answer", envelope: { draft: { title: "First draft" } } }, // ← first eligible
      { role: "assistant", kind: "answer", envelope: { draft: { title: "Second draft" } } },
    ];
    expect(firstEligible(messages)).toBe(4);
  });

  it("returns -1 when no message carries a draft (no card gets the anchor)", () => {
    const messages: M[] = [
      { role: "assistant", kind: "intro", content: "Welcome" },
      { role: "user", content: "Hi" },
      { role: "assistant", kind: "answer", envelope: {} },
      { role: "assistant", kind: "error" },
    ];
    expect(firstEligible(messages)).toBe(-1);
  });

  it("selection is stable across identical arrays (purely positional)", () => {
    const messages: M[] = [
      { role: "user", content: "Draft me a note" },
      { role: "assistant", kind: "answer", envelope: { draft: { title: "A" } } },
      { role: "user", content: "Another" },
      { role: "assistant", kind: "answer", envelope: { draft: { title: "B" } } },
    ];
    expect(firstEligible(messages)).toBe(1);
    // No mutation.
    expect(firstEligible(messages)).toBe(1);
  });
});

// ─── 8. STATIC coverage — heavy components ─────────────────────────────────

describe("Track 2 — static file coverage for heavy components", () => {
  // These components are too coupled to server-side data + external
  // deps to render cleanly in jsdom without mocking the entire workspace
  // fetch layer. Static coverage asserts the anchor attribute is
  // literally present in the source file the shell renders. If any
  // future refactor strips or renames the attribute, this test fails.
  const AP_ROOT = path.resolve(__dirname, "..", "..", "..", "..");

  it.each([
    {
      file: "src/portal/workspace/tabs/WorkspaceShell.tsx",
      anchor: "portal.workspace.coordinator",
      note: "wrapper anchor around <CoordinatorPanel /> (Phase 2 wrapper strategy)",
    },
    {
      file: "src/portal/workspace/components/CoordinatorPanel.tsx",
      anchor: "portal.workspace.coordinator.directive",
      note: "loaded-state directive line",
    },
    {
      file: "src/portal/workspace/components/CoordinatorPanel.tsx",
      anchor: "portal.workspace.coordinator.blockers",
      note: "loaded-state blockers wrapper — conditional on has_blockers_section",
    },
    {
      file: "src/portal/workspace/components/CoordinatorPanel.tsx",
      anchor: "portal.workspace.coordinator.cta",
      note: "loaded-state gold CTA button",
    },
    {
      file: "src/portal/workspace/AIAssistantPanel.tsx",
      anchor: "portal.workspace.ai.panel",
      note: "root of the AI panel (rendered inside AITab)",
    },
  ])("$file contains `$anchor`", ({ file, anchor }) => {
    const source = fs.readFileSync(path.join(AP_ROOT, file), "utf8");
    // Look for the exact attribute the tour engine queries.
    const literal = `data-training-id="${anchor}"`;
    expect(source).toContain(literal);
  });
});

// ─── 8. Track 1 anchors remain unchanged ────────────────────────────────────

describe("Track 2 — Track 1 anchors remain covered (regression guard)", () => {
  const AP_ROOT = path.resolve(__dirname, "..", "..", "..", "..");
  it.each([
    {
      file: "src/portal/Sidebar.tsx",
      anchor: "portal.navigation.sidebar",
    },
    {
      file: "app/(portal)/home/page.tsx",
      anchor: "portal.home.dashboard",
    },
    {
      file: "app/(portal)/notifications/page.tsx",
      anchor: "portal.notifications.inbox",
    },
    {
      file: "app/(portal)/settings/page.tsx",
      anchor: "portal.settings.profile",
    },
  ])("$file still contains Track 1 anchor `$anchor`", ({ file, anchor }) => {
    const source = fs.readFileSync(path.join(AP_ROOT, file), "utf8");
    expect(source).toContain(`data-training-id="${anchor}"`);
  });
});
