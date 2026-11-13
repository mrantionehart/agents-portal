// ============================================================================
// V4 UNIFIED LEARNER EXPERIENCE — /training/certified/[trackId] track page
// ============================================================================
// Server shell that renders the track lesson list. Data fetch happens
// client-side via the Vault catalog + progress endpoints (both gated by the
// caller's Supabase Bearer). The AP is a renderer here — Vault is the
// system of record for what lessons a track contains and their status.
// ============================================================================

import { Suspense } from "react";

import CertifiedTrackClient from "@/src/portal/training/certified/CertifiedTrackClient";
import { resolveProgramParam } from "@/src/portal/training/certified/program";

export const dynamic = "force-dynamic";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ trackId: string }>;
  searchParams?: Promise<{ program?: string | string[] }>;
}) {
  // Allowlisted program selector. Unknown → not found (never another program).
  const rawProgram = (await searchParams)?.program;
  const certificationId = resolveProgramParam(Array.isArray(rawProgram) ? rawProgram[0] : rawProgram);
  if (!certificationId) {
    return (
      <div className="max-w-[720px] mx-auto rounded border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300" data-cert-unknown-program>
        This training is not available.
      </div>
    );
  }
  const { trackId } = await params;
  return (
    <Suspense
      fallback={
        <div className="max-w-[720px] mx-auto py-16 text-center text-sm text-[#71717A]">
          Loading track…
        </div>
      }
    >
      <CertifiedTrackClient certificationId={certificationId} trackId={trackId} />
    </Suspense>
  );
}
