import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import Link from "next/link";

// ============================================================================
// /pending-activation — invitee-facing "you're not active yet" page
// ============================================================================
// Reachable to any authenticated user (middleware exempts this pathname
// from the is_active gate to avoid a redirect loop). Renders one of two
// copies driven off profiles.onboarding_status. Does NOT expose internal
// pipeline details (stage, provenance, promotion_history, etc.) — the
// invitee only sees a friendly explanation and no operational plumbing.
//
// Active users who navigate here manually see an affordance back to /home.
// ============================================================================

async function loadProfile(): Promise<{
  is_active: boolean;
  onboarding_status: string | null;
} | null> {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {},
        remove() {},
      } as unknown as {
        get: (n: string) => string | undefined;
        set: (n: string, v: string, o: CookieOptions) => void;
        remove: (n: string, o: CookieOptions) => void;
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Fail CLOSED on any lookup error — return null and let the caller render
  // Copy B ("Your account is currently inactive. Contact your broker.").
  // Under NO circumstances leak the error to the client or fall through to
  // an "active" UX that suggests portal access.
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("is_active, onboarding_status")
      .eq("id", user.id)
      .single();
    if (error || !data) return null;
    return {
      is_active: data.is_active === true,
      onboarding_status: (data.onboarding_status as string | null) ?? null,
    };
  } catch {
    return null;
  }
}

export default async function PendingActivationPage() {
  const profile = await loadProfile();

  // Active user reached this page manually — show affordance back to /home.
  if (profile?.is_active) {
    return (
      <main className="min-h-screen bg-brand-black flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <h1 className="text-2xl font-semibold text-white mb-3">
            Your account is active
          </h1>
          <p className="text-zinc-400 text-sm mb-6">
            You have full access — head to your portal to get started.
          </p>
          <Link
            href="/home"
            className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 bg-brand-gold text-black font-medium"
          >
            Go to Home
          </Link>
        </div>
      </main>
    );
  }

  // Inactive → two copy variants keyed off onboarding_status. No internal
  // pipeline details rendered.
  const inOnboarding = profile?.onboarding_status === "onboarding";
  const body = inOnboarding
    ? "Your broker is completing your setup. Your Agent Portal will unlock once your account is activated."
    : "Your account is currently inactive. Contact your broker for assistance.";

  return (
    <main className="min-h-screen bg-brand-black flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <p className="text-xs uppercase tracking-wide text-zinc-500 mb-2">
          Pending Activation
        </p>
        <h1 className="text-2xl font-semibold text-white mb-4">
          {inOnboarding ? "You're almost there" : "Account inactive"}
        </h1>
        <p className="text-zinc-300 text-sm leading-relaxed">{body}</p>
      </div>
    </main>
  );
}
