// ============================================================================
// AGENT PORTAL 2.1 — R3B — /clients segmented control (Profiles | Leads)
// ============================================================================
// Server-rendered. Pure navigation — no client JS; each tab is a Link
// (?tab=…). This keeps the SSR shape simple and lets ?tab= be a real
// shareable URL.
// ============================================================================

import Link from "next/link";
import { Sparkles, Users } from "lucide-react";

export default function ClientsTabs({ active }: { active: "profiles" | "leads" }) {
  return (
    <nav
      aria-label="Clients view"
      className="
        inline-flex rounded-md border border-[#1a1a2e] bg-[#0b0b10]
        p-0.5 text-xs mb-5
      "
    >
      <Tab href="/clients" label="Client Profiles" Icon={Users} active={active === "profiles"} />
      <Tab href="/clients?tab=leads" label="Leads" Icon={Sparkles} active={active === "leads"} />
    </nav>
  );
}

function Tab({
  href,
  label,
  Icon,
  active,
}: {
  href: string;
  label: string;
  Icon: typeof Users;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`
        inline-flex items-center gap-1.5 px-3 py-1.5 rounded
        transition-colors duration-[180ms]
        ${active
          ? "bg-[#C9A84C]/15 text-[#E8D5A3] border border-[#C9A84C]/40"
          : "text-[#A1A1AA] hover:text-[#F1F1F3] border border-transparent"
        }
      `}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </Link>
  );
}
