// ============================================================================
// Matrix Simulator — Practice (Agent Portal)
// ============================================================================
"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { MatrixExperience } from "../_components/matrix-experience";

export default function MatrixPracticePage() {
  // ?preview=1 → broker preview mode (write-nothing; the server endpoints are
  // broker-tier, so a non-broker is refused there regardless of this flag).
  const preview = useSearchParams().get("preview") === "1";
  return (
    <div className="mx-auto w-full max-w-2xl">
      <Link
        href={preview ? "/the-matrix?preview=1" : "/the-matrix"}
        className="mb-4 inline-flex items-center gap-1 text-sm text-[#6b8577] hover:text-[#9db3a6]"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Matrix Simulator
      </Link>
      <MatrixExperience preview={preview} />
    </div>
  );
}
