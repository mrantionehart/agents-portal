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
  // Track 1 — Portal Foundations
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
  // Track 2 — Transaction Intelligence
  {
    lessonId: "pcert-l06",
    title: "Transaction Coordinator",
    description:
      "7-step tour of the Coordinator card on '100 QA Training Way'.",
  },
  {
    lessonId: "pcert-l07",
    title: "Coach",
    description:
      "8-step tour of Coach across '200' and '300 QA Training Way'.",
  },
  {
    lessonId: "pcert-l08",
    title: "Transaction Assistant",
    description: "7-step tour of the AI tab on '300 QA Training Way'.",
  },
  {
    lessonId: "pcert-l09",
    title: "Draft Intelligence",
    description: "7-step tour of the draft card on '300 QA Training Way'.",
  },
  {
    lessonId: "pcert-l10",
    title: "Evidence, Facts Used & Confidence",
    description: "7-step tour of confidence, facts, and evidence on '300 QA Training Way'.",
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
            Volume 4 — broker preview
          </h2>
          <p className="text-[13px] text-[#A1A1AA] mt-1 max-w-prose">
            As a broker/admin/office_manager you can walk each of these pilot
            lessons end-to-end in preview mode — no progress is earned and no
            attestation is written. Agents open the same lessons through their
            own certified track pages under <code className="text-[11px]">/training/certified</code>.
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
