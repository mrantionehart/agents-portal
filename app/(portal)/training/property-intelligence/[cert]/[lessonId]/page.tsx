// /training/property-intelligence/[cert]/[lessonId] — a PDI lesson or the graded practical.
import { notFound } from "next/navigation";

import PdiLessonClient from "@/src/portal/training/pdi/PdiLessonClient";
import { resolvePdiCertificationId } from "@/src/portal/training/pdi/pdi-config";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ cert: string; lessonId: string }> }) {
  const { cert, lessonId } = await params;
  const id = resolvePdiCertificationId(decodeURIComponent(cert));
  if (!id || !/^pdi[1-3]-l\d{4}$/.test(lessonId)) notFound();
  return <PdiLessonClient certificationId={id} lessonId={lessonId} />;
}
