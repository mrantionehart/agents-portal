// ============================================================================
// AGENT PORTAL — /meetings/new — "Request time with the Broker" form page.
// ============================================================================
export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { getPortalSession } from "@/src/portal/meetings/session";
import CreateMeetingForm from "../_components/CreateMeetingForm";

export default async function NewMeetingPage() {
  const { session } = await getPortalSession();

  return (
    <div data-training-id="portal.meetings.new">
      <Link href="/meetings" className="inline-flex items-center gap-1.5 text-xs text-[#A1A1AA] hover:text-[#F1F1F3] mb-4">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Meetings
      </Link>
      <h1 className="text-2xl font-semibold text-[#F1F1F3] mb-1">Request time with the Broker</h1>
      <p className="text-sm text-[#A1A1AA] mb-6 max-w-prose">
        Pick a meeting type and up to three preferred times. Your Broker of Record will confirm one,
        propose an alternate, or decline. You&apos;ll see the outcome here and in your notifications.
      </p>

      {session ? (
        <CreateMeetingForm />
      ) : (
        <div className="rounded-lg border border-rose-700/40 bg-rose-900/20 px-4 py-3 text-sm text-rose-200 flex items-start gap-2 max-w-xl">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /> Please sign in and reload this page.
        </div>
      )}
    </div>
  );
}
