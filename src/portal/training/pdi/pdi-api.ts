// ============================================================================
// PDI — Vault client (Bearer; Vault authorizes every call)
// ============================================================================

import { authedFetch, CertApiError, readErrorEnvelope } from "../certified/api";

export type RichText = string | readonly { text: string; style?: "bold" | "italic" | "code" }[];
export type TableCell = RichText | { content: RichText; colSpan?: number; rowSpan?: number; header?: boolean };
export type ContentBlock =
  | { kind: "paragraph"; text: RichText }
  | { kind: "heading"; text: RichText }
  | { kind: "list"; items: readonly RichText[] }
  | { kind: "ordered"; items: readonly RichText[] }
  | { kind: "quote"; text: RichText }
  | { kind: "callout"; title: RichText; text: RichText; variant?: string }
  | { kind: "comparison"; badLabel: string; bad: RichText; goodLabel: string; good: RichText }
  | { kind: "table"; caption?: string; headers?: readonly RichText[]; rows: readonly (readonly TableCell[])[] }
  | { kind: string; [k: string]: unknown };

export interface LessonContentResponse {
  lesson_id: string;
  certification_id: string;
  title: string;
  objective: string;
  blocks: ContentBlock[];
  requirements: string[];
  prerequisite_lesson_id: string | null;
}

const base = (cert: string, lessonId: string) =>
  `/platform/certifications/${encodeURIComponent(cert)}/lessons/${encodeURIComponent(lessonId)}`;

export async function fetchLessonContent(cert: string, lessonId: string): Promise<LessonContentResponse> {
  const res = await authedFetch(`${base(cert, lessonId)}/content`);
  if (!res.ok) await readErrorEnvelope(res, "fetchLessonContent");
  return (await res.json()) as LessonContentResponse;
}

export async function acknowledgeLesson(cert: string, lessonId: string): Promise<void> {
  const res = await authedFetch(`${base(cert, lessonId)}/complete`, {
    method: "POST",
    body: JSON.stringify({ acknowledgement: true }),
  });
  if (!res.ok) await readErrorEnvelope(res, "acknowledgeLesson");
}

export interface ApprovedParcel {
  id: string;
  county: string;
  parcelReference: string;
  label: string | null;
  approvedAt: string;
}
export interface PracticalSubmission {
  id: string;
  submissionNumber: number;
  trainingParcelId: string;
  submittedAt: string;
  reportText: string;
}
export interface PracticalSubmissionState {
  certification_id: string;
  lesson_id: string;
  max_submissions: number;
  approved_parcels: ApprovedParcel[];
  submissions: PracticalSubmission[];
}

export async function fetchPracticalSubmissions(cert: string, lessonId: string): Promise<PracticalSubmissionState> {
  const res = await authedFetch(`${base(cert, lessonId)}/practical-submission`);
  if (!res.ok) await readErrorEnvelope(res, "fetchPracticalSubmissions");
  return (await res.json()) as PracticalSubmissionState;
}

/** POST a practical report. Vault's error envelope here is `{ error: <code> }`. */
export async function submitPractical(
  cert: string,
  lessonId: string,
  body: { training_parcel_id: string; report_text: string },
): Promise<PracticalSubmission> {
  const res = await authedFetch(`${base(cert, lessonId)}/practical-submission`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let code: string | null = null;
    try {
      const j = (await res.json()) as { error?: unknown; code?: unknown };
      code = typeof j.code === "string" ? j.code : typeof j.error === "string" ? j.error : null;
    } catch {
      code = null;
    }
    throw new CertApiError(`submitPractical (HTTP ${res.status})`, res.status, code, null);
  }
  return ((await res.json()) as { submission: PracticalSubmission }).submission;
}
