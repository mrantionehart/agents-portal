import { groupIntoSections } from "../sections";
import type { TemplateCard } from "../types";

function tpl(over: Partial<TemplateCard>): TemplateCard {
  return { form_id: "X", form_name: "Form", category: "other", revision: null, bytes: null, active: true, manual_only: false, ...over };
}

const OFFER: TemplateCard[] = [
  tpl({ form_id: "INSP-1", form_name: "Inspection Addendum", category: "addendum" }),
  tpl({ form_id: "CRSP-17_Z", form_name: "Seller Financing Addendum", category: "compensation" }),
  tpl({ form_id: "FARBAR-5", form_name: "FAR/BAR Residential Contract", category: "purchase" }),
  tpl({ form_id: "ASIS-6", form_name: "AS-IS Residential Contract", category: "purchase" }),
  tpl({ form_id: "BBA-1", form_name: "Buyer Brokerage Agreement", category: "buyer_rep" }),
  tpl({ form_id: "KICK-1", form_name: "Kick-Out Addendum", category: "addendum" }),
  tpl({ form_id: "ESC-1", form_name: "Interest Bearing Escrow Addendum", category: "addendum" }),
  tpl({ form_id: "FHA-1", form_name: "FHA Financing Addendum", category: "addendum" }),
];

describe("sections — Writing an Offer", () => {
  const groups = groupIntoSections(OFFER, "offer");

  it("Contract section is FIRST and holds the FAR/BAR contracts (not addenda)", () => {
    expect(groups[0].title).toBe("Contract");
    const ids = groups[0].forms.map((f) => f.form_id);
    expect(ids).toEqual(expect.arrayContaining(["FARBAR-5", "ASIS-6"]));
    expect(ids).not.toContain("INSP-1");
    expect(ids).not.toContain("FHA-1");
  });

  it("sections are in transaction order", () => {
    expect(groups.map((g) => g.title)).toEqual([
      "Contract", "Buyer Representation", "Financing", "Inspection", "Contingencies", "Closing / Escrow",
    ]);
  });

  it("Financing gets FHA + seller financing; Contingencies gets kick-out; Closing gets escrow", () => {
    const find = (t: string) => groups.find((g) => g.title === t)!.forms.map((f) => f.form_id);
    expect(find("Financing")).toEqual(expect.arrayContaining(["FHA-1", "CRSP-17_Z"]));
    expect(find("Contingencies")).toContain("KICK-1");
    expect(find("Closing / Escrow")).toContain("ESC-1");
  });
});

describe("sections — Taking a Listing", () => {
  it("splits into Required to Take the Listing + Property Disclosures", () => {
    const L = [
      tpl({ form_id: "ERS-20sa", form_name: "Exclusive Right of Sale", category: "listing" }),
      tpl({ form_id: "SPDR-3", form_name: "Seller Property Disclosure", category: "disclosure" }),
      tpl({ form_id: "HOA-2", form_name: "HOA Disclosure", category: "disclosure" }),
    ];
    expect(groupIntoSections(L, "listing").map((g) => g.title)).toEqual([
      "Required to Take the Listing", "Property Disclosures",
    ]);
  });
});

describe("sections — never hides a form", () => {
  it("an unmatchable form lands in a trailing 'Additional forms' group", () => {
    const g = groupIntoSections([tpl({ form_id: "WEIRD-9", form_name: "Miscellaneous Rider", category: "other" })], "offer");
    expect(g[g.length - 1].title).toBe("Additional forms");
    expect(g[g.length - 1].forms.map((f) => f.form_id)).toContain("WEIRD-9");
  });

  it("a workflow with no section config returns one flat group", () => {
    const g = groupIntoSections([tpl({ form_id: "D-1", form_name: "A Disclosure", category: "disclosure" })], "disclosures");
    expect(g).toHaveLength(1);
    expect(g[0].forms).toHaveLength(1);
  });
});
