// ============================================================================
// Listing Agent practice — theme × tier catalogue (mirror of Vault authority)
// ============================================================================
// The learner picks a conversation type (FSBO / Divorce / Relocation) and a
// difficulty tier (Beginner / Intermediate / Advanced); each tile maps to the
// exact Vault scenario. This MIRRORS Vault's LISTING_PRACTICE_THEMES — the
// prepare route validates every scenarioId against the Listing pack, so if this
// list ever drifts the server refuses with a learner-safe state rather than
// drawing something else. Scenario ids are stable identifiers, never shown to
// the learner (the Ring deliberately hides scenario identity in its responses).
// ============================================================================

export type RingTierKey = "beginner" | "intermediate" | "advanced";

export interface ListingTile {
  readonly tier: RingTierKey;
  readonly tierLabel: string;
  readonly level: 1 | 2 | 3;
  readonly scenarioId: string;
}

export interface ListingTheme {
  readonly key: "fsbo" | "divorce" | "relocation";
  readonly label: string;
  readonly blurb: string;
  readonly tiles: readonly ListingTile[];
}

const TIERS: ReadonlyArray<{ tier: RingTierKey; tierLabel: string; level: 1 | 2 | 3 }> = [
  { tier: "beginner", tierLabel: "Beginner", level: 1 },
  { tier: "intermediate", tierLabel: "Intermediate", level: 2 },
  { tier: "advanced", tierLabel: "Advanced", level: 3 },
];

function tiles(byTier: Record<RingTierKey, string>): ListingTile[] {
  return TIERS.map((t) => ({ ...t, scenarioId: byTier[t.tier] }));
}

export const LISTING_THEMES: readonly ListingTheme[] = [
  {
    key: "fsbo",
    label: "FSBO",
    blurb: "For-sale-by-owner conversations — honest value, commission objections, earning the appointment.",
    tiles: tiles({
      beginner: "lst-s03-fsbo-prospecting",
      intermediate: "lst-s19-fsbo-commission",
      advanced: "lst-s22-fsbo-skeptical",
    }),
  },
  {
    key: "divorce",
    label: "Divorce",
    blurb: "Separating owners — empathy, no legal advice, no assumed authority, no pressure.",
    tiles: tiles({
      beginner: "lst-s23-divorce-cooperative",
      intermediate: "lst-s24-divorce-guarded",
      advanced: "lst-s20-divorce-sensitive",
    }),
  },
  {
    key: "relocation",
    label: "Relocation",
    blurb: "Out-of-state moves — real deadlines, remote coordination, honest pricing, no overpromises.",
    tiles: tiles({
      beginner: "lst-s25-relocation-cooperative",
      intermediate: "lst-s21-relocation",
      advanced: "lst-s26-relocation-distressed",
    }),
  },
];
