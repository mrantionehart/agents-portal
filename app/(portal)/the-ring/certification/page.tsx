// ============================================================================
// COMM-1C — The Ring · Seller Lead Certification (Agent Portal)
// ============================================================================
// Shows the agent their authoritative certification progress and (when the
// assessment flag is on) lets them start/continue a certification assessment.
// DARK-safe: with the flag off, progress still loads and the CTA is an honest
// "coming soon" note. Issuance is never faked here — Vault owns that.
// ============================================================================

"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { SellerCertificationCard } from "../_components/seller-certification-card";

export default function SellerCertificationPage() {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <Link href="/the-ring" className="mb-4 inline-flex items-center gap-1 text-sm text-[#71717A] hover:text-[#A1A1AA]">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> The Ring
      </Link>
      <h1 className="text-2xl font-semibold text-[#F1F1F3]">Seller Lead Certification</h1>
      <p className="mt-1 mb-6 max-w-xl text-sm text-[#A1A1AA]">
        Earn your Seller Lead Certification by passing a controlled certification assessment for each required
        competency. Each requirement is earned independently — a strong round in one area never fills in for
        another, and ordinary practice does not count toward certification.
      </p>
      <SellerCertificationCard />
    </div>
  );
}
