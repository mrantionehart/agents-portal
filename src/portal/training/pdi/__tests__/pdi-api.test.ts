// The PDI Vault client hits the right URLs with the right bodies (Bearer attached).
jest.mock("@/lib/supabase", () => ({ getAccessToken: jest.fn(async () => "tok") }));

import { fetchPracticalSubmissions, submitPractical } from "../pdi-api";

const CERT = "hartfelt-real-estate-pdi-zoning-fl";
const fetchMock = jest.fn();
beforeEach(() => {
  fetchMock.mockReset();
  (global as unknown as { fetch: jest.Mock }).fetch = fetchMock;
});

it("POSTs the practical to the lesson's practical-submission route", async () => {
  fetchMock.mockResolvedValue({ ok: true, status: 201, json: async () => ({ submission: { id: "s" } }) });
  await submitPractical(CERT, "pdi2-l1301", { training_parcel_id: "p", report_text: "r" });
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toMatch(new RegExp(`/platform/certifications/${CERT}/lessons/pdi2-l1301/practical-submission$`));
  expect(init.method).toBe("POST");
  expect(JSON.parse(init.body)).toEqual({ training_parcel_id: "p", report_text: "r" });
  expect(init.headers.Authorization).toBe("Bearer tok");
});

it("surfaces Vault's `{error: code}` envelope as the CertApiError code", async () => {
  fetchMock.mockResolvedValue({ ok: false, status: 409, json: async () => ({ error: "assessment_not_passed" }) });
  await expect(submitPractical(CERT, "pdi2-l1301", { training_parcel_id: "p", report_text: "r" })).rejects.toMatchObject({
    status: 409,
    code: "assessment_not_passed",
  });
});

it("GETs the learner's own submissions", async () => {
  fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ submissions: [] }) });
  await fetchPracticalSubmissions(CERT, "pdi2-l1301");
  expect(fetchMock.mock.calls[0][0]).toMatch(/lessons\/pdi2-l1301\/practical-submission$/);
  expect(fetchMock.mock.calls[0][1].method).toBeUndefined();
});
