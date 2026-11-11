// PDI AP surfaces — entry card, landing page, course gating, quiz cert routing.
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn(), prefetch: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock("@/src/portal/training/certified/api", () => {
  class CertApiError extends Error {
    status: number; code: string | null; detail: unknown;
    constructor(m: string, s: number, c: string | null, d: unknown) { super(m); this.status = s; this.code = c; this.detail = d; }
  }
  return { fetchCatalog: jest.fn(), fetchProgress: jest.fn(), CertApiError, authedFetch: jest.fn(), readErrorEnvelope: jest.fn() };
});

import { render, screen, waitFor } from "@testing-library/react";

import * as api from "@/src/portal/training/certified/api";
import { PdiTrainingEntry } from "../PdiTrainingEntry";
import PdiLandingClient from "../PdiLandingClient";
import {
  PDI1_CERTIFICATION_ID,
  PDI2_CERTIFICATION_ID,
  PDI3_CERTIFICATION_ID,
  pdiQuizHref,
  resolvePdiCertificationId,
} from "../pdi-config";

const fetchCatalog = api.fetchCatalog as jest.MockedFunction<typeof api.fetchCatalog>;
const { CertApiError } = api as unknown as { CertApiError: new (m: string, s: number, c: string | null, d: unknown) => Error };
const FLAG = "NEXT_PUBLIC_PDI_TRAINING_ENABLED";

beforeEach(() => {
  fetchCatalog.mockReset();
  delete process.env[FLAG];
});

describe("PDI entry card on the Training hub", () => {
  it("renders nothing while the flag is off", () => {
    const { container } = render(<PdiTrainingEntry />);
    expect(container).toBeEmptyDOMElement();
  });
  it("links to the PDI landing page when the flag is on", () => {
    process.env[FLAG] = "true";
    render(<PdiTrainingEntry />);
    expect(screen.getByRole("link", { name: /Property & Development Intelligence/ })).toHaveAttribute(
      "href",
      "/training/property-intelligence",
    );
  });
});

describe("PDI landing page", () => {
  it("flag off: makes NO Vault call and shows the not-yet-available state", () => {
    render(<PdiLandingClient />);
    expect(screen.getByText("Not yet available")).toBeInTheDocument();
    expect(fetchCatalog).not.toHaveBeenCalled();
  });

  it("flag on: shows only the courses Vault serves (assigned), with labels and links", async () => {
    process.env[FLAG] = "true";
    fetchCatalog.mockImplementation(async (cert?: string) => {
      if (cert === PDI1_CERTIFICATION_ID) return { certification_id: cert, version: "1.0.0", tracks: [] };
      throw new CertApiError("Learning access denied", 403, "no_assignment", null);
    });
    render(<PdiLandingClient />);
    const link = await screen.findByRole("link", { name: /PDI-1 · Property Ownership & Folio Research/ });
    expect(link).toHaveAttribute("href", `/training/property-intelligence/${PDI1_CERTIFICATION_ID}`);
    expect(screen.getByText("Required for new agents")).toBeInTheDocument();
    expect(screen.queryByText(/PDI-2/)).not.toBeInTheDocument();
    expect(screen.queryByText(/PDI-3/)).not.toBeInTheDocument();
    expect(fetchCatalog.mock.calls.map((c) => c[0]).sort()).toEqual(
      [PDI1_CERTIFICATION_ID, PDI2_CERTIFICATION_ID, PDI3_CERTIFICATION_ID].sort(),
    );
  });

  it("flag on but unassigned everywhere: honest empty state, no course listed", async () => {
    process.env[FLAG] = "true";
    fetchCatalog.mockRejectedValue(new CertApiError("Learning access denied", 403, "no_assignment", null));
    render(<PdiLandingClient />);
    await waitFor(() => expect(fetchCatalog).toHaveBeenCalledTimes(3));
    expect(await screen.findByText("Not yet available")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /PDI-/ })).not.toBeInTheDocument();
  });

  it("optional courses show their prerequisite", async () => {
    process.env[FLAG] = "true";
    fetchCatalog.mockImplementation(async (cert?: string) => ({ certification_id: cert ?? "", version: "1.0.0", tracks: [] }));
    render(<PdiLandingClient />);
    expect(await screen.findByText("Requires the PDI-1 certification.")).toBeInTheDocument();
    expect(screen.getAllByText("Optional")).toHaveLength(2);
  });
});

describe("PDI certification-id allowlist", () => {
  it("accepts only the three PDI ids", () => {
    expect(resolvePdiCertificationId(PDI2_CERTIFICATION_ID)).toBe(PDI2_CERTIFICATION_ID);
    expect(resolvePdiCertificationId("hartfelt-platform-certified")).toBeNull();
    expect(resolvePdiCertificationId("hartfelt-real-estate-bpo-fl-certified")).toBeNull();
    expect(resolvePdiCertificationId(null)).toBeNull();
  });
  it("builds quiz links that carry the certification", () => {
    expect(pdiQuizHref(PDI1_CERTIFICATION_ID, "pdi1-l1101")).toBe(
      `/training/quiz?lesson=pdi1-l1101&cert=${PDI1_CERTIFICATION_ID}`,
    );
  });
});

import PdiCourseClient from "../PdiCourseClient";
const fetchProgress = api.fetchProgress as jest.MockedFunction<typeof api.fetchProgress>;

describe("PDI course page", () => {
  it("lists lessons; quiz lessons link to the quiz page carrying the cert", async () => {
    process.env[FLAG] = "true";
    fetchCatalog.mockResolvedValue({
      certification_id: PDI1_CERTIFICATION_ID, version: "1.0.0",
      tracks: [{ id: "pdi1-m01", lessons: [
        { id: "pdi1-l0101", title: "Parcels, Folios and PCNs", requires_quiz: false },
        { id: "pdi1-l1101", title: "Course Assessment", requires_quiz: true },
      ] }],
    } as never);
    fetchProgress.mockResolvedValue({ certification_id: PDI1_CERTIFICATION_ID, tracks: [] } as never);
    render(<PdiCourseClient certificationId={PDI1_CERTIFICATION_ID} />);
    expect(await screen.findByRole("link", { name: /Parcels, Folios and PCNs/ })).toHaveAttribute(
      "href", `/training/property-intelligence/${PDI1_CERTIFICATION_ID}/pdi1-l0101`);
    expect(screen.getByRole("link", { name: /Course Assessment/ })).toHaveAttribute(
      "href", `/training/quiz?lesson=pdi1-l1101&cert=${PDI1_CERTIFICATION_ID}`);
    expect(fetchCatalog).toHaveBeenCalledWith(PDI1_CERTIFICATION_ID);
  });

  it("an unassigned learner (403) sees not-yet-available", async () => {
    process.env[FLAG] = "true";
    fetchCatalog.mockRejectedValue(new CertApiError("denied", 403, "no_assignment", null));
    fetchProgress.mockRejectedValue(new CertApiError("denied", 403, "no_assignment", null));
    render(<PdiCourseClient certificationId={PDI1_CERTIFICATION_ID} />);
    expect(await screen.findByText("Not yet available")).toBeInTheDocument();
  });
});
