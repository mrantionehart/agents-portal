// ============================================================================
// The Ring · Listing Agent Practice (Agent Portal)
// ============================================================================
// Developmental practice for the LISTING AGENT Ring program — explicitly NOT
// the Acquisition default. The learner picks a conversation type (FSBO /
// Divorce / Relocation) and a difficulty (Beginner / Intermediate / Advanced);
// each tile starts that specific Vault scenario via text prepare. Reuses the
// same RingExperience (briefing / conversation / coaching) and the agent's own
// session + certification assignment for authorization. mode='practice'
// server-side — never counts toward certification. DARK: text practice is
// flag-gated off in Vault, so a round starts only once that flag is enabled.
// ============================================================================

"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { LISTING_CERTIFICATION_ID } from "@/lib/ring/vault-ring-client";
import { RingExperience } from "../_components/ring-experience";
import { LISTING_THEMES } from "../_lib/listing-themes";

export default function RingListingPracticePage() {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <Link href="/the-ring" className="mb-4 inline-flex items-center gap-1 text-sm text-[#71717A] hover:text-[#A1A1AA]">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> The Ring
      </Link>
      <RingExperience certificationId={LISTING_CERTIFICATION_ID} themes={LISTING_THEMES} />
    </div>
  );
}
