// ============================================================================
// RING-IN-MY-TRAINING — The Ring is a first-class card in the Training tab
// ============================================================================
// The Ring is a live, agent-visible destination (sidebar `/the-ring`) that was
// never surfaced inside the Training Hub. These tests pin the fix:
//   1. The Ring HubItem the loader injects classifies into a new
//      "Practice & Simulation" section (not the Uncategorized fallback).
//   2. The existing "AI Roleplay" (AI Academy) module is NOT stolen by the new
//      section — categorization is unchanged for every prior module.
//   3. The card actually RENDERS for an agent, in that section, and links to
//      the existing `/the-ring` route (entry point + primary action visible).
//   4. The loader leads the Training list with the Ring card and keeps it even
//      when the DB read fails (DB-independent, always reachable).
// ============================================================================

import { render, screen, within } from "@testing-library/react";

import TrainingHubClient, {
  partitionTrainingCatalog,
} from "../TrainingHubClient";
import { loadTrainingHub } from "../loader";
import type { HubItem } from "../types";

jest.mock("next/navigation", () => ({
  usePathname: () => "/training",
}));

// The exact card the loader injects (kept in sync with loader.ts).
const RING_CARD: HubItem = {
  id: "training/the-ring",
  tab: "training",
  title: "The Ring — AI Roleplay Practice",
  category: "Practice",
  description:
    "Practice live real-estate conversations with an AI counterpart and get instant coaching and scoring.",
  open_url: "/the-ring",
};

// A couple of real catalog titles that must keep their existing section.
const AI_ROLEPLAY: HubItem = {
  id: "training/module/ai-roleplay",
  tab: "training",
  title: "AI Roleplay",
  category: "Volume 3",
  description: "Module 6",
  open_url: "/training-legacy#module-ai-roleplay",
};
const LISTINGS: HubItem = {
  id: "training/module/listings-mastery",
  tab: "training",
  title: "Listings Mastery",
  category: "Volume 1",
  description: "Module 3",
  open_url: "/training-legacy#module-listings-mastery",
};

describe("RING-IN-MY-TRAINING — categorization", () => {
  it("(1) the Ring card lands in the 'practice' section, not Uncategorized", () => {
    const { sections, uncategorized } = partitionTrainingCatalog([
      RING_CARD,
      AI_ROLEPLAY,
      LISTINGS,
    ]);
    const practice = sections.get("practice") ?? [];
    expect(practice.map((i) => i.id)).toContain("training/the-ring");
    expect(uncategorized.map((i) => i.id)).not.toContain("training/the-ring");
  });

  it("(2) the new section does NOT steal 'AI Roleplay' from AI Academy", () => {
    const { sections } = partitionTrainingCatalog([RING_CARD, AI_ROLEPLAY, LISTINGS]);
    expect((sections.get("practice") ?? []).map((i) => i.id)).not.toContain(
      "training/module/ai-roleplay"
    );
    expect((sections.get("ai-academy") ?? []).map((i) => i.id)).toContain(
      "training/module/ai-roleplay"
    );
    // And a Residential module is unaffected.
    expect((sections.get("residential") ?? []).map((i) => i.id)).toContain(
      "training/module/listings-mastery"
    );
  });

  it("(3) every item still lands in exactly one bucket (nothing hidden, nothing double-counted)", () => {
    const items = [RING_CARD, AI_ROLEPLAY, LISTINGS];
    const { hero, sections, uncategorized } = partitionTrainingCatalog(items);
    const seen = new Set<string>();
    for (const it of [...hero, ...uncategorized]) seen.add(it.id);
    for (const [, list] of sections) for (const it of list) seen.add(it.id);
    expect(seen.size).toBe(items.length);
  });
});

describe("RING-IN-MY-TRAINING — render (agent sees + can open the Ring)", () => {
  it("(4) renders the Ring card under Practice & Simulation, linking to /the-ring", () => {
    render(
      <TrainingHubClient
        training={[RING_CARD, LISTINGS]}
        scripts={[]}
        resources={[]}
        continueWatching={null}
        initialTab="training"
        error={null}
      />
    );
    const link = screen.getByRole("link", { name: /The Ring — AI Roleplay Practice/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/the-ring");
    // It is inside the Practice & Simulation section, not the Other fallback.
    const section = screen.getByTestId("training-section-practice");
    expect(within(section).getByRole("link", { name: /The Ring/i })).toBeInTheDocument();
    expect(screen.queryByTestId("training-section-uncategorized")).toBeNull();
  });
});

describe("RING-IN-MY-TRAINING — loader always surfaces the Ring", () => {
  // Minimal thenable query-builder mock matching loader.ts's call shapes:
  // .from(t).select(...).order(...) | .select(...) | .select(...).eq(...)
  function selectResult(data: unknown[]) {
    const p = Promise.resolve({ data });
    return {
      order: () => p,
      eq: () => p,
      then: (res: (v: { data: unknown[] }) => unknown, rej?: (e: unknown) => unknown) =>
        p.then(res, rej),
    };
  }
  const okSupabase = {
    from: () => ({ select: () => selectResult([]) }),
  } as never;

  it("(5) leads the Training list with the Ring card", async () => {
    const res = await loadTrainingHub({ supabase: okSupabase, callerId: "agent-1" });
    expect(res.training[0]?.id).toBe("training/the-ring");
    expect(res.training[0]?.open_url).toBe("/the-ring");
  });

  it("(6) still shows the Ring card when the DB read throws", async () => {
    const brokenSupabase = {
      from: () => {
        throw new Error("boom");
      },
    } as never;
    const res = await loadTrainingHub({ supabase: brokenSupabase, callerId: "agent-1" });
    expect(res.kind).toBe("error");
    expect(res.training.map((i) => i.id)).toEqual(["training/the-ring"]);
  });
});
