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

export const dynamic = "force-dynamic";

export default async function Page({
  params,
}: {
  params: Promise<{ trackId: string }>;
}) {
  const { trackId } = await params;
  return (
    <Suspense
      fallback={
        <div className="max-w-[720px] mx-auto py-16 text-center text-sm text-[#71717A]">
          Loading track…
        </div>
      }
    >
      <CertifiedTrackClient trackId={trackId} />
    </Suspense>
  );
}
