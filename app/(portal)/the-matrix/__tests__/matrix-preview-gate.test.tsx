// Access denial for the Matrix broker preview (?preview=1). Broker tier sees
// the preview (children); an agent sees a clean "broker only" denial; while the
// session is loading, neither is shown. The HARD boundary is the server's
// broker-tier preview endpoints — this gate is the UI affordance for denial.
import { render, screen } from "@testing-library/react";

let ROLE: string | null = null;
let LOADING = false;
jest.mock("../../../providers", () => ({
  __esModule: true,
  useAuth: () => ({ role: ROLE, loading: LOADING }),
}));

import { MatrixPreviewGate } from "../_components/matrix-preview-gate";

afterEach(() => { ROLE = null; LOADING = false; });

function child() { return <div data-testid="preview-child">PREVIEW</div>; }

describe("MatrixPreviewGate", () => {
  it.each(["broker", "admin", "office_manager"])("%s (broker tier) sees the preview", (role) => {
    ROLE = role; LOADING = false;
    render(<MatrixPreviewGate>{child()}</MatrixPreviewGate>);
    expect(screen.getByTestId("preview-child")).toBeInTheDocument();
    expect(screen.queryByTestId("matrix-preview-denied")).not.toBeInTheDocument();
  });

  it.each(["agent", "new_agent", "tc", "internal_staff"])("%s (denied) sees a broker-only denial, NOT the preview", (role) => {
    ROLE = role; LOADING = false;
    render(<MatrixPreviewGate>{child()}</MatrixPreviewGate>);
    expect(screen.getByTestId("matrix-preview-denied")).toHaveTextContent(/broker-only/i);
    expect(screen.queryByTestId("preview-child")).not.toBeInTheDocument();
  });

  it("while loading, shows neither the preview nor a premature denial", () => {
    ROLE = null; LOADING = true;
    render(<MatrixPreviewGate>{child()}</MatrixPreviewGate>);
    expect(screen.getByTestId("matrix-preview-gate-loading")).toBeInTheDocument();
    expect(screen.queryByTestId("preview-child")).not.toBeInTheDocument();
    expect(screen.queryByTestId("matrix-preview-denied")).not.toBeInTheDocument();
  });

  it("a null role (resolved, not loading) is denied — fail closed", () => {
    ROLE = null; LOADING = false;
    render(<MatrixPreviewGate>{child()}</MatrixPreviewGate>);
    expect(screen.getByTestId("matrix-preview-denied")).toBeInTheDocument();
  });
});
