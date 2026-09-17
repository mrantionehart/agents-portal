// ============================================================================
// COMM-1C — The Ring · Practice (Agent Portal)
// ============================================================================
// Developmental practice. Renders the Ring conversation in practice mode (no
// assessment prop) — the learner starts a round, converses, and gets coaching.
// Practice is mode='practice' server-side and NEVER counts toward certification.
// ============================================================================

"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { RingExperience } from "../_components/ring-experience";

export default function RingPracticePage() {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <Link href="/the-ring" className="mb-4 inline-flex items-center gap-1 text-sm text-[#71717A] hover:text-[#A1A1AA]">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> The Ring
      </Link>
      <RingExperience />
    </div>
  );
}
