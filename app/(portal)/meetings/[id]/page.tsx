// ============================================================================
// AGENT PORTAL — /meetings/[id] — agent-safe meeting detail.
// Vault returns 404 for another agent's or a cross-tenant meeting → notFound().
// ============================================================================
export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { getPortalSession } from "@/src/portal/meetings/session";
import { fetchAgentMeetingDetail } from "@/src/portal/meetings/api";
import MeetingDetail from "../_components/MeetingDetail";

export default async function MeetingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { session } = await getPortalSession();
  if (!session) {
    return (
      <Back>
        <div className="rounded-lg border border-rose-700/40 bg-rose-900/20 px-4 py-3 text-sm text-rose-200 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /> Please sign in and reload this page.
        </div>
      </Back>
    );
  }

  const result = await fetchAgentMeetingDetail(session.access_token, id);
  if (!result.ok) {
    // Uniform 404 for not-yours / cross-tenant / missing (Vault-enforced).
    if (result.status === 404) notFound();
    return (
      <Back>
        <div className="rounded-lg border border-rose-700/40 bg-rose-900/20 px-4 py-3 text-sm text-rose-200 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          {result.status === 401 ? "Please sign in to view this meeting." : `Couldn't load this meeting (HTTP ${result.status}).`}
        </div>
      </Back>
    );
  }

  return (
    <Back>
      <MeetingDetail detail={result.detail} />
    </Back>
  );
}

function Back({ children }: { children: React.ReactNode }) {
  return (
    <div data-training-id="portal.meetings.detail">
      <Link href="/meetings" className="inline-flex items-center gap-1.5 text-xs text-[#A1A1AA] hover:text-[#F1F1F3] mb-4">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Meetings
      </Link>
      {children}
    </div>
  );
}
