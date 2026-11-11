// /training/property-intelligence/[cert] — one PDI course. Only allowlisted ids render.
import { notFound } from "next/navigation";

import PdiCourseClient from "@/src/portal/training/pdi/PdiCourseClient";
import { resolvePdiCertificationId } from "@/src/portal/training/pdi/pdi-config";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ cert: string }> }) {
  const { cert } = await params;
  const id = resolvePdiCertificationId(decodeURIComponent(cert));
  if (!id) notFound();
  return <PdiCourseClient certificationId={id} />;
}
