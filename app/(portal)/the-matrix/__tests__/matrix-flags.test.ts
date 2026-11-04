import { matrixSimulatorEnabled } from "../_lib/matrix-flags";

const F = "NEXT_PUBLIC_MATRIX_SIMULATOR_ENABLED";
const prev = process.env[F];
afterEach(() => { if (prev === undefined) delete process.env[F]; else process.env[F] = prev; });

describe("matrixSimulatorEnabled", () => {
  it("is OFF by default", () => { delete process.env[F]; expect(matrixSimulatorEnabled()).toBe(false); });
  it("is OFF for any value other than exact 'true'", () => {
    process.env[F] = "1"; expect(matrixSimulatorEnabled()).toBe(false);
    process.env[F] = "TRUE"; expect(matrixSimulatorEnabled()).toBe(false);
  });
  it("is ON only for exact 'true'", () => { process.env[F] = "true"; expect(matrixSimulatorEnabled()).toBe(true); });
});
