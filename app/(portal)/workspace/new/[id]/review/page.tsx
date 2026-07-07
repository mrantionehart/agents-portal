// ============================================================================
// TRANSACTION OS 3.3C — /workspace/new/[id]/review (Package Review)
// ============================================================================
// Server component: reads the user's session from the cookie jar, fetches the
// read-only package plan from Vault, and renders the client Package Review. The
// wizard (3.3B.3D) redirects here after creating a draft. No mutation, no
// generation.
// ============================================================================

import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { AlertCircle } from "lucide-react";

import { fetchPackageReview } from "@/src/portal/workspace/new/review/api";
import PackageReview from "@/src/portal/workspace/new/review/PackageReview";

export const dynamic = "force-dynamic";

export default async function PackageReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(_n: string, _v: string, _o: CookieOptions) {},
        remove(_n: string, _o: CookieOptions) {},
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return <ReviewError message="Your session has expired. Please sign in again." />;
  }

  const result = await fetchPackageReview({
    accessToken: session.access_token,
    transactionId: id,
  });

  if (result.ok === true) {
    return <PackageReview data={result.data} transactionId={id} />;
  }

  // Error variant (success returned above). Read defensively — the isolated
  // type-check mis-narrows this cross-module discriminated union.
  const err = result as { status: number; message: string };
  return (
    <ReviewError
      message={`Couldn't load the package (${err.status}). ${err.message}`}
    />
  );
}

function ReviewError({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-[860px]">
      <div
        role="alert"
        className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4"
      >
        <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-400" />
        <p className="text-sm text-red-400">{message}</p>
      </div>
    </div>
  );
}
