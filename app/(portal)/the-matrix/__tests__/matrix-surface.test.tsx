/** Matrix Simulator overview surface — entry-point rendering test. */
import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("../_lib/matrix-flags", () => ({
  matrixSimulatorEnabled: jest.fn(() => true),
}));

import { matrixSimulatorEnabled } from "../_lib/matrix-flags";
import MatrixOverviewPage from "../page";

const mockedFlag = matrixSimulatorEnabled as jest.Mock;

describe("Matrix Simulator overview surface", () => {
  beforeEach(() => jest.clearAllMocks());

  it("shows the Knowledge Quiz entry card linking to /the-matrix/quiz when enabled", () => {
    mockedFlag.mockReturnValue(true);
    render(<MatrixOverviewPage />);
    const card = document.querySelector("[data-matrix-quiz-card]") as HTMLAnchorElement;
    expect(card).toBeInTheDocument();
    expect(card.getAttribute("href")).toBe("/the-matrix/quiz");
    expect(screen.getByText("Knowledge Quiz")).toBeInTheDocument();
    // The practical card is still present (not regressed).
    expect(screen.getByText("Rental Listing Practical")).toBeInTheDocument();
  });

  it("hides the cards behind a coming-soon state when disabled", () => {
    mockedFlag.mockReturnValue(false);
    render(<MatrixOverviewPage />);
    expect(screen.getByText(/Coming soon/i)).toBeInTheDocument();
    expect(document.querySelector("[data-matrix-quiz-card]")).toBeNull();
  });
});
