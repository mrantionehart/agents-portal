import { WORKFLOWS, formsForWorkflow, workflowById } from "../workflow-map";
import { searchTemplates } from "../search";
import type { TemplateCard } from "../types";

function tpl(over: Partial<TemplateCard>): TemplateCard {
  return {
    form_id: "X-1",
    form_name: "Some Form",
    category: "other",
    revision: null,
    bytes: null,
    active: true,
    manual_only: false,
    ...over,
  };
}

const SAMPLE: TemplateCard[] = [
  tpl({ form_id: "ERS-20sa", form_name: "Exclusive Right of Sale", category: "listing" }),
  tpl({ form_id: "SPDR-3", form_name: "Seller Property Disclosure", category: "disclosure" }),
  tpl({ form_id: "FLOOD-1", form_name: "Flood Disclosure", category: "disclosure" }),
  tpl({ form_id: "FARBAR-5", form_name: "Residential Contract (FAR/BAR)", category: "purchase" }),
  tpl({ form_id: "ASIS-6", form_name: "AS-IS Residential Contract", category: "purchase" }),
  tpl({ form_id: "CRSP-17_Z", form_name: "Seller Financing Addendum", category: "compensation" }),
  tpl({ form_id: "INSP-1", form_name: "Inspection Addendum", category: "addendum" }),
  tpl({ form_id: "RL-1", form_name: "Residential Lease", category: "lease" }),
  tpl({ form_id: "HOA-2", form_name: "HOA Disclosure", category: "disclosure" }),
];

describe("workflow-map", () => {
  it("Taking a Listing surfaces listing + disclosure forms, annotated first", () => {
    const wf = workflowById("listing")!;
    const forms = formsForWorkflow(SAMPLE, wf);
    const ids = forms.map((f) => f.form_id);
    expect(ids).toContain("ERS-20sa");
    expect(ids).toContain("SPDR-3");
    expect(ids).toContain("FLOOD-1");
    // annotated ERS-20sa (order 1) sorts before the unannotated disclosures
    expect(ids[0]).toBe("ERS-20sa");
    // does NOT pull in a purchase-only form
    expect(ids).not.toContain("FARBAR-5");
  });

  it("Writing an Offer spans purchase + buyer_rep + addendum + compensation", () => {
    const forms = formsForWorkflow(SAMPLE, workflowById("offer")!).map((f) => f.form_id);
    expect(forms).toEqual(expect.arrayContaining(["FARBAR-5", "ASIS-6", "CRSP-17_Z", "INSP-1"]));
    expect(forms).not.toContain("RL-1");
  });

  it("never duplicates a form_id within a workflow", () => {
    const dup = [...SAMPLE, tpl({ form_id: "ERS-20sa", form_name: "dup", category: "listing" })];
    const ids = formsForWorkflow(dup, workflowById("listing")!).map((f) => f.form_id);
    expect(ids.filter((i) => i === "ERS-20sa")).toHaveLength(1);
  });

  it("every workflow category is a real Vault category value", () => {
    const valid = new Set(["lease", "purchase", "listing", "buyer_rep", "disclosure", "addendum", "compensation", "other"]);
    for (const w of WORKFLOWS) for (const c of w.categories) expect(valid.has(c)).toBe(true);
  });
});

describe("search (synonym-aware)", () => {
  it("matches on form_id", () => {
    expect(searchTemplates(SAMPLE, "ERS").map((t) => t.form_id)).toContain("ERS-20sa");
  });
  it("'listing' → the listing form via synonym", () => {
    expect(searchTemplates(SAMPLE, "listing").map((t) => t.form_id)).toContain("ERS-20sa");
  });
  it("'hoa' → HOA Disclosure", () => {
    expect(searchTemplates(SAMPLE, "hoa").map((t) => t.form_id)).toContain("HOA-2");
  });
  it("'seller financing' → CRSP-17_Z", () => {
    expect(searchTemplates(SAMPLE, "seller financing").map((t) => t.form_id)).toContain("CRSP-17_Z");
  });
  it("'inspection' → Inspection Addendum", () => {
    expect(searchTemplates(SAMPLE, "inspection").map((t) => t.form_id)).toContain("INSP-1");
  });
  it("'as-is' → the AS-IS contract", () => {
    expect(searchTemplates(SAMPLE, "as-is").map((t) => t.form_id)).toContain("ASIS-6");
  });
  it("empty query returns everything", () => {
    expect(searchTemplates(SAMPLE, "  ")).toHaveLength(SAMPLE.length);
  });
});
