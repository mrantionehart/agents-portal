// ============================================================================
// LEASE-WALKTHROUGH-1 — Agent Portal walkthrough model
// ============================================================================
import {
  addDamageRow,
  addKeyRow,
  addMeterRow,
  clearUtility,
  removeRow,
  setAttendees,
  setUtility,
  updateRow,
  type Catalogue,
  type Draft,
  type SignerCandidate,
  addAdditional,
  progressOf,
  removeAdditional,
  sectionProgress,
  sendBlockers,
  setItemNote,
  setScalar,
  shouldOfferWalkthroughs,
  startableModes,
  toggleRating,
  toggleSigner,
} from "../model";

const CATALOGUE: Catalogue = {
  sections: [
    {
      key: "entry",
      label: "Entry",
      items: [
        { key: "front_door", label: "Front door" },
        { key: "flooring", label: "Flooring" },
      ],
    },
    { key: "kitchen", label: "Kitchen", items: [{ key: "sink", label: "Sink" }] },
  ],
  ratings: [
    { value: "good", label: "Good" },
    { value: "fair", label: "Fair" },
    { value: "damaged", label: "Damaged" },
    { value: "na", label: "N/A" },
  ],
  representations: ["tenant", "landlord", "both"],
  utilities: [{ value: "electric", label: "Electric" }],
  utility_statuses: [
    { value: "tenant_responsible", label: "Tenant" },
    { value: "landlord_responsible", label: "Landlord" },
    { value: "not_applicable", label: "N/A" },
  ],
};

const draft = (): Draft => ({
  schema_version: 1,
  mode: "move_in",
  representation: "tenant",
  walkthrough_on: null,
  attendees: [],
  property: { address: "12 Oak St", city: "Montclair", state: "NJ", zip: "07042" },
  sections: { entry: { items: {} }, kitchen: { items: {} } },
  keys: [],
  utilities: {},
  meters: [],
  existing_damage: [],
  comments: "",
  photo_document_ids: [],
  signer_party_ids: [],
});

const candidate = (over: Partial<SignerCandidate> = {}): SignerCandidate => ({
  party_id: "p1",
  role: "tenant",
  role_label: "Tenant",
  name: "T One",
  email: "t1@e.com",
  selected: false,
  blocked: null,
  ...over,
});

describe("AP walkthrough model · ratings", () => {
  it("[APW-1] records a rating immutably", () => {
    const a = draft();
    const b = toggleRating(a, "entry", "front_door", "damaged");
    expect(b.sections.entry!.items.front_door!.rating).toBe("damaged");
    expect(a.sections.entry!.items.front_door).toBeUndefined();
  });

  it("[APW-2] clicking the ACTIVE rating clears it back to not-observed", () => {
    let d = toggleRating(draft(), "entry", "front_door", "good");
    d = toggleRating(d, "entry", "front_door", "good");
    expect(d.sections.entry!.items.front_door).toBeUndefined();
  });

  it("[APW-3] a different rating switches instead of clearing", () => {
    let d = toggleRating(draft(), "entry", "front_door", "good");
    d = toggleRating(d, "entry", "front_door", "fair");
    expect(d.sections.entry!.items.front_door!.rating).toBe("fair");
  });

  it("[APW-4] clearing an item that has a NOTE keeps the note as na", () => {
    let d = setItemNote(draft(), "entry", "flooring", "scuffed");
    d = toggleRating(d, "entry", "flooring", "fair");
    d = toggleRating(d, "entry", "flooring", "fair");
    expect(d.sections.entry!.items.flooring).toEqual({ rating: "na", notes: "scuffed" });
  });

  it("[APW-5] a note on an unrated item defaults to na, never a condition", () => {
    const d = setItemNote(draft(), "kitchen", "sink", "slow drain");
    expect(d.sections.kitchen!.items.sink!.rating).toBe("na");
  });
});

describe("AP walkthrough model · progress", () => {
  it("[APW-6] counts against the SERVER catalogue", () => {
    let d = draft();
    expect(progressOf(d, CATALOGUE)).toEqual({ rated: 0, total: 3, damaged: 0, complete: false });
    d = toggleRating(d, "entry", "front_door", "good");
    d = toggleRating(d, "entry", "flooring", "damaged");
    d = toggleRating(d, "kitchen", "sink", "na");
    expect(progressOf(d, CATALOGUE)).toEqual({ rated: 3, total: 3, damaged: 1, complete: true });
  });

  it("[APW-7] an agent-added room never changes the denominator", () => {
    let d = draft();
    for (const s of CATALOGUE.sections) for (const i of s.items) d = toggleRating(d, s.key, i.key, "good");
    expect(progressOf(d, CATALOGUE).complete).toBe(true);
    d = addAdditional(d, "entry", "Mud room");
    expect(progressOf(d, CATALOGUE)).toEqual({ rated: 3, total: 3, damaged: 0, complete: true });
  });

  it("[APW-8] additional rooms add, reject blanks, and remove", () => {
    let d = addAdditional(draft(), "entry", "   ");
    expect(d.sections.entry!.additional).toBeUndefined();
    d = addAdditional(d, "entry", "  Mud room ");
    expect(d.sections.entry!.additional).toEqual([{ label: "Mud room", rating: "na" }]);
    expect(removeAdditional(d, "entry", 9)).toBe(d); // out of range is a no-op
    d = removeAdditional(d, "entry", 0);
    expect(d.sections.entry!.additional).toEqual([]);
  });

  it("[APW-9] per-section progress drives the section badge", () => {
    const d = toggleRating(draft(), "entry", "front_door", "damaged");
    expect(sectionProgress(d, CATALOGUE.sections[0]!)).toEqual({ rated: 1, total: 2, damaged: 1 });
    expect(sectionProgress(d, CATALOGUE.sections[1]!)).toEqual({ rated: 0, total: 1, damaged: 0 });
  });
});

describe("AP walkthrough model · send gating", () => {
  it("[APW-10] lists every missing prerequisite", () => {
    const b = sendBlockers({
      draft: draft(),
      catalogue: CATALOGUE,
      candidates: [candidate()],
      generated: false,
      status: "in_progress",
    });
    expect(b).toEqual(
      expect.arrayContaining([
        "Record at least one condition.",
        "Set the walkthrough date.",
        "Generate the PDF first.",
      ]),
    );
  });

  it("[APW-11] a fully-prepared walkthrough has NO blockers", () => {
    // Guards [APW-10] from the degenerate pass: a function that always
    // returned a blocker would satisfy it on its own.
    let d = toggleRating(draft(), "entry", "front_door", "good");
    d = setScalar(d, { walkthrough_on: "2026-10-13" });
    d = toggleSigner(d, "p1");
    expect(
      sendBlockers({ draft: d, catalogue: CATALOGUE, candidates: [candidate()], generated: true, status: "ready" }),
    ).toEqual([]);
  });

  it("[APW-12] choosing only unusable signers is called out specifically", () => {
    let d = toggleRating(draft(), "entry", "front_door", "good");
    d = setScalar(d, { walkthrough_on: "2026-10-13" });
    d = toggleSigner(d, "p1");
    const b = sendBlockers({
      draft: d,
      catalogue: CATALOGUE,
      candidates: [candidate({ blocked: "no email on file" })],
      generated: true,
      status: "ready",
    });
    expect(b).toContain("None of the chosen signers can be emailed — check their name and email.");
  });

  it("[APW-13] an already-sent walkthrough reports only that", () => {
    expect(
      sendBlockers({ draft: draft(), catalogue: CATALOGUE, candidates: [candidate()], generated: true, status: "sent" }),
    ).toEqual(["Already sent for signature."]);
  });

  it("[APW-14] signer selection toggles on and off", () => {
    let d = toggleSigner(draft(), "p1");
    d = toggleSigner(d, "p2");
    expect(d.signer_party_ids).toEqual(["p1", "p2"]);
    d = toggleSigner(d, "p1");
    expect(d.signer_party_ids).toEqual(["p2"]);
  });
});

describe("AP walkthrough model · entry rules", () => {
  it("[APW-15] offered on a lease, never on anything else", () => {
    for (const t of ["lease", "Lease", "residential_lease", "RENTAL"]) {
      expect(shouldOfferWalkthroughs(t)).toBe(true);
    }
    for (const t of ["purchase", "listing", "buyer_rep", "", null, undefined]) {
      expect(shouldOfferWalkthroughs(t)).toBe(false);
    }
  });

  it("[APW-16] one OPEN walkthrough per mode; a signed one does not block", () => {
    expect(startableModes([])).toEqual(["move_in", "move_out"]);
    expect(startableModes([{ mode: "move_in", status: "ready" }])).toEqual(["move_out"]);
    expect(startableModes([{ mode: "move_out", status: "signed" }])).toEqual([
      "move_in",
      "move_out",
    ]);
    expect(
      startableModes([
        { mode: "move_in", status: "sent" },
        { mode: "move_out", status: "in_progress" },
      ]),
    ).toEqual([]);
  });
});

describe("AP walkthrough model · requirement-6 fields", () => {
  it("[APW-17] keys round-trip and delete", () => {
    // These render in the PDF. A client that cannot enter them leaves a
    // section of the signed record permanently blank — which is what the
    // pre-merge review of PR #67 found.
    let d = addKeyRow(draft());
    d = updateRow(d, "keys", 0, { label: "Front door", issued: 2, returned: 1 });
    expect(d.keys).toEqual([{ label: "Front door", issued: 2, returned: 1 }]);
    d = removeRow(d, "keys", 0);
    expect(d.keys).toEqual([]);
  });

  it("[APW-18] meters and existing damage round-trip", () => {
    let d = addMeterRow(draft());
    d = updateRow(d, "meters", 0, { label: "Electric", reading: "41022" });
    expect(d.meters[0]).toEqual({ label: "Electric", reading: "41022" });
    d = addDamageRow(d);
    d = updateRow(d, "existing_damage", 0, { location: "Kitchen", description: "Chipped tile" });
    expect(d.existing_damage[0]).toEqual({ location: "Kitchen", description: "Chipped tile" });
  });

  it("[APW-19] an out-of-range row edit is a no-op returning the SAME draft", () => {
    const d = addKeyRow(draft());
    expect(updateRow(d, "keys", 9, { label: "x" })).toBe(d);
    expect(removeRow(d, "keys", 9)).toBe(d);
  });

  it("[APW-20] a utility needs a responsible party before it is recorded", () => {
    let d = setUtility(draft(), "electric", { account: "123" });
    expect(d.utilities.electric).toBeUndefined();
    d = setUtility(d, "electric", { status: "tenant_responsible", account: "123" });
    expect(d.utilities.electric).toEqual({ status: "tenant_responsible", account: "123" });
    d = clearUtility(d, "electric");
    expect(d.utilities.electric).toBeUndefined();
  });

  it("[APW-21] attendees parse from a comma list, dropping blanks", () => {
    expect(setAttendees(draft(), " A Tenant , , B Agent ,").attendees).toEqual([
      "A Tenant",
      "B Agent",
    ]);
    expect(setAttendees(draft(), "").attendees).toEqual([]);
  });
});

describe("AP walkthrough panel · review guards", () => {
  const panel = (() => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require("fs") as typeof import("fs");
    const path = require("path") as typeof import("path");
    return fs.readFileSync(
      path.join(process.cwd(), "src/portal/walkthroughs/WalkthroughsPanel.tsx"),
      "utf-8",
    );
  })();

  it("[APW-22] the panel source is readable — anchor for the scans below", () => {
    // Without this, a renamed file would make every assertion below read "" and
    // pass vacuously.
    expect(panel.length).toBeGreaterThan(2000);
    expect(panel).toContain("WalkthroughsPanel");
  });

  it("[APW-23] uses NO window.confirm", () => {
    // A native dialog blocks the renderer. This repo has already lost a
    // verification run to exactly that — the dialog froze the page and the
    // click that opened it timed out. Confirmations are inline.
    const code = panel.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toContain("window.confirm");
    expect(code).not.toContain("window.alert");
  });

  it("[APW-24] renders every requirement-6 field", () => {
    // The PDF renders all of them; a panel that cannot enter them leaves a
    // section of the signed record permanently blank.
    //
    // Collected rather than asserted one at a time because jest's expect()
    // takes no message argument — that is a vitest idiom, and using it here
    // silently broke this assertion on its first run.
    const required = [
      "Keys &amp; access devices",
      "Utilities",
      "Meter readings",
      "Existing damage",
      "Present",
      "Comments",
    ];
    expect(required.filter((m) => !panel.includes(m))).toEqual([]);
  });

  it("[APW-25] never calls Vault directly — only the AP proxy routes", () => {
    // A browser cannot reach Vault cross-origin, and a direct VAULT_API_URL
    // here would also skip requireAuth at the edge.
    const code = panel.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toContain("VAULT_API_URL");
    expect(code).toContain("/api/paperwork/walkthroughs");
  });
});

describe("AP walkthrough panel · save / reload wiring", () => {
  const panel = (() => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require("fs") as typeof import("fs");
    const path = require("path") as typeof import("path");
    return fs.readFileSync(
      path.join(process.cwd(), "src/portal/walkthroughs/WalkthroughsPanel.tsx"),
      "utf-8",
    );
  })();

  it("[APW-26] a successful save RE-READS from the server", () => {
    // Otherwise the panel would show its own optimistic draft while the
    // server holds something else — and the status, progress and `generated`
    // flag it gates Send on all come from the server.
    const save = panel.slice(panel.indexOf("const save ="), panel.indexOf("const generate ="));
    expect(save).toContain("setDirty(false)");
    expect(save).toContain("await loadOne(");
    expect(save).toContain("await loadList()");
  });

  it("[APW-27] a FAILED save does not clear the dirty flag", () => {
    // Clearing it on failure would tell the agent their work was saved when
    // it was not.
    const save = panel.slice(panel.indexOf("const save ="), panel.indexOf("const generate ="));
    const failBranch = save.slice(save.indexOf("if (!res.ok)"));
    expect(failBranch).toContain("return false");
    expect(failBranch.slice(0, failBranch.indexOf("return false"))).not.toContain("setDirty(false)");
  });

  it("[APW-28] loading a walkthrough resets dirty and rehydrates from the server", () => {
    const load = panel.slice(panel.indexOf("const loadOne ="), panel.indexOf("const edit ="));
    for (const marker of ["setDraft(", "setCatalogue(", "setCandidates(", "setStatus(", "setGenerated(", "setEditable(", "setDirty(false)"]) {
      expect(load).toContain(marker);
    }
  });

  it("[APW-29] generate saves a dirty draft first, and send re-reads after", () => {
    const gen = panel.slice(panel.indexOf("const generate ="), panel.indexOf("const send ="));
    expect(gen).toContain("if (dirty && !(await save(false))) return");
    const send = panel.slice(panel.indexOf("const send ="), panel.indexOf("const start ="));
    expect(send).toContain("await loadOne(");
  });
});
