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

import Link from "next/link";
import { GraduationCap, Table2 } from "lucide-react";

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

      <MatrixBrokerPreview />
    </section>
  );
}

// Broker-only launchers for the Matrix Simulator in PREVIEW mode: the same
// knowledge quiz + Rental/Sales/Maintenance practicals an agent runs, scored by
// the same Vault functions, but write-nothing (broker-tier preview endpoints).
// Opens the existing simulator components with ?preview=1 — no duplicate engine.
function MatrixBrokerPreview() {
  const launchers: ReadonlyArray<{ href: string; title: string; description: string }> = [
    { href: "/the-matrix/quiz?preview=1", title: "Knowledge Quiz", description: "The 20-question written check — graded, with a broker answer review." },
    { href: "/the-matrix/practice?preview=1", title: "Rental / Sales / Maintenance practicals", description: "Pick a module, correct the listing, and see the score + per-field answer review." },
  ];
  return (
    <div className="mt-6 border-t border-[#C9A84C]/20 pt-5" data-matrix-broker-preview-section>
      <div className="flex items-start gap-3 mb-3">
        <Table2 className="h-5 w-5 text-[#C9A84C] shrink-0 mt-0.5" />
        <div>
          <h3 className="text-[15px] font-semibold text-[#F1F1F3]">Matrix Simulator — broker preview</h3>
          <p className="text-[13px] text-[#A1A1AA] mt-1 max-w-prose">
            Run the agent&rsquo;s Matrix knowledge quiz and practicals yourself. Scored exactly as an
            agent is, but nothing is saved, submitted, or certified, and no agent&rsquo;s progress is
            touched — reset any time.
          </p>
        </div>
      </div>
      <ul className="space-y-2">
        {launchers.map((l) => (
          <li
            key={l.href}
            className="flex items-center justify-between gap-3 rounded border border-[#1a1a2e] bg-[#0b0b10] px-4 py-3"
          >
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-[#F1F1F3]">{l.title}</div>
              <div className="text-[12px] text-[#A1A1AA] truncate">{l.description}</div>
            </div>
            <Link
              href={l.href}
              data-testid="matrix-broker-preview-launch"
              className="shrink-0 rounded bg-[#C9A84C] px-3 py-1.5 text-[12px] font-semibold text-[#1a1407] hover:bg-[#d8b85e]"
            >
              Preview
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
