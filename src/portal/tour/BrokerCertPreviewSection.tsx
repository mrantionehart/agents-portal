// ============================================================================
// AP2 guided-training — Broker preview section (mounted on /training)
// ============================================================================
// Renders a broker-only card on the AP2 Training Hub with three
// launchers — one per pilot lesson. Non-broker callers see nothing.
//
// Access control here is a UI courtesy only. The Vault GET tour route
// is the security boundary; a non-broker request for a draft tour
// returns 404 regardless of what the client renders.
// ============================================================================

"use client";

import { GraduationCap } from "lucide-react";

import { BrokerPreviewLauncher } from "./BrokerPreviewLauncher";

const BROKER_ROLES = new Set(["broker", "admin", "office_manager"]);

const PILOT = [
  {
    lessonId: "pcert-l01",
    title: "Welcome to the HartFelt Platform",
    description: "4-step orientation walkthrough (no navigation).",
  },
  {
    lessonId: "pcert-l02",
    title: "Portal Dashboard and Navigation",
    description: "6-step tour of the sidebar and Home dashboard.",
  },
  {
    lessonId: "pcert-l03",
    title: "Notifications and Profile",
    description: "7-step tour of the inbox and profile card.",
  },
] as const;

export interface BrokerCertPreviewSectionProps {
  role: string | null | undefined;
  userId?: string | null;
  certificationId?: string;
}

export function BrokerCertPreviewSection({
  role,
  userId,
  certificationId = "hartfelt-platform-certified",
}: BrokerCertPreviewSectionProps) {
  if (!role || !BROKER_ROLES.has(role)) return null;

  return (
    <section
      data-broker-cert-preview
      className="mt-8 rounded-lg border border-[#C9A84C]/40 bg-[#C9A84C]/[0.06] p-5"
      aria-labelledby="broker-preview-heading"
    >
      <div className="flex items-start gap-3 mb-3">
        <GraduationCap className="h-5 w-5 text-[#C9A84C] shrink-0 mt-0.5" />
        <div>
          <h2
            id="broker-preview-heading"
            className="text-[15px] font-semibold text-[#F1F1F3]"
          >
            Draft Certification — broker preview
          </h2>
          <p className="text-[13px] text-[#A1A1AA] mt-1 max-w-prose">
            Volume 4 (Platform Certification) is in draft while the guided-tour
            pilot is authored. As a broker/admin/office_manager you can walk
            each pilot lesson end-to-end without earning progress. Agents do
            not see any Volume 4 content.
          </p>
        </div>
      </div>

      <ul className="space-y-2">
        {PILOT.map((p) => (
          <li
            key={p.lessonId}
            className="flex items-center justify-between gap-3 rounded border border-[#1a1a2e] bg-[#0b0b10] px-4 py-3"
          >
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-[#F1F1F3]">
                {p.title}
              </div>
              <div className="text-[12px] text-[#A1A1AA] truncate">
                {p.description}
              </div>
            </div>
            <BrokerPreviewLauncher
              role={role}
              certificationId={certificationId}
              lessonId={p.lessonId}
              userId={userId}
              label={`Preview ${p.lessonId}`}
            />
          </li>
        ))}
      </ul>

      <p className="mt-3 text-[11px] uppercase tracking-wide text-[#71717A]">
        Progress will not be saved · No completion write is sent
      </p>
    </section>
  );
}
