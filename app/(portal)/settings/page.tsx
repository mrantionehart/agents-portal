// ============================================================================
// AGENT PORTAL 2.1 — R7 — Settings Hub
// ============================================================================
// Replaces the AP2.1H placeholder. A grouped-card hub that makes every
// existing agent account/admin surface discoverable from one AP2 shell
// page. Each card explains where it goes and deep-links to the
// existing legacy route — no new backend, no new settings engine, no
// inline editing, no DB writes.
//
// The Profile card reads the caller's own profile row (full_name +
// email + role) via the standard own-row RLS read used elsewhere in
// the portal. Read-only display only.
// ============================================================================

export const dynamic = "force-dynamic";

import Link from "next/link";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import {
  AtSign,
  Bell,
  BookOpen,
  Briefcase,
  Calculator,
  CreditCard,
  ExternalLink,
  FileSignature,
  GraduationCap,
  IdCard,
  LifeBuoy,
  Mail,
  Settings as SettingsIcon,
  Shield,
  Sparkles,
  UserCircle2,
} from "lucide-react";

import { displayName, initials, roleLabel } from "@/src/portal/settings/helpers";
import type {
  SettingsProfile,
  SettingsProfileResult,
} from "@/src/portal/settings/types";
import ConnectedAccountsCard from "@/src/portal/settings/ConnectedAccountsCard";

export default async function SettingsHubPage() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
        set(_n: string, _v: string, _o: CookieOptions) { /* read-only */ },
        remove(_n: string, _o: CookieOptions) { /* read-only */ },
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();

  let result: SettingsProfileResult;
  if (!session) {
    result = { kind: "anonymous" };
  } else {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email, role")
      .eq("id", session.user.id)
      .maybeSingle<{ full_name: string | null; email: string | null; role: string | null }>();
    const safe: SettingsProfile = {
      full_name: profile?.full_name ?? null,
      email: profile?.email ?? session.user.email ?? null,
      role: profile?.role ?? null,
    };
    result = { kind: "ok", profile: safe };
  }

  return (
    <div>
      <header className="mb-6">
        <div className="flex items-center gap-2">
          <SettingsIcon className="h-5 w-5 text-[#C9A84C]" />
          <h1 className="text-2xl font-semibold text-[#F1F1F3]">Settings</h1>
        </div>
        <p className="text-sm text-[#A1A1AA] mt-1 max-w-prose">
          One place to find every account, brand, and earnings control. Each
          card opens the existing page that owns that surface — nothing
          changes inline here.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── 1. Profile ─────────────────────────────────────────── */}
        <div data-training-id="portal.settings.profile">
          <Card title="Profile" icon={UserCircle2} description="Manage your agent profile — name, contact info, license details, and avatar.">
            {result.kind === "ok" ? (
              <ProfileSummary profile={result.profile} />
            ) : (
              <SignInHint />
            )}
            <CardLink href="/profile" label="Manage your agent profile" />
          </Card>
        </div>

        {/* ── 2. Business Card ───────────────────────────────────── */}
        <Card title="Business Card" icon={IdCard} description="Your public-facing business card — branding, links, and contact details prospects see when you share your card.">
          <p className="text-xs text-[#71717A]">
            Edit your bio, brand colors, social links, and the URL on the QR
            code prospects scan.
          </p>
          <CardLink href="/business-card" label="Edit public business card" />
        </Card>

        {/* ── 3. Earnings ────────────────────────────────────────── */}
        <Card title="Earnings" icon={CreditCard} description="Track your closed earnings and model future commissions.">
          <ul className="space-y-2">
            <SubLink
              href="/commissions"
              icon={FileSignature}
              title="Commission dashboard"
              hint="Closed, pending, and YTD totals — same data your broker sees."
            />
            <SubLink
              href="/commission-calculator"
              icon={Calculator}
              title="Commission calculator"
              hint="Model a deal: gross, splits, fees, and net to you."
            />
          </ul>
        </Card>

        {/* ── 4. CRM / Email Sync ───────────────────────────────── */}
        <Card title="CRM / Email Sync" icon={AtSign} description="Connect your email and tune CRM preferences so client touchpoints stay in sync.">
          <ul className="space-y-1.5 text-xs text-[#A1A1AA]">
            <li className="inline-flex items-center gap-1.5">
              <Mail className="h-3 w-3 text-[#71717A]" />
              Email sync — Gmail / Outlook
            </li>
            <li className="inline-flex items-center gap-1.5">
              <Briefcase className="h-3 w-3 text-[#71717A]" />
              CRM preferences — auto-pairing rules, do-not-contact list
            </li>
          </ul>
          <CardLink href="/crm/settings" label="Open CRM settings" />
        </Card>

        {/* ── 5. E-Signature / Connected Accounts ────────────────── */}
        <Card title="E-Signature" icon={FileSignature} description="Connect your own e-signature account to send transaction paperwork for signature from HartFelt.">
          <ConnectedAccountsCard />
        </Card>

        {/* ── 6. Notifications ───────────────────────────────────── */}
        <Card title="Notifications" icon={Bell} description="Your notification inbox and visibility controls.">
          <p className="text-xs text-[#71717A]">
            The inbox lives at /notifications. Per-channel preferences land
            with the broader notifications rollout — until then, the inbox
            visibility filter is your control.
          </p>
          <CardLink href="/notifications" label="Manage notification visibility" />
        </Card>

        {/* ── 7. Support / Broker ────────────────────────────────── */}
        <Card title="Support / Broker" icon={LifeBuoy} description="Get help from your broker and access learning resources.">
          <ul className="space-y-2">
            <SubLink
              href="mailto:mrhart@hartfeltrealestate.com"
              icon={Shield}
              title="Contact broker"
              hint="Reach out for account changes, escalations, or compliance questions."
            />
            <SubLink
              href="/training"
              icon={GraduationCap}
              title="Training Hub"
              hint="Modules, scripts, and resources — all in one place."
            />
            <SubLink
              href="/training?tab=resources"
              icon={BookOpen}
              title="Resources"
              hint="Resources now live inside the Training Hub."
            />
          </ul>
        </Card>
      </div>

      <p className="mt-6 text-[11px] text-[#71717A]">
        Every link above opens the existing surface that owns the setting.
        Nothing on this page edits, writes, or syncs — those changes happen
        on the destination pages.
      </p>
    </div>
  );
}

// ── Subcomponents ────────────────────────────────────────────────────

function Card({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description: string;
  icon: typeof SettingsIcon;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-[#1a1a2e] bg-[#11111a] p-5 space-y-3">
      <div className="flex items-start gap-3">
        <div
          aria-hidden
          className="inline-flex items-center justify-center h-9 w-9 rounded-md border border-[#252538] bg-[#0b0b10] shrink-0"
        >
          <Icon className="h-4 w-4 text-[#C9A84C]" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-medium text-[#F1F1F3]">{title}</h2>
          <p className="text-xs text-[#A1A1AA] mt-0.5 leading-relaxed">
            {description}
          </p>
        </div>
      </div>
      {children}
    </section>
  );
}

function CardLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="
        inline-flex items-center gap-1 text-xs text-[#E8D5A3]
        hover:underline
      "
    >
      <ExternalLink className="h-3 w-3" /> {label}
    </Link>
  );
}

function SubLink({
  href,
  title,
  hint,
  icon: Icon,
}: {
  href: string;
  title: string;
  hint: string;
  icon: typeof SettingsIcon;
}) {
  return (
    <li>
      <Link
        href={href}
        className="
          block rounded-md border border-[#1a1a2e] bg-[#0b0b10]
          px-3 py-2 hover:border-[#252538] hover:bg-[#1a1a25]
          transition-colors duration-[180ms]
        "
      >
        <div className="flex items-start gap-2">
          <Icon className="h-3.5 w-3.5 text-[#71717A] mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-xs text-[#F1F1F3] inline-flex items-center gap-1">
              {title}
              <ExternalLink className="h-3 w-3 text-[#71717A]" />
            </div>
            <p className="text-[11px] text-[#71717A] mt-0.5 leading-relaxed">
              {hint}
            </p>
          </div>
        </div>
      </Link>
    </li>
  );
}

function ProfileSummary({ profile }: { profile: SettingsProfile }) {
  return (
    <div className="rounded-md border border-[#1a1a2e] bg-[#0b0b10] px-3 py-3 flex items-center gap-3">
      <div
        aria-hidden
        className="
          inline-flex items-center justify-center
          h-10 w-10 rounded-md border border-[#252538]
          bg-[#11111a]
          text-sm font-medium text-[#E8D5A3]
        "
      >
        {initials(profile)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm text-[#F1F1F3] truncate">
          {displayName(profile)}
        </div>
        <div className="text-[11px] text-[#A1A1AA] truncate inline-flex items-center gap-1">
          <Mail className="h-3 w-3 text-[#71717A]" />
          {profile.email ?? "—"}
        </div>
        <div className="text-[10px] uppercase tracking-wide text-[#71717A] mt-0.5">
          {roleLabel(profile.role)}
        </div>
      </div>
      <Sparkles className="h-3.5 w-3.5 text-[#C9A84C]/70" aria-hidden />
    </div>
  );
}

function SignInHint() {
  return (
    <div className="rounded-md border border-rose-700/40 bg-rose-900/20 px-3 py-2 text-xs text-rose-200">
      Sign in to see your profile summary.
    </div>
  );
}
