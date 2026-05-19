// ============================================================================
// Agent Portal — Agent Intelligence View
// GET /api/broker/client-intelligence/[id]/agent-view
// Returns: sanitized profile + AI coaching (opening script, cheat sheet,
//          objection intelligence, next actions, win probability)
// Strips: broker_notes, red_flags, commission data, profitability
// ============================================================================

import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

function getSupabase() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookies().get(name)?.value; },
        set(name: string, value: string, options: CookieOptions) { cookies().set({ name, value, ...options }); },
        remove(name: string, options: CookieOptions) { cookies().delete(name); },
      },
    }
  );
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: userProfile } = await supabase
      .from("profiles")
      .select("role, full_name, email, phone")
      .eq("id", user.id)
      .single();

    if (!userProfile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

    // Get client profile
    const { data: profile, error } = await supabase
      .from("client_profiles")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !profile) {
      return NextResponse.json({ error: "Client profile not found" }, { status: 404 });
    }

    // Access check: must be assigned agent, claimed by, or broker
    const isBroker = ["broker", "admin", "office_manager"].includes(userProfile.role);
    if (!isBroker) {
      const canAccess =
        profile.assigned_agent_id === user.id ||
        profile.claimed_by === user.id ||
        (profile.visibility === "dispo_feed" && profile.status === "dispo");
      if (!canAccess) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
    }

    // Get action log for relationship timeline
    let actionLog: any[] = [];
    try {
      const { data: logs } = await supabase
        .from("client_action_log")
        .select("*")
        .eq("profile_id", id)
        .order("created_at", { ascending: false })
        .limit(20);
      actionLog = logs || [];
    } catch {}

    // ── Build agent-safe response ────────────────────────────────────

    const budgetMin = profile.budget_min;
    const budgetMax = profile.budget_max;
    const fmtBudget = (n: number) => n >= 1000000 ? `$${(n / 1000000).toFixed(1)}M` : `$${(n / 1000).toFixed(0)}K`;
    const budgetRange = budgetMin && budgetMax
      ? `${fmtBudget(budgetMin)} – ${fmtBudget(budgetMax)}`
      : budgetMin ? `${fmtBudget(budgetMin)}+` : budgetMax ? `Up to ${fmtBudget(budgetMax)}` : null;

    const areas = Array.isArray(profile.target_areas) && profile.target_areas.length > 0
      ? profile.target_areas : [];
    const mustHaves = Array.isArray(profile.must_haves) && profile.must_haves.length > 0
      ? profile.must_haves : [];
    const timeline = profile.qualification_timeline || profile.timeline || null;

    // Win probability based on readiness score
    const readinessScore = profile.readiness_score || 0;
    const winProbability = Math.min(Math.round(readinessScore * 0.85 + (profile.temperature === "hot" ? 10 : profile.temperature === "warm" ? 5 : 0)), 95);

    // ── Generate AI coaching ─────────────────────────────────────────

    let aiSnapshot = profile.ai_agent_strategy || null;
    let openingScript: string | null = null;
    let cheatSheet: string | null = null;

    // Generate coaching content from profile data
    const firstName = profile.full_name?.split(" ")[0] || "the client";
    const profileType = profile.profile_type || "buyer";
    const temp = profile.temperature || "warm";

    // Opening Script
    if (profile.personality_notes || profile.motivation) {
      const personality = profile.personality_notes || "";
      const isAnalytical = personality.toLowerCase().includes("analytical") || personality.toLowerCase().includes("roi") || personality.toLowerCase().includes("data");
      const isRelationship = personality.toLowerCase().includes("relationship") || personality.toLowerCase().includes("trust") || personality.toLowerCase().includes("personal");

      if (isAnalytical) {
        openingScript = `"${firstName}, I've been doing some research on the ${areas.length > 0 ? areas[0] : "local"} market and found some data points I think you'll find interesting. I know ROI matters to you, so I wanted to start with the numbers before we look at properties."`;
      } else if (isRelationship) {
        openingScript = `"${firstName}, great to connect with you. Before we dive into properties, I'd love to hear more about what excites you about this move. Understanding your vision will help me find exactly the right fit for you."`;
      } else {
        openingScript = `"${firstName}, thanks for your time today. I've put together a curated selection based on what you're looking for in ${areas.length > 0 ? areas[0] : "the area"}. Let me walk you through the highlights."`;
      }
    } else {
      openingScript = `"${firstName}, thanks for connecting. I'd love to learn more about what you're looking for so I can tailor my search to exactly what matters to you. What's your top priority right now?"`;
    }

    // Conversation Cheat Sheet
    const cheatItems: string[] = [];
    if (profile.motivation) cheatItems.push(`Motivation: ${profile.motivation}`);
    if (profile.pain_points) cheatItems.push(`Pain points: ${profile.pain_points}`);
    if (profile.personality_notes) cheatItems.push(`Personality: ${profile.personality_notes}`);
    if (profile.property_preferences) cheatItems.push(`Wants: ${profile.property_preferences}`);
    if (mustHaves.length > 0) cheatItems.push(`Must-haves: ${mustHaves.join(", ")}`);
    if (areas.length > 0) cheatItems.push(`Target areas: ${areas.join(", ")}`);
    if (budgetRange) cheatItems.push(`Budget: ${budgetRange}`);
    if (timeline) cheatItems.push(`Timeline: ${timeline}`);
    if (profile.purchase_intent) cheatItems.push(`Intent: ${profile.purchase_intent.replace(/_/g, " ")}`);
    if (profile.purchase_method) cheatItems.push(`Paying: ${profile.purchase_method}`);
    cheatSheet = cheatItems.length > 0 ? cheatItems.join(" | ") : null;

    // Objection intelligence based on profile type & pain points
    const objectionList: { objection: string; response: string }[] = [];
    if (profile.pain_points) {
      if (profile.pain_points.toLowerCase().includes("price") || profile.pain_points.toLowerCase().includes("pricing")) {
        objectionList.push({ objection: "It's too expensive", response: "Let me show you the price-per-square-foot trends and how this compares to where values are heading. The numbers tell a compelling story." });
      }
      if (profile.pain_points.toLowerCase().includes("familiar") || profile.pain_points.toLowerCase().includes("new to")) {
        objectionList.push({ objection: "I don't know this market", response: "That's exactly why you have me. I'll walk you through the neighborhoods, trends, and which areas match your goals. No decision pressure — just education first." });
      }
    }
    if (profileType === "investor") {
      objectionList.push({ objection: "What's the ROI?", response: "I have rental comp data and cap rate analysis ready. Let me show you the income potential versus your acquisition cost." });
      objectionList.push({ objection: "Is now the right time?", response: "Let me show you the inventory-to-demand ratio in this area. Timing the market is less important than the specific deal — and I've found some strong ones." });
    }
    if (profileType === "buyer") {
      objectionList.push({ objection: "I want to wait", response: "I understand — let me keep you updated on market shifts so when you're ready, we can move fast. In the meantime, I'll flag anything that's exceptional." });
      objectionList.push({ objection: "We're looking at other areas too", response: "That's smart — let me run a comparison so you can see how the areas stack up on the metrics that matter to you." });
    }

    // Next Best Actions (agent-facing)
    const agentActions: { action: string; priority: "high" | "medium" | "low"; reason: string }[] = [];

    if (temp === "hot" && timeline === "immediate") {
      agentActions.push({ action: "Schedule showing this week", priority: "high", reason: "Hot lead with immediate timeline" });
    }
    if (!profile.representation_status || profile.representation_status === "unknown" || profile.representation_status === "unrepresented") {
      agentActions.push({ action: "Discuss buyer representation", priority: "high", reason: "No representation agreement on file" });
    }
    if (profile.proof_status !== "verified" && profile.purchase_method !== "cash") {
      agentActions.push({ action: "Follow up on proof of funds", priority: "medium", reason: "Financial docs not yet verified" });
    }
    if (areas.length > 0) {
      agentActions.push({ action: `Send curated listings in ${areas[0]}`, priority: "medium", reason: "Match their target areas with fresh inventory" });
    }
    if (timeline === "exploring" || timeline === "long_term") {
      agentActions.push({ action: "Send market report", priority: "low", reason: "Long timeline — nurture with value content" });
    }
    if (profileType === "investor") {
      agentActions.push({ action: "Prepare ROI analysis", priority: "medium", reason: "Investment buyer needs data-driven approach" });
    }
    if (agentActions.length === 0) {
      agentActions.push({ action: "Make introductory call", priority: "medium", reason: "Start building the relationship" });
    }

    // ── Agent-safe response ──────────────────────────────────────────

    return NextResponse.json({
      profile: {
        id: profile.id,
        full_name: profile.full_name,
        email: profile.email,
        phone: profile.phone,
        profile_type: profile.profile_type,
        temperature: profile.temperature,
        status: profile.status,
        budget_range: budgetRange,
        budget_min: profile.budget_min,
        budget_max: profile.budget_max,
        target_areas: areas,
        property_preferences: profile.property_preferences,
        timeline,
        purchase_method: profile.purchase_method,
        purchase_intent: profile.purchase_intent,
        must_haves: mustHaves,
        assigned_at: profile.assigned_at,
        source: profile.source,
        motivation: profile.motivation,
        pain_points: profile.pain_points,
        personality_notes: profile.personality_notes,
        readiness_score: readinessScore,
        representation_status: profile.representation_status,
        proof_status: profile.proof_status,
        preapproved_status: profile.preapproved_status,
      },
      coaching: {
        ai_snapshot: aiSnapshot,
        opening_script: openingScript,
        cheat_sheet: cheatItems,
        objections: objectionList,
        next_actions: agentActions,
        win_probability: winProbability,
      },
      timeline: actionLog.map((l) => ({
        id: l.id,
        action: l.action_key?.replace(/_/g, " ") || "Action",
        channel: l.channel,
        status: l.status,
        subject: l.subject,
        date: l.created_at,
      })),
      agent: {
        name: userProfile.full_name,
        email: userProfile.email,
        phone: userProfile.phone,
      },
    });
  } catch (err: any) {
    console.error("[AgentView] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
