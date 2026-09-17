// COMM-1C — the Portal assessment posture defaults OFF (dark-honest).

import { assessmentEntryEnabled } from "../_lib/ring-flags";

describe("assessmentEntryEnabled", () => {
  const KEY = "NEXT_PUBLIC_RING_SELLER_CERT_ASSESSMENT_ENABLED";
  const prev = process.env[KEY];
  afterEach(() => {
    if (prev === undefined) delete process.env[KEY];
    else process.env[KEY] = prev;
  });

  it("defaults OFF when unset", () => {
    delete process.env[KEY];
    expect(assessmentEntryEnabled()).toBe(false);
  });
  it('OFF for any value other than exactly "true"', () => {
    process.env[KEY] = "1";
    expect(assessmentEntryEnabled()).toBe(false);
    process.env[KEY] = "TRUE";
    expect(assessmentEntryEnabled()).toBe(false);
  });
  it('ON only for exactly "true"', () => {
    process.env[KEY] = "true";
    expect(assessmentEntryEnabled()).toBe(true);
  });
});
