// ============================================================================
// Slice 2 Phase 3B-4 · Signing package status — SERVER wrapper
// ============================================================================
// Thin Server Component that reads the AP_SIGNING_COMPOSER_ENABLED flag
// and passes the resolved boolean into PackageStatusClient. When the flag
// is OFF, the client hides the "Revise package" affordance (falling back
// to the 3B-3.5 "not yet available" copy). When ON, the client renders
// the revision link that navigates to the composer with previous_package_id.
//
// The 3B-3.5 shape (unified unavailable UX, no distinguishing 403/404,
// broker-only field stripping) is preserved end-to-end — this wrapper
// only injects one boolean prop.
// ============================================================================

import { use } from "react";

import { isSigningComposerEnabled } from "@/lib/signing/composer-flag";
import PackageStatusClient from "./PackageStatusClient";

interface PageProps {
  readonly params: Promise<{ packageId: string }>;
}

export default function SigningPackageStatusPage({ params }: PageProps) {
  const { packageId } = use(params);
  const composerEnabled = isSigningComposerEnabled();
  return (
    <PackageStatusClient
      packageId={packageId}
      composerEnabled={composerEnabled}
    />
  );
}
