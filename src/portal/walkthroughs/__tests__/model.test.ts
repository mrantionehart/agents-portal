// ============================================================================
// LEASE-WALKTHROUGH-1 — Agent Portal walkthrough model
// ============================================================================
import {
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
  utility_statuses: ["tenant_responsible", "landlord_responsible", "not_applicable"],
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
