// ============================================================================
// Slice 2 Phase 3B-4 · "Prepare for signing" CTA (Server Component)
// ============================================================================
// Renders NOTHING when AP_SIGNING_COMPOSER_ENABLED is OFF — the existing
// transaction UI is byte-identical to before this slice (spec §5).
// When ON, renders a link to the composer route for the given transaction.
//
// This is a Server Component: the flag check runs at render time and the
// component itself never reaches the client bundle when it returns null.
// ============================================================================

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { isSigningComposerEnabled } from "@/lib/signing/composer-flag";

interface PrepareForSigningCTAProps {
  readonly transactionId: string;
}

export default function PrepareForSigningCTA({ transactionId }: PrepareForSigningCTAProps) {
  if (!isSigningComposerEnabled()) return null;
  return (
    <Link
      href={`/signing/transactions/${encodeURIComponent(transactionId)}/compose`}
      className="text-[#E8D5A3] hover:underline inline-flex items-center gap-1"
    >
      Prepare for signing <ArrowRight className="h-3 w-3" />
    </Link>
  );
}
