// ============================================================================
// AGENT PORTAL · the mapper must not DROP the envelope list
// ============================================================================
// `mergeDocuments` builds DocumentRow field by field, so a field it does not
// name is silently dropped however correctly Vault sends it. That is the
// defect this file exists to prevent: the envelope list would simply never
// appear, with nothing anywhere reporting an error.
//
// [XPT-3] is the load-bearing one: Vault's distinction between an EMPTY ARRAY
// ("none recorded") and an ABSENT key ("this Vault build does not report
// them") must survive the hop, because the panel decides on it.
// ============================================================================

import { mergeDocuments } from "../helpers";
import type { FormInstanceRow, RequirementRow } from "../types";

const TXN = "3fbb0fac-796f-4e93-ba87-e399b55a3abf";
const FI = "35ffc269-4240-400f-9a94-efdde2063094";
const ENV = "aaaaaaaa-1111-2222-3333-444444444444";

const req: RequirementRow = { form_id: "ERL-14", required: true };

const inst = (over: Partial<FormInstanceRow> = {}): FormInstanceRow =>
  ({
    id: FI,
    form_id: "ERL-14",
    status: "approved",
    transaction_id: TXN,
    updated_at: "2026-10-30T18:00:00Z",
    created_at: "2026-10-29T18:00:00Z",
    ...over,
  }) as FormInstanceRow;

const summary = (over = {}) => ({
  id: "row-1",
  envelope_id: ENV,
  status: "completed",
  verified: true,
  sent_at: "2026-10-30T17:00:00Z",
  sending_account_email: "mallory@hartfeltrealestate.com",
  has_executed_pdf: true,
  has_certificate: true,
  ...over,
});

const merge = (instances: FormInstanceRow[]) =>
  mergeDocuments({ vaultBase: "https://v.test", transactionId: TXN, requirements: [req], instances });

describe("[XPT] the envelope list survives mergeDocuments", () => {
  it("[XPT-1] a recorded envelope reaches the DocumentRow intact", () => {
    const [row] = merge([inst({ external_envelopes: [summary()] } as Partial<FormInstanceRow>)]);
    expect(row.external_envelopes).toHaveLength(1);
    expect(row.external_envelopes![0]).toEqual(summary());
  });

  it("[XPT-2] every field is carried — none is quietly dropped", () => {
    const [row] = merge([inst({ external_envelopes: [summary()] } as Partial<FormInstanceRow>)]);
    const got = row.external_envelopes![0];
    for (const k of [
      "id", "envelope_id", "status", "verified", "sent_at",
      "sending_account_email", "has_executed_pdf", "has_certificate",
    ]) {
      expect(Object.prototype.hasOwnProperty.call(got, k)).toBe(true);
    }
    // The one that matters most: a false `verified` must not vanish.
    const [unver] = merge([
      inst({ external_envelopes: [summary({ verified: false })] } as Partial<FormInstanceRow>),
    ]);
    expect(unver.external_envelopes![0].verified).toBe(false);
  });

  it("[XPT-3] empty stays empty, and a document with no instance still gets []", () => {
    // Vault sends [] for "none recorded". The panel offers the record action
    // on that, so it must not arrive as undefined.
    const [withNone] = merge([inst({ external_envelopes: [] } as Partial<FormInstanceRow>)]);
    expect(withNone.external_envelopes).toEqual([]);

    const [noInstance] = merge([]);
    expect(noInstance.external_envelopes).toEqual([]);
  });

  it("[XPT-4] several envelopes all survive, in order", () => {
    const a = summary();
    const b = summary({ id: "row-2", status: "voided", verified: true });
    const [row] = merge([inst({ external_envelopes: [a, b] } as Partial<FormInstanceRow>)]);
    expect(row.external_envelopes!.map((e) => e.id)).toEqual(["row-1", "row-2"]);
  });

  it("[XPT-5] the list comes from the instance the mapper CHOSE", () => {
    // mergeDocuments keeps the most-recent instance per form_id. The envelope
    // list must come from that same row, not from whichever was seen first.
    const older = inst({
      id: "older", updated_at: "2026-10-01T00:00:00Z",
      external_envelopes: [summary({ id: "from-older" })],
    } as Partial<FormInstanceRow>);
    const newer = inst({
      id: "newer", updated_at: "2026-10-30T00:00:00Z",
      external_envelopes: [summary({ id: "from-newer" })],
    } as Partial<FormInstanceRow>);
    const [row] = merge([older, newer]);
    expect(row.external_envelopes!.map((e) => e.id)).toEqual(["from-newer"]);
  });
});
