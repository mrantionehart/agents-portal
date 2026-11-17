// ============================================================================
// HartFelt Ready — Property & Development Intelligence (PDI) — AP config
// ============================================================================
// The AP is a renderer: Vault is the system of record for the PDI programs,
// their assignment gate, grading and Broker-of-Record approval. This file holds
// presentation metadata and the ONE allowlist of certification ids the PDI
// surfaces may address. Any other id is ignored, so a crafted `?cert=` can
// never point the certified flow at an arbitrary program.
//
// Dark by default: `NEXT_PUBLIC_PDI_TRAINING_ENABLED === "true"` turns the
// surfaces on. Even when on, a course shows only if Vault serves its catalog
// to this learner (a LIVE assignment; the programs are DRAFT and unassigned
// until the Broker of Record approves release).
// ============================================================================

export const PDI1_CERTIFICATION_ID = "hartfelt-real-estate-pdi-ownership-fl" as const;
export const PDI2_CERTIFICATION_ID = "hartfelt-real-estate-pdi-zoning-fl" as const;
export const PDI3_CERTIFICATION_ID = "hartfelt-real-estate-pdi-opportunity-fl" as const;

export const PDI_CATEGORY_LABEL = "Property & Development Intelligence" as const;

export interface PdiCourseMeta {
  readonly certificationId: string;
  readonly code: "PDI-1" | "PDI-2" | "PDI-3";
  readonly title: string;
  readonly requirement: "Required for new agents" | "Optional";
  readonly prerequisite: string | null;
  readonly practicalLessonId: string;
  readonly summary: string;
}

export const PDI_COURSES: readonly PdiCourseMeta[] = [
  {
    certificationId: PDI1_CERTIFICATION_ID,
    code: "PDI-1",
    title: "Property Ownership & Folio Research",
    requirement: "Required for new agents",
    prerequisite: null,
    practicalLessonId: "pdi1-l1201",
    summary: "Property appraiser searches, folios, owners of record, LLCs and Sunbiz, deeds, mortgages, taxes and exemptions.",
  },
  {
    certificationId: PDI2_CERTIFICATION_ID,
    code: "PDI-2",
    title: "Land, Zoning & Development Research",
    requirement: "Optional",
    prerequisite: "Requires the PDI-1 certification.",
    practicalLessonId: "pdi2-l1301",
    summary: "Future land use, zoning, density, FAR, setbacks, flood, utilities and environmental screens.",
  },
  {
    certificationId: PDI3_CERTIFICATION_ID,
    code: "PDI-3",
    title: "Investment & Development Opportunity Identification",
    requirement: "Optional",
    prerequisite: "Requires the PDI-1 and PDI-2 certifications. Completes the PDI certification.",
    practicalLessonId: "pdi3-l1201",
    summary: "Income screening, vacant land, redevelopment, assemblages and the Opportunity Brief.",
  },
];

const ALLOWED = new Set<string>(PDI_COURSES.map((c) => c.certificationId));

/** The PDI certification id for a raw value, or null for anything else. */
export function resolvePdiCertificationId(raw: string | null | undefined): string | null {
  return raw && ALLOWED.has(raw) ? raw : null;
}

export function pdiCourse(certificationId: string): PdiCourseMeta | null {
  return PDI_COURSES.find((c) => c.certificationId === certificationId) ?? null;
}

export function pdiTrainingEnabled(): boolean {
  return process.env.NEXT_PUBLIC_PDI_TRAINING_ENABLED === "true";
}

export function pdiLessonHref(certificationId: string, lessonId: string): string {
  return `/training/property-intelligence/${encodeURIComponent(certificationId)}/${encodeURIComponent(lessonId)}`;
}

export function pdiCourseHref(certificationId: string): string {
  return `/training/property-intelligence/${encodeURIComponent(certificationId)}`;
}

export function pdiQuizHref(certificationId: string, lessonId: string): string {
  return `/training/quiz?lesson=${encodeURIComponent(lessonId)}&cert=${encodeURIComponent(certificationId)}`;
}

export const PDI_STANDING_REMINDER =
  "Your research findings are preliminary public-record research. They are never an official zoning, title, valuation or development determination — only the governing jurisdiction or the licensed professional named in the lesson can make one.";
