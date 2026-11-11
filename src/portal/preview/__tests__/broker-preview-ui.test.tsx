// ============================================================================
// Broker Preview Agent View — layout wiring + banner (mounted)
// ============================================================================
// Mounts the real PortalLayout and asserts WHO sees the banner: a broker-tier
// viewer arriving with ?preview=1 while the capability is enabled — and NOBODY
// else (agent, flag off). Also asserts the entry audit fires and the banner
// offers a return-to-Vault control. Denied-role coverage per UX-DONE-1.
// ============================================================================

import { render, screen, waitFor } from "@testing-library/react";

let mockAuth: { user: unknown; role: string | null; loading: boolean } = {
  user: { email: "mrhart@hartfeltrealestate.com" },
  role: "broker",
  loading: false,
};
const authFetchMock = jest.fn(() => Promise.resolve({ status: 200, json: async () => ({}) } as unknown as Response));

jest.mock("../../../../app/providers", () => ({ useAuth: () => mockAuth }));
jest.mock("next/navigation", () => ({ useRouter: () => ({ replace: jest.fn() }) }));
jest.mock("@/lib/supabase", () => ({ authFetch: (...a: unknown[]) => authFetchMock(...a) }));
jest.mock("@/src/portal/Sidebar", () => ({ __esModule: true, default: () => <div data-testid="sidebar" /> }));
jest.mock("@/src/portal/TopBar", () => ({ __esModule: true, default: () => <div data-testid="topbar" /> }));
jest.mock("@/src/portal/CommandBar", () => ({ __esModule: true, default: () => <div data-testid="commandbar" /> }));
jest.mock("@/src/portal/tour/TourProvider", () => ({ TourProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
jest.mock("@/src/portal/tour/TourRunner", () => ({ TourRunner: () => null }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const PortalLayout = require("../../../../app/(portal)/layout").default;

const FLAG = "NEXT_PUBLIC_BROKER_PREVIEW_ENABLED";
const prev = process.env[FLAG];

function setUrl(search: string) {
  window.history.replaceState({}, "", "/home" + search);
}

afterEach(() => {
  authFetchMock.mockClear();
  try { window.sessionStorage.clear(); } catch { /* ignore */ }
  if (prev === undefined) delete process.env[FLAG]; else process.env[FLAG] = prev;
  mockAuth = { user: { email: "x" }, role: "broker", loading: false };
  setUrl("");
});

describe("Broker Preview banner visibility", () => {
  it("shows for a broker arriving with ?preview=1 while the capability is enabled", async () => {
    process.env[FLAG] = "true";
    mockAuth = { user: { email: "mrhart@hartfeltrealestate.com" }, role: "broker", loading: false };
    setUrl("?preview=1");
    render(<PortalLayout><div>child</div></PortalLayout>);
    const banner = await screen.findByTestId("broker-preview-banner");
    expect(banner).toBeInTheDocument();
    expect(screen.getByText(/Broker Preview Mode/i)).toBeInTheDocument();
    // Return-to-Vault control present.
    expect(screen.getByRole("link", { name: /Return to Vault/i })).toBeInTheDocument();
    // Entry audit fired once.
    await waitFor(() =>
      expect(authFetchMock).toHaveBeenCalledWith(
        "/api/broker/preview-session",
        expect.objectContaining({ method: "POST" }),
      ),
    );
  });

  it("does NOT show for an AGENT even with ?preview=1 and the flag on (denied role)", async () => {
    process.env[FLAG] = "true";
    mockAuth = { user: { email: "agent@x" }, role: "agent", loading: false };
    setUrl("?preview=1");
    render(<PortalLayout><div>child</div></PortalLayout>);
    // Let effects run, then assert absence.
    await screen.findByTestId("topbar");
    expect(screen.queryByTestId("broker-preview-banner")).toBeNull();
    expect(authFetchMock).not.toHaveBeenCalled();
  });

  it("does NOT show when the capability flag is OFF (dark), even for a broker with ?preview=1", async () => {
    delete process.env[FLAG];
    mockAuth = { user: { email: "mrhart@x" }, role: "broker", loading: false };
    setUrl("?preview=1");
    render(<PortalLayout><div>child</div></PortalLayout>);
    await screen.findByTestId("topbar");
    expect(screen.queryByTestId("broker-preview-banner")).toBeNull();
    expect(authFetchMock).not.toHaveBeenCalled();
  });

  it("does NOT show in normal (no ?preview) broker browsing", async () => {
    process.env[FLAG] = "true";
    mockAuth = { user: { email: "mrhart@x" }, role: "broker", loading: false };
    setUrl("");
    render(<PortalLayout><div>child</div></PortalLayout>);
    await screen.findByTestId("topbar");
    expect(screen.queryByTestId("broker-preview-banner")).toBeNull();
  });
});
