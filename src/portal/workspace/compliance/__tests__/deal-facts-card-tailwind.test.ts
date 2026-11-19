// FL-CAT-1 — src/portal/workspace is NOT in tailwind `content`, so a class used
// only here is never generated (UAT: the selects rendered white). Every
// arbitrary-value class the card uses must already appear in a scanned file.
import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "../../../../..");
const CARD = fs.readFileSync(path.join(ROOT, "src/portal/workspace/compliance/DealFactsCard.tsx"), "utf8");

function scannedSource(): string {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === "node_modules" || e.name.startsWith(".")) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(tsx?|jsx?|mdx)$/.test(e.name)) out.push(fs.readFileSync(p, "utf8"));
    }
  };
  walk(path.join(ROOT, "app"));
  return out.join("\n");
}

describe("[FL-CAT-1] DealFactsCard classes are generated", () => {
  it("every arbitrary-value class also appears under app/ (a scanned path)", () => {
    const arbitrary = Array.from(new Set(CARD.match(/[\w:-]+-\[[^\]\s]+\]/g) ?? []));
    expect(arbitrary.length).toBeGreaterThan(0);
    const src = scannedSource();
    const missing = arbitrary.filter((c) => !src.includes(c));
    expect(missing).toEqual([]);
  });
});
