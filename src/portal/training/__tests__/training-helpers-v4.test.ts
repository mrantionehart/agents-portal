// ============================================================================
// Training Hub helpers — Volume-aware open_url routing (V4)
// ============================================================================
// Locks the volume-aware behavior in `modulesToHubItems`:
//   Vol 1 / 2 / 3 → /training-legacy#module-<id>
//   Vol 4         → /training/certified/<id> (V4 unified learner surface)
//   Anything else → "#" (inert; fail-safe against a future volume that has
//                   no registered destination — the legacy player is not a
//                   safe fallback because it renders nothing for V4+)
// ============================================================================

import { modulesToHubItems } from "../helpers";
import type { TrainingModuleRow } from "../types";

function buildModule(overrides: Partial<TrainingModuleRow> & { id: string; volume: number }): TrainingModuleRow {
  return {
    id: overrides.id,
    volume: overrides.volume,
    module_num: overrides.module_num ?? 1,
    sort_order: overrides.sort_order ?? 0,
    title_en: overrides.title_en ?? overrides.id,
  } as TrainingModuleRow;
}

describe("modulesToHubItems — volume-aware open_url routing", () => {
  it("Volume 1 modules open the legacy player", () => {
    const modules = [buildModule({ id: "m_v1_foundations", volume: 1 })];
    const items = modulesToHubItems(modules, new Map());
    expect(items[0].open_url).toBe("/training-legacy#module-m_v1_foundations");
  });

  it("Volume 2 modules open the legacy player", () => {
    const modules = [buildModule({ id: "m_v2_elite", volume: 2 })];
    const items = modulesToHubItems(modules, new Map());
    expect(items[0].open_url).toBe("/training-legacy#module-m_v2_elite");
  });

  it("Volume 3 modules open the legacy player", () => {
    const modules = [buildModule({ id: "m_v3_ai", volume: 3 })];
    const items = modulesToHubItems(modules, new Map());
    expect(items[0].open_url).toBe("/training-legacy#module-m_v3_ai");
  });

  it("Volume 4 modules open the certified track page", () => {
    const modules = [buildModule({ id: "pcert-t01", volume: 4 })];
    const items = modulesToHubItems(modules, new Map());
    expect(items[0].open_url).toBe("/training/certified/pcert-t01");
  });

  it("Volume 4 track ids are URL-encoded", () => {
    const modules = [buildModule({ id: "pcert-t01/weird id", volume: 4 })];
    const items = modulesToHubItems(modules, new Map());
    expect(items[0].open_url).toContain(encodeURIComponent("pcert-t01/weird id"));
    expect(items[0].open_url).toBe(`/training/certified/${encodeURIComponent("pcert-t01/weird id")}`);
  });

  it("unknown volumes route to the inert '#' fallback rather than legacy", () => {
    const modules = [
      buildModule({ id: "m_v5_future", volume: 5 }),
      buildModule({ id: "m_v99", volume: 99 }),
      buildModule({ id: "m_v0", volume: 0 }),
    ];
    const items = modulesToHubItems(modules, new Map());
    for (const item of items) expect(item.open_url).toBe("#");
  });

  it("mixes volumes correctly across a catalog", () => {
    const modules = [
      buildModule({ id: "m_v1_a", volume: 1, sort_order: 100 }),
      buildModule({ id: "pcert-t02", volume: 4, sort_order: 402 }),
      buildModule({ id: "m_v3_ai", volume: 3, sort_order: 300 }),
      buildModule({ id: "m_v5_x", volume: 5, sort_order: 999 }),
    ];
    const items = modulesToHubItems(modules, new Map());
    // Sort order preserved.
    const byId = Object.fromEntries(items.map((i) => [i.title, i.open_url]));
    expect(byId["m_v1_a"]).toBe("/training-legacy#module-m_v1_a");
    expect(byId["pcert-t02"]).toBe("/training/certified/pcert-t02");
    expect(byId["m_v3_ai"]).toBe("/training-legacy#module-m_v3_ai");
    expect(byId["m_v5_x"]).toBe("#");
  });
});
