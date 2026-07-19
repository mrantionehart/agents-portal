// ============================================================================
// AP2 tour — Broker preview section V4 copy lock (Phase 3)
// ============================================================================
// Locks the post-publish copy of BrokerCertPreviewSection:
//   * Removes the stale "Volume 4 is in draft" claim (Vault §2 UPDATE
//     landed 2026-07-18).
//   * Removes the stale "Agents do not see any Volume 4 content" claim
//     — agents now see V4 via their own /training/certified pages.
//   * Preserves the non-writing invariant: non-broker callers render
//     nothing; the launcher never emits a completion write in preview mode.
// ============================================================================

// The mocks below must be declared BEFORE importing the module under test
// so jest.mock hoisting swaps them in before TourProvider's imports load.
jest.mock("../api", () => ({
  fetchTourScript: jest.fn(),
  submitTourCompletion: jest.fn(),
  TourApiError: class extends Error {},
}));
jest.mock("next/navigation", () => ({
  usePathname: () => "/training",
}));

import { render, screen } from "@testing-library/react";

import { BrokerCertPreviewSection } from "../BrokerCertPreviewSection";
import { TourProvider } from "../TourProvider";

describe("BrokerCertPreviewSection — V4 copy lock", () => {
  it("no longer references 'in draft'", () => {
    render(
      <TourProvider>
        <BrokerCertPreviewSection role="broker" userId="user-1" />
      </TourProvider>,
    );
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/in draft/i);
  });

  it("no longer claims agents cannot see Volume 4", () => {
    render(
      <TourProvider>
        <BrokerCertPreviewSection role="broker" userId="user-1" />
      </TourProvider>,
    );
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/agents do not see/i);
  });

  it("points brokers at the /training/certified surface as the learner destination", () => {
    render(
      <TourProvider>
        <BrokerCertPreviewSection role="broker" userId="user-1" />
      </TourProvider>,
    );
    const text = document.body.textContent ?? "";
    expect(text).toMatch(/\/training\/certified/);
  });

  it("still preserves the preview / no-writes chip", () => {
    render(
      <TourProvider>
        <BrokerCertPreviewSection role="broker" userId="user-1" />
      </TourProvider>,
    );
    expect(
      screen.getByText(/progress will not be saved/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/no completion write is sent/i),
    ).toBeInTheDocument();
  });

  it("renders nothing for non-broker roles (agents see V4 via /training/certified instead)", () => {
    for (const role of ["agent", null, undefined]) {
      const { container } = render(
        <TourProvider>
          <BrokerCertPreviewSection role={role as string | null | undefined} userId="user-1" />
        </TourProvider>,
      );
      expect(container.textContent).toBe("");
    }
  });
});
