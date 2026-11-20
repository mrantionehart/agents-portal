// LEAD-DISPO-QA — the bell links to Notifications and shows the unread count;
// a failed count hides the badge but keeps the link.
import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import * as fs from "fs";
import * as path from "path";

const H: { count: number | null } = { count: 3 };
jest.mock("@/app/providers", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
jest.mock("../useUnreadNotificationCount", () => ({ useUnreadNotificationCount: () => H.count }));
jest.mock("../ai/use-ask-enabled", () => ({ useAskEnabled: () => false }));
jest.mock("../ai/AIChatPanel", () => ({ __esModule: true, default: () => null }));

import TopBar from "../TopBar";

describe("[LEAD-DISPO-QA] TopBar notification bell", () => {
  it("links to /notifications with the unread count in the badge and the label", async () => {
    H.count = 3;
    render(<TopBar userName="A" userEmail="a@x.test" role="agent" />);
    const link = screen.getByTestId("topbar-notifications");
    expect(link).toHaveAttribute("href", "/notifications");
    expect(link).toHaveAttribute("aria-label", "Notifications, 3 unread");
    expect(screen.getByTestId("topbar-unread")).toHaveTextContent("3");
  });
  it("no badge when zero or when the count could not be read — the link remains", () => {
    for (const c of [0, null]) {
      H.count = c;
      const { unmount } = render(<TopBar userName="A" userEmail="a@x.test" role="agent" />);
      expect(screen.queryByTestId("topbar-unread")).toBeNull();
      expect(screen.getByTestId("topbar-notifications")).toHaveAttribute("href", "/notifications");
      unmount();
    }
  });
  it("caps the badge at 99+", () => {
    H.count = 250;
    render(<TopBar userName="A" userEmail="a@x.test" role="agent" />);
    expect(screen.getByTestId("topbar-unread")).toHaveTextContent("99+");
  });
});

