// Entry point: the existing Broker Preview section surfaces the Matrix
// broker-preview launchers for a broker, and renders NOTHING for a denied role.
import { render, screen } from "@testing-library/react";

// Stub the tour launcher (its own suite covers it); we only test the Matrix block + gate.
jest.mock("../BrokerPreviewLauncher", () => ({
  __esModule: true,
  BrokerPreviewLauncher: () => <button type="button">tour-launcher</button>,
}));

import { BrokerCertPreviewSection } from "../BrokerCertPreviewSection";

describe("BrokerCertPreviewSection — Matrix broker-preview entry point", () => {
  it("a broker sees the Matrix preview launchers linking to ?preview=1", () => {
    render(<BrokerCertPreviewSection role="broker" userId="b1" />);
    expect(screen.getByText(/Matrix Simulator — broker preview/i)).toBeInTheDocument();
    const launches = screen.getAllByTestId("matrix-broker-preview-launch");
    expect(launches.length).toBe(2);
    const hrefs = launches.map((a) => a.getAttribute("href"));
    expect(hrefs).toContain("/the-matrix/quiz?preview=1");
    expect(hrefs).toContain("/the-matrix/practice?preview=1");
  });

  it("office_manager (broker tier) also sees it", () => {
    render(<BrokerCertPreviewSection role="office_manager" userId="om1" />);
    expect(screen.getAllByTestId("matrix-broker-preview-launch").length).toBe(2);
  });

  it("a denied role (agent) sees NOTHING — no section, no Matrix launchers", () => {
    const { container } = render(<BrokerCertPreviewSection role="agent" userId="a1" />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId("matrix-broker-preview-launch")).not.toBeInTheDocument();
  });
});
