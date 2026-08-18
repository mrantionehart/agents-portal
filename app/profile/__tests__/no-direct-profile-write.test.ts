/**
 * @jest-environment node
 */
// ============================================================================
// AP-PROFILE-SAVE — the profile page must not write `profiles` from the browser
// ============================================================================
// Source guard. The regression this prevents is specific: a browser-direct
// `supabase.from('profiles').update(...)` bypasses the server allowlist, and
// cannot tell a zero-row no-op from a real write.
//
// Comments are STRIPPED before asserting — otherwise this file's own
// explanatory prose (which necessarily names the forbidden pattern) would
// satisfy or trip the guard rather than the actual code doing so.
// ============================================================================
import { readFileSync } from "fs";
import { join } from "path";

const PAGE = join(process.cwd(), "app/profile/page.tsx");

/** Strip // line comments and /* block *\/ comments. */
function codeOnly(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "");
}

describe("profile page write path", () => {
  const code = codeOnly(readFileSync(PAGE, "utf8"));

  it("9 · does NOT update `profiles` directly from the browser", () => {
    expect(code).not.toMatch(/from\(\s*['"]profiles['"]\s*\)[\s\S]{0,80}?\.update\(/);
  });

  it("9 · does NOT call .update( at all in the page", () => {
    expect(code).not.toMatch(/\.update\(/);
  });

  it("9 · saves through the authenticated server route", () => {
    expect(code).toMatch(/authFetch\(\s*['"]\/api\/profile['"]/);
    expect(code).toMatch(/method:\s*['"]PATCH['"]/);
  });

  it("· never submits `location` — no such column exists on profiles", () => {
    expect(code).not.toMatch(/\blocation\b/);
  });

  it("· surfaces failure inline instead of a blocking alert()", () => {
    expect(code).not.toMatch(/\balert\(/);
    expect(code).toMatch(/saveError/);
  });

  it("· only marks Saved after the server confirms persistence", () => {
    // setSaved(true) must be preceded by a success check on the response.
    const save = code.slice(code.indexOf("const handleSave"), code.indexOf("if (authLoading"));
    expect(save).toMatch(/json\?\.success|res\.ok/);
    const okIdx = save.search(/if\s*\(\s*!res\.ok/);
    const savedIdx = save.indexOf("setSaved(true)");
    expect(okIdx).toBeGreaterThanOrEqual(0);
    expect(savedIdx).toBeGreaterThan(okIdx);
  });

  it("10 · still renders the profile fields it rendered before", () => {
    for (const label of ["Full Name", "Phone", "License Number", "Bio"]) {
      expect(code).toContain(label);
    }
  });
});
