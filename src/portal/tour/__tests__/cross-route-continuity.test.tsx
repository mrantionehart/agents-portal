// ============================================================================
// AP2 tour — cross-route continuity
// ============================================================================
// Exercises the tour progressing through a route change with a target
// that is not present until AFTER the route "changes". The rendered
// harness plays the role of the AP2 layout: it keeps <TourProvider>
// mounted through both pages, and mounts the destination component
// with an anchor only after the pathname simulates a change.
//
// Proves:
//   * route_change step waits for the actual pathname to match
//   * missing target during transition renders the fallback (not
//     auto-advance)
//   * once the destination target mounts, the tour repositions and can
//     advance via the target_click step
// ============================================================================

import {
  render,
  screen,
  fireEvent,
  act,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";

import { TourProvider, useTour } from "../TourProvider";
import { TourRunner } from "../TourRunner";

jest.mock("../api", () => ({
  fetchTourScript: jest.fn(),
  submitTourCompletion: jest.fn(),
  TourApiError: class extends Error {},
}));

// Mutable pathname mock so we can simulate a Next.js route change.
let mockPath = "/notifications";
jest.mock("next/navigation", () => ({
  usePathname: () => mockPath,
}));

import { fetchTourScript } from "../api";
const mockFetch = fetchTourScript as jest.MockedFunction<typeof fetchTourScript>;

// A script modeled on pcert-l03 notifications→settings transition.
const SCRIPT_CROSS_ROUTE = {
  id: "portal.foundations.notifications-profile",
  lessonId: "pcert-l03",
  certificationId: "hartfelt-platform-certified",
  scriptVersion: "1.0.0",
  steps: [
    {
      id: "notif-inbox",
      order: 1,
      targetId: "portal.notifications.inbox",
      title: "Your inbox",
      bodyContent: [{ type: "paragraph", text: "Look at the inbox." }],
      placement: "left",
      interaction: { kind: "informational" },
      optional: false,
    },
    {
      id: "settings-click",
      order: 2,
      targetId: "portal.navigation.settings",
      title: "Open Settings",
      bodyContent: [{ type: "paragraph", text: "Click Settings." }],
      placement: "right",
      interaction: {
        kind: "target_click",
        targetId: "portal.navigation.settings",
      },
      optional: false,
    },
    {
      id: "settings-route",
      order: 3,
      targetId: null,
      title: "Loading settings",
      bodyContent: [{ type: "paragraph", text: "Loading." }],
      placement: "center",
      interaction: { kind: "route_change", expectedRoute: "/settings" },
      optional: false,
    },
    {
      id: "settings-profile",
      order: 4,
      targetId: "portal.settings.profile",
      title: "Your profile",
      bodyContent: [{ type: "paragraph", text: "This is your profile card." }],
      placement: "top",
      interaction: { kind: "informational" },
      optional: false,
    },
  ],
};

// Layout harness — TourProvider stays mounted across "page" changes.
// Emulates AP2's (portal) layout.
function LayoutHarness() {
  const [page, setPage] = useState<"notifications" | "settings">("notifications");

  return (
    <TourProvider>
      <div>
        {/* Sidebar link with settings anchor (persistent) */}
        <a
          href="/settings"
          data-training-id="portal.navigation.settings"
          data-testid="nav-settings"
          onClick={(e) => {
            e.preventDefault();
            // Change pathname + mount destination TOGETHER, after a
            // delay. Proves the tour tolerates delayed navigation and
            // does not auto-advance the route_change step until the
            // pathname really matches.
            setTimeout(() => {
              mockPath = "/settings";
              setPage("settings");
            }, 40);
          }}
        >
          Settings
        </a>

        {/* "Page" content */}
        {page === "notifications" && (
          <div data-testid="page-notifications">
            <div data-training-id="portal.notifications.inbox">Inbox</div>
          </div>
        )}
        {page === "settings" && (
          <div data-testid="page-settings">
            <div data-training-id="portal.settings.profile">Profile card</div>
          </div>
        )}
      </div>
      <TourRunner />
      <Starter />
    </TourProvider>
  );
}

function Starter() {
  const t = useTour();
  return (
    <button
      data-testid="start"
      onClick={() =>
        t.start({
          certificationId: "hartfelt-platform-certified",
          lessonId: "pcert-l03",
          preview: true,
        })
      }
    >
      start
    </button>
  );
}

beforeEach(() => {
  mockFetch.mockReset();
  mockPath = "/notifications";
  window.localStorage.clear();
  window.sessionStorage.clear();
  mockFetch.mockResolvedValue({
    script: SCRIPT_CROSS_ROUTE as unknown as Awaited<ReturnType<typeof mockFetch>>["script"],
    mode: "preview",
    moduleStatus: "draft",
  } as Awaited<ReturnType<typeof mockFetch>>);
});

describe("cross-route continuity — pcert-l03 flow", () => {
  it("survives notifications→settings navigation with delayed target mount and never auto-advances on transition", async () => {
    render(<LayoutHarness />);

    await act(async () => fireEvent.click(screen.getByTestId("start")));

    // Step 1 — inbox
    expect(screen.getByText("Your inbox")).toBeInTheDocument();

    // Advance to step 2 — target_click on Settings
    await act(async () => fireEvent.click(screen.getByText("Next")));
    expect(screen.getByText("Open Settings")).toBeInTheDocument();

    // Click the Settings nav — triggers pathname change AND delayed
    // destination-page mount.
    await act(async () => fireEvent.click(screen.getByTestId("nav-settings")));

    // Immediately after the click, the target_click step advanced
    // (nav-settings carries the anchor and was clicked). We are now
    // on step 3 (route_change).
    expect(screen.getByText("Loading settings")).toBeInTheDocument();

    // Pathname is /settings but the destination component has not
    // mounted yet. The engine should NOT auto-advance the informational
    // final step nor mark the tour completed.
    // In the interval before the page swap, the last step's target
    // (portal.settings.profile) is not yet in the DOM.
    expect(screen.queryByText("Your profile")).toBeNull();
    expect(
      screen.queryByText("Preview complete. No progress was saved."),
    ).toBeNull();

    // Wait for delayed page mount + route_change effect to fire.
    await waitFor(() => {
      expect(screen.getByTestId("page-settings")).toBeInTheDocument();
    });
    // Route matched → step 3 advances → step 4 renders.
    await waitFor(() => {
      expect(screen.getByText("Your profile")).toBeInTheDocument();
    });

    // Anchor for step 4 is now present in the DOM.
    const target = document.querySelector(
      '[data-training-id="portal.settings.profile"]',
    );
    expect(target).not.toBeNull();

    // Missing-target fallback did NOT appear at any point during
    // navigation. The tour smoothly progressed.
    expect(
      screen.queryByText(/Element not found on this screen/),
    ).toBeNull();
  });
});
