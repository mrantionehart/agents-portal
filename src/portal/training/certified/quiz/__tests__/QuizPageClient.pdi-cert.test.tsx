// The quiz page addresses a PDI program ONLY via an allowlisted `?cert=`.
// Without it (or with any other id) the platform certification's exact
// default calls are unchanged — regression guard for the existing flow.
let mockSearch = new URLSearchParams();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn(), prefetch: jest.fn() }),
  useSearchParams: () => mockSearch,
}));
jest.mock("@/src/portal/training/certified/api", () => {
  class CertApiError extends Error {
    status: number; code: string | null; detail: unknown;
    constructor(m: string, s: number, c: string | null, d: unknown) { super(m); this.status = s; this.code = c; this.detail = d; }
  }
  return { fetchCatalog: jest.fn(), fetchLearnerSafeQuiz: jest.fn(), submitQuizAttempt: jest.fn(), CertApiError };
});

import { render, waitFor } from "@testing-library/react";

import QuizPageClient from "../QuizPageClient";
import * as api from "@/src/portal/training/certified/api";

const fetchCatalog = api.fetchCatalog as jest.Mock;
const fetchQuiz = api.fetchLearnerSafeQuiz as jest.Mock;
const PDI = "hartfelt-real-estate-pdi-ownership-fl";

beforeEach(() => {
  fetchCatalog.mockReset().mockResolvedValue({ certification_id: "x", version: "1", tracks: [] });
  fetchQuiz.mockReset().mockResolvedValue({ quiz: null });
});

it("default (no cert): calls Vault exactly as before", async () => {
  mockSearch = new URLSearchParams("lesson=pcert-l12");
  render(<QuizPageClient />);
  await waitFor(() => expect(fetchCatalog).toHaveBeenCalled());
  expect(fetchCatalog).toHaveBeenCalledWith();
  expect(fetchQuiz).toHaveBeenCalledWith({ lessonId: "pcert-l12" });
});

it("allowlisted PDI cert: addresses the PDI program", async () => {
  mockSearch = new URLSearchParams(`lesson=pdi1-l1101&cert=${PDI}`);
  render(<QuizPageClient />);
  await waitFor(() => expect(fetchCatalog).toHaveBeenCalled());
  expect(fetchCatalog).toHaveBeenCalledWith(PDI);
  expect(fetchQuiz).toHaveBeenCalledWith({ lessonId: "pdi1-l1101", certificationId: PDI });
});

it("any other cert id is ignored (falls back to the default program)", async () => {
  mockSearch = new URLSearchParams("lesson=bpo-l1601&cert=hartfelt-real-estate-bpo-fl-certified");
  render(<QuizPageClient />);
  await waitFor(() => expect(fetchCatalog).toHaveBeenCalled());
  expect(fetchCatalog).toHaveBeenCalledWith();
  expect(fetchQuiz).toHaveBeenCalledWith({ lessonId: "bpo-l1601" });
});
