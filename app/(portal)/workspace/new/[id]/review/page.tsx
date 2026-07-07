// ============================================================================
// TRANSACTION OS 3.3E — /workspace/new/[id]/review → thin redirect
// ============================================================================
// Package Review moved into the workspace as a tab (Transaction OS 3.3E). This
// legacy route (3.3C) is kept only for compatibility with any existing links /
// bookmarks — it permanently redirects to the workspace package tab, where the
// real PackageReview now renders.
// ============================================================================

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LegacyPackageReviewRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/workspace/${id}?tab=package`);
}
