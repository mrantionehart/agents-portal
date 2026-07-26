// Structural invariants for the Meetings slice:
//   • NO decision proxy route exists in the Portal.
//   • The Portal proxy surface is exactly the four allowed routes.
//   • No meetings source touches calendar_events.
//   • No new DB migration / table was introduced by this feature.
import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "../../../.."); // repo root
const rel = (...p: string[]) => path.join(ROOT, ...p);

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "__tests__") continue; // exclude test files (this file itself names the forbidden strings)
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

describe("no broker decision route in the Portal", () => {
  it("app/api/meetings/[id]/decision does not exist", () => {
    expect(fs.existsSync(rel("app/api/meetings/[id]/decision"))).toBe(false);
  });
  it("the meetings proxy surface is exactly the four allowed routes", () => {
    const routes = walk(rel("app/api/meetings")).filter((f) => f.endsWith("route.ts")).map((f) => path.relative(rel("app/api/meetings"), f)).sort();
    expect(routes).toEqual(["[id]/cancel/route.ts", "[id]/respond/route.ts", "[id]/route.ts", "route.ts"].sort());
    expect(routes.some((r) => r.includes("decision"))).toBe(false);
  });
});

describe("no calendar_events access anywhere in the Meetings slice", () => {
  const dirs = [
    rel("app/(portal)/meetings"),
    rel("src/portal/meetings"),
    rel("app/api/meetings"),
  ];
  it("no source file references calendar_events", () => {
    for (const d of dirs) {
      for (const f of walk(d).filter((f) => /\.(ts|tsx)$/.test(f))) {
        expect(fs.readFileSync(f, "utf8")).not.toMatch(/calendar_events/);
      }
    }
  });
});

describe("no new DB migration or table introduced by the Portal", () => {
  it("the Portal has no supabase/migrations added for meetings (client-only feature)", () => {
    const migDir = rel("supabase", "migrations");
    if (!fs.existsSync(migDir)) return; // no migrations dir at all → trivially satisfied
    const meetingMigs = fs.readdirSync(migDir).filter((f) => /meeting/i.test(f));
    expect(meetingMigs).toEqual([]);
  });
});
