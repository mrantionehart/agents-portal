'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Search, Brain, Flame, Thermometer, Snowflake,
  Phone, Mail, MapPin, DollarSign, Clock,
  ChevronRight, ArrowLeft, CheckCircle2,
  AlertCircle, Building2, Tag, Zap, MessageSquare,
  Target, Shield, TrendingUp, Copy, ChevronDown,
  ChevronUp, Send, ExternalLink, Activity,
} from 'lucide-react';
import ClientActionCenter from './ClientActionCenter';

// ── Types ───────────────────────────────────────────────────────────────

interface ClientProfile {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  profile_type: 'buyer' | 'seller' | 'investor' | 'renter';
  temperature: 'hot' | 'warm' | 'cold';
  budget_min: number | null;
  budget_max: number | null;
  target_areas: string[] | null;
  property_preferences: string | null;
  timeline: string | null;
  motivation: string | null;
  pain_points: string | null;
  personality_notes: string | null;
  suggested_approach: string | null;
  visibility: string;
  status: string;
  assigned_agent_id: string | null;
  assigned_agent_name: string | null;
  claimed_by: string | null;
  claimed_by_name: string | null;
  claimed_at: string | null;
  dispo_pushed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface AgentViewData {
  profile: {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    profile_type: string;
    temperature: string;
    status: string;
    budget_range: string | null;
    budget_min: number | null;
    budget_max: number | null;
    target_areas: string[];
    property_preferences: string | null;
    timeline: string | null;
    purchase_method: string | null;
    purchase_intent: string | null;
    must_haves: string[];
    assigned_at: string | null;
    source: string | null;
    motivation: string | null;
    pain_points: string | null;
    personality_notes: string | null;
    readiness_score: number;
    representation_status: string | null;
    proof_status: string | null;
    preapproved_status: string | null;
    // STR intake (agent-safe)
    str_interest: boolean;
    investment_goal: string | null;
    rental_frequency_needed: string | null;
    preferred_str_areas: string[];
    condo_hotel_ok: boolean;
    hotel_program_ok: boolean;
    daily_rental_required: boolean;
    str_budget: number | null;
    str_beds: string | null;
    waterfront_preference: string | null;
  };
  coaching: {
    ai_snapshot: string | null;
    opening_script: string | null;
    cheat_sheet: string[];
    objections: { objection: string; response: string }[];
    next_actions: { action: string; priority: 'high' | 'medium' | 'low'; reason: string }[];
    win_probability: number;
  };
  timeline: {
    id: string;
    action: string;
    channel: string;
    status: string;
    subject: string;
    date: string;
  }[];
  agent: {
    name: string;
    email: string;
    phone: string;
  };
}

interface STRRecommendation {
  id: string;
  name: string;
  address: string;
  neighborhood: string;
  city: string;
  category: string;
  rental_restriction: string;
  investor_notes: string | null;
  hoa_verification: string;
  last_verified_at: string | null;
  is_featured: boolean;
  match_score: number;
  investor_score: number;
  risk_level: 'low' | 'medium' | 'high';
  reason_matched: string[];
  compliance_note: string;
  listing_match?: {
    mls_status: 'connected' | 'not_connected' | 'coming_soon';
    active_count: number;
    price_low: number | null;
    price_high: number | null;
    price_avg: number | null;
    beds_available: number[];
    avg_dom: number | null;
    waterfront: boolean;
    has_new_listing: boolean;
    listings: any[];
    last_synced: string | null;
  };
}

interface STRRecommendationsData {
  recommendations: STRRecommendation[];
  disclaimer: string;
  total_buildings_analyzed: number;
  mls_status: string;
}

type Tab = 'dispo' | 'mine';

// ── Helpers ─────────────────────────────────────────────────────────────

const getTemperatureIcon = (temp: string) => {
  switch (temp) {
    case 'hot': return <Flame className="w-4 h-4 text-red-400" />;
    case 'warm': return <Thermometer className="w-4 h-4 text-amber-400" />;
    default: return <Snowflake className="w-4 h-4 text-blue-400" />;
  }
};

const getTemperatureBadge = (temp: string) => {
  const colors: Record<string, string> = {
    hot: 'bg-red-900/30 text-red-400 border-red-800/50',
    warm: 'bg-amber-900/30 text-amber-400 border-amber-800/50',
    cold: 'bg-blue-900/30 text-blue-400 border-blue-800/50',
  };
  return colors[temp] || colors.cold;
};

const getTypeBadge = (type: string) => {
  const colors: Record<string, string> = {
    buyer: 'bg-emerald-900/30 text-emerald-400 border-emerald-800/50',
    seller: 'bg-purple-900/30 text-purple-400 border-purple-800/50',
    investor: 'bg-cyan-900/30 text-cyan-400 border-cyan-800/50',
    renter: 'bg-orange-900/30 text-orange-400 border-orange-800/50',
  };
  return colors[type] || 'bg-zinc-800 text-zinc-400 border-zinc-700';
};

const formatCurrency = (val: number | null) => {
  if (!val) return '';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
};

const formatDate = (d: string) => {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatRelativeDate = (d: string) => {
  const now = new Date();
  const date = new Date(d);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(d);
};

const getPriorityColor = (p: string) => {
  switch (p) {
    case 'high': return 'text-red-400 bg-red-900/30 border-red-800/50';
    case 'medium': return 'text-amber-400 bg-amber-900/30 border-amber-800/50';
    default: return 'text-blue-400 bg-blue-900/30 border-blue-800/50';
  }
};

// ══════════════════════════════════════════════════════════════════════════
// AGENT WORKSPACE — Full assigned client intelligence view
// Design: HartFelt + Apple + AI assistant. Know what to do in < 10 seconds.
// ══════════════════════════════════════════════════════════════════════════

function AgentWorkspace({
  profileId,
  onBack,
}: {
  profileId: string;
  onBack: () => void;
}) {
  const [data, setData] = useState<AgentViewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedScript, setCopiedScript] = useState(false);
  const [expandedObjection, setExpandedObjection] = useState<number | null>(null);
  const [highlightedAction, setHighlightedAction] = useState<string | null>(null);
  const [actionToast, setActionToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [strRecs, setStrRecs] = useState<STRRecommendationsData | null>(null);
  const [strRecsLoading, setStrRecsLoading] = useState(false);
  const [strRecsExpanded, setStrRecsExpanded] = useState(false);
  const [copiedExplanation, setCopiedExplanation] = useState<string | null>(null);
  const [expandedListing, setExpandedListing] = useState<string | null>(null);
  const [copiedBuildingName, setCopiedBuildingName] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await fetch(`/api/broker/client-intelligence/${profileId}/agent-view`);
        if (!res.ok) throw new Error('Failed to load');
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [profileId]);

  // Load STR recommendations when profile has str_interest
  useEffect(() => {
    if (!data?.profile?.str_interest) return;
    async function loadStrRecs() {
      try {
        setStrRecsLoading(true);
        const res = await fetch(`/api/broker/client-intelligence/${profileId}/str-recommendations`);
        if (res.ok) {
          const json = await res.json();
          setStrRecs(json);
        }
      } catch {} finally {
        setStrRecsLoading(false);
      }
    }
    loadStrRecs();
  }, [data?.profile?.str_interest, profileId]);

  const copyClientExplanation = (rec: STRRecommendation) => {
    const text = `${rec.name} — ${rec.address}\n${rec.rental_restriction}\nMatch Score: ${rec.match_score}/100\n\n${rec.reason_matched.join('. ')}.\n\n${rec.compliance_note}`;
    navigator.clipboard.writeText(text);
    setCopiedExplanation(rec.id);
    setTimeout(() => setCopiedExplanation(null), 2000);
    trackSTREvent('copy_explanation', rec.id, rec.name);
  };

  const trackSTREvent = async (event_type: string, building_id?: string, building_name?: string) => {
    try {
      await fetch('/api/broker/str-analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type,
          building_id: building_id || null,
          profile_id: profileId,
          metadata: { building_name: building_name || null },
        }),
      });
    } catch {} // fire-and-forget
  };

  const toggleListingCard = (rec: STRRecommendation) => {
    if (expandedListing === rec.id) {
      setExpandedListing(null);
    } else {
      setExpandedListing(rec.id);
      trackSTREvent('listing_view', rec.id, rec.name);
    }
  };

  const copyBuildingForMLS = (rec: STRRecommendation) => {
    navigator.clipboard.writeText(rec.name);
    setCopiedBuildingName(rec.id);
    setTimeout(() => setCopiedBuildingName(null), 2000);
    trackSTREvent('listing_request', rec.id, rec.name);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text.replace(/^"|"$/g, ''));
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setActionToast({ message, type });
    setTimeout(() => setActionToast(null), 4000);
  };

  const reloadData = async () => {
    try {
      const res = await fetch(`/api/broker/client-intelligence/${profileId}/agent-view`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {}
  };

  // Map next_action text to action keys for execute buttons
  const mapActionToKey = (actionText: string): string | null => {
    const lower = actionText.toLowerCase();
    if (lower.includes('proof of funds') || lower.includes('pof')) return 'request_pof';
    if (lower.includes('representation') || lower.includes('buyer rep')) return 'buyer_rep_agreement';
    if (lower.includes('consultation') || lower.includes('strategy meeting')) return 'schedule_consultation';
    if (lower.includes('listing') || lower.includes('properties')) return 'curated_listings';
    if (lower.includes('follow up') || lower.includes('follow-up') || lower.includes('check in')) return 'follow_up_7day';
    if (lower.includes('discovery') || lower.includes('call')) return 'discovery_call';
    if (lower.includes('investment') || lower.includes('roi')) return 'investment_opportunities';
    return null;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-2 border-[#c9a54e] border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-zinc-400 text-sm">Loading intelligence...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] text-white p-6">
        <button onClick={onBack} className="flex items-center gap-2 text-zinc-400 hover:text-white mb-6 transition">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="bg-red-900/30 border border-red-800 rounded-lg p-4 text-red-300">
          {error || 'Could not load client data'}
        </div>
      </div>
    );
  }

  const { profile: p, coaching, timeline: activityLog } = data;
  const winProb = coaching.win_probability;

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white">
      {/* ── Top Bar ─────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-[#0f0f0f]/95 backdrop-blur-sm border-b border-zinc-800/50 px-6 py-3">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <button onClick={onBack} className="flex items-center gap-2 text-zinc-400 hover:text-white transition text-sm">
            <ArrowLeft className="w-4 h-4" /> My Clients
          </button>
          <div className="flex items-center gap-3">
            {p.phone && (
              <a href={`tel:${p.phone}`} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-900/30 border border-emerald-800/50 rounded-lg text-emerald-400 text-sm hover:bg-emerald-900/50 transition">
                <Phone className="w-3.5 h-3.5" /> Call
              </a>
            )}
            {p.phone && (
              <a href={`sms:${p.phone}`} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-900/30 border border-blue-800/50 rounded-lg text-blue-400 text-sm hover:bg-blue-900/50 transition">
                <MessageSquare className="w-3.5 h-3.5" /> Text
              </a>
            )}
            {p.email && (
              <a href={`mailto:${p.email}`} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#c9a54e]/10 border border-[#c9a54e]/30 rounded-lg text-[#c9a54e] text-sm hover:bg-[#c9a54e]/20 transition">
                <Mail className="w-3.5 h-3.5" /> Email
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">

        {/* ── Hero Card — Client Identity + Win Probability ───────── */}
        <div className="bg-[#1a1a1a] border border-zinc-800 rounded-2xl p-6 relative overflow-hidden">
          {/* Win probability arc in background */}
          <div className="absolute top-4 right-6 flex flex-col items-center">
            <div className="relative w-20 h-20">
              <svg viewBox="0 0 80 80" className="w-20 h-20 -rotate-90">
                <circle cx="40" cy="40" r="34" fill="none" stroke="#27272a" strokeWidth="6" />
                <circle
                  cx="40" cy="40" r="34" fill="none"
                  stroke={winProb >= 70 ? '#22c55e' : winProb >= 40 ? '#c9a54e' : '#ef4444'}
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={`${(winProb / 100) * 213.6} 213.6`}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-bold text-white">{winProb}%</span>
              </div>
            </div>
            <span className="text-[10px] uppercase tracking-wider text-zinc-500 mt-1">Win Prob</span>
          </div>

          <h1 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>
            {p.full_name}
          </h1>
          <div className="flex items-center gap-3 mb-4">
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${getTypeBadge(p.profile_type)}`}>
              {p.profile_type.charAt(0).toUpperCase() + p.profile_type.slice(1)}
            </span>
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${getTemperatureBadge(p.temperature)}`}>
              {getTemperatureIcon(p.temperature)}
              {p.temperature.toUpperCase()}
            </span>
            {p.readiness_score > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border border-[#c9a54e]/30 bg-[#c9a54e]/10 text-[#c9a54e]">
                <TrendingUp className="w-3 h-3" /> Readiness {p.readiness_score}
              </span>
            )}
          </div>

          {/* Quick stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            {p.budget_range && (
              <div className="bg-zinc-900/50 rounded-lg px-3 py-2">
                <div className="text-[10px] uppercase tracking-wider text-zinc-500">Budget</div>
                <div className="text-sm font-semibold text-white mt-0.5">{p.budget_range}</div>
              </div>
            )}
            {p.target_areas.length > 0 && (
              <div className="bg-zinc-900/50 rounded-lg px-3 py-2">
                <div className="text-[10px] uppercase tracking-wider text-zinc-500">Areas</div>
                <div className="text-sm font-semibold text-white mt-0.5">{p.target_areas.join(', ')}</div>
              </div>
            )}
            {p.timeline && (
              <div className="bg-zinc-900/50 rounded-lg px-3 py-2">
                <div className="text-[10px] uppercase tracking-wider text-zinc-500">Timeline</div>
                <div className="text-sm font-semibold text-white mt-0.5 capitalize">{p.timeline.replace(/_/g, ' ')}</div>
              </div>
            )}
            {p.purchase_method && (
              <div className="bg-zinc-900/50 rounded-lg px-3 py-2">
                <div className="text-[10px] uppercase tracking-wider text-zinc-500">Payment</div>
                <div className="text-sm font-semibold text-white mt-0.5 capitalize">{p.purchase_method.replace(/_/g, ' ')}</div>
              </div>
            )}
          </div>

          {/* Contact row */}
          <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-zinc-800/50">
            {p.email && (
              <span className="text-sm text-zinc-400 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" /> {p.email}
              </span>
            )}
            {p.phone && (
              <span className="text-sm text-zinc-400 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" /> {p.phone}
              </span>
            )}
            {p.source && (
              <span className="text-sm text-zinc-400 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" /> {p.source}
              </span>
            )}
          </div>
        </div>

        {/* ── AI Snapshot ────────────────────────────────────────────── */}
        {coaching.ai_snapshot && (
          <div className="bg-gradient-to-r from-[#c9a54e]/10 to-[#1a1a1a] border border-[#c9a54e]/20 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Brain className="w-5 h-5 text-[#c9a54e]" />
              <h2 className="text-sm font-semibold text-[#c9a54e] uppercase tracking-wider">AI Strategy Brief</h2>
            </div>
            <p className="text-zinc-300 leading-relaxed text-sm">{coaching.ai_snapshot}</p>
          </div>
        )}

        {/* ── Two-column layout ─────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* LEFT COLUMN — 2/3 width */}
          <div className="lg:col-span-2 space-y-6">

            {/* ── Next Best Actions ──────────────────────────────────── */}
            <div className="bg-[#1a1a1a] border border-zinc-800 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-5 h-5 text-[#c9a54e]" />
                <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Next Best Actions</h2>
              </div>
              <div className="space-y-2">
                {coaching.next_actions.map((action, i) => {
                  const actionKey = mapActionToKey(action.action);
                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between bg-zinc-900/50 rounded-xl px-4 py-3 group hover:bg-zinc-900 transition"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getPriorityColor(action.priority)}`}>
                          {action.priority}
                        </span>
                        <div className="min-w-0">
                          <p className="text-white text-sm font-medium truncate">{action.action}</p>
                          <p className="text-zinc-500 text-xs truncate">{action.reason}</p>
                        </div>
                      </div>
                      {actionKey ? (
                        <button
                          onClick={() => setHighlightedAction(actionKey)}
                          className="flex items-center gap-1 px-2.5 py-1 bg-[#c9a54e]/10 border border-[#c9a54e]/30 rounded-lg text-[#c9a54e] text-[11px] font-semibold hover:bg-[#c9a54e]/20 transition flex-shrink-0 ml-2"
                        >
                          <Send className="w-3 h-3" /> Execute
                        </button>
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-zinc-700 group-hover:text-[#c9a54e] transition flex-shrink-0 ml-2" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Opening Script ─────────────────────────────────────── */}
            {coaching.opening_script && (
              <div className="bg-[#1a1a1a] border border-zinc-800 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-emerald-400" />
                    <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Opening Script</h2>
                  </div>
                  <button
                    onClick={() => copyToClipboard(coaching.opening_script || '')}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {copiedScript ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <div className="bg-zinc-900/50 rounded-xl p-4 border-l-2 border-emerald-500/50">
                  <p className="text-zinc-200 leading-relaxed text-sm italic">
                    {coaching.opening_script}
                  </p>
                </div>
              </div>
            )}

            {/* ── Conversation Cheat Sheet ───────────────────────────── */}
            {coaching.cheat_sheet.length > 0 && (
              <div className="bg-[#1a1a1a] border border-zinc-800 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Target className="w-5 h-5 text-purple-400" />
                  <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Cheat Sheet</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {coaching.cheat_sheet.map((item, i) => {
                    const [label, ...valueParts] = item.split(': ');
                    const value = valueParts.join(': ');
                    return (
                      <div key={i} className="bg-zinc-900/50 rounded-lg px-3 py-2.5">
                        <div className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</div>
                        <div className="text-sm text-zinc-200 mt-0.5">{value}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Objection Intelligence ─────────────────────────────── */}
            {coaching.objections.length > 0 && (
              <div className="bg-[#1a1a1a] border border-zinc-800 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Shield className="w-5 h-5 text-amber-400" />
                  <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Objection Playbook</h2>
                </div>
                <div className="space-y-2">
                  {coaching.objections.map((obj, i) => (
                    <div key={i} className="bg-zinc-900/50 rounded-xl overflow-hidden">
                      <button
                        onClick={() => setExpandedObjection(expandedObjection === i ? null : i)}
                        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-zinc-900 transition"
                      >
                        <span className="text-sm font-medium text-red-400">
                          &ldquo;{obj.objection}&rdquo;
                        </span>
                        {expandedObjection === i
                          ? <ChevronUp className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                          : <ChevronDown className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                        }
                      </button>
                      {expandedObjection === i && (
                        <div className="px-4 pb-3 border-t border-zinc-800">
                          <p className="text-sm text-emerald-300/90 mt-3 leading-relaxed">
                            <span className="text-[10px] uppercase tracking-wider text-emerald-500 block mb-1">Your response:</span>
                            {obj.response}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN — 1/3 width */}
          <div className="space-y-6">

            {/* ── Client Action Center ──────────────────────────────── */}
            <ClientActionCenter
              profile={{
                id: p.id,
                full_name: p.full_name,
                email: p.email,
                phone: p.phone,
                profile_type: p.profile_type,
                temperature: p.temperature,
                budget_min: p.budget_min,
                budget_max: p.budget_max,
                target_areas: p.target_areas || [],
                property_preferences: p.property_preferences,
                timeline: p.timeline,
                qualification_timeline: p.timeline,
                purchase_method: p.purchase_method,
                purchase_intent: p.purchase_intent,
                proof_status: p.proof_status,
                preapproved_status: p.preapproved_status,
                representation_status: p.representation_status,
                readiness_score: p.readiness_score,
                status: p.status,
              }}
              timeline={activityLog}
              showToast={showToast}
              onActionSent={reloadData}
              highlightedAction={highlightedAction}
            />

            {/* ── Win Probability Meter ──────────────────────────────── */}
            <div className="bg-[#1a1a1a] border border-zinc-800 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-[#c9a54e]" />
                <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Win Probability</h2>
              </div>
              <div className="flex flex-col items-center">
                <div className="relative w-32 h-32 mb-3">
                  <svg viewBox="0 0 120 120" className="w-32 h-32 -rotate-90">
                    <circle cx="60" cy="60" r="50" fill="none" stroke="#27272a" strokeWidth="10" />
                    <circle
                      cx="60" cy="60" r="50" fill="none"
                      stroke={winProb >= 70 ? '#22c55e' : winProb >= 40 ? '#c9a54e' : '#ef4444'}
                      strokeWidth="10"
                      strokeLinecap="round"
                      strokeDasharray={`${(winProb / 100) * 314} 314`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-bold text-white">{winProb}%</span>
                    <span className="text-[10px] uppercase tracking-wider text-zinc-500">likely close</span>
                  </div>
                </div>
                <div className="w-full space-y-2 text-xs">
                  <div className="flex justify-between text-zinc-400">
                    <span>Readiness Score</span>
                    <span className="text-white font-semibold">{p.readiness_score}/100</span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>Temperature</span>
                    <span className={`font-semibold capitalize ${p.temperature === 'hot' ? 'text-red-400' : p.temperature === 'warm' ? 'text-amber-400' : 'text-blue-400'}`}>
                      {p.temperature}
                    </span>
                  </div>
                  {p.proof_status && (
                    <div className="flex justify-between text-zinc-400">
                      <span>Proof of Funds</span>
                      <span className={`font-semibold capitalize ${p.proof_status === 'verified' ? 'text-emerald-400' : 'text-zinc-400'}`}>
                        {p.proof_status.replace(/_/g, ' ')}
                      </span>
                    </div>
                  )}
                  {p.representation_status && (
                    <div className="flex justify-between text-zinc-400">
                      <span>Representation</span>
                      <span className={`font-semibold capitalize ${p.representation_status === 'signed' ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {p.representation_status.replace(/_/g, ' ')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Must-Haves ────────────────────────────────────────── */}
            {p.must_haves.length > 0 && (
              <div className="bg-[#1a1a1a] border border-zinc-800 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Must-Haves</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  {p.must_haves.map((item, i) => (
                    <span key={i} className="px-2.5 py-1 bg-emerald-900/20 text-emerald-400 border border-emerald-800/30 rounded-md text-xs font-medium">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* ── Property Preferences ──────────────────────────────── */}
            {p.property_preferences && (
              <div className="bg-[#1a1a1a] border border-zinc-800 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Building2 className="w-5 h-5 text-zinc-400" />
                  <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Property Prefs</h2>
                </div>
                <p className="text-zinc-300 text-sm leading-relaxed">{p.property_preferences}</p>
              </div>
            )}

            {/* ── STR / Airbnb Intent ───────────────────────────────── */}
            {p.str_interest && (
              <div className="bg-[#1a1a1a] border border-purple-900/40 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Building2 className="w-5 h-5 text-purple-400" />
                  <h2 className="text-sm font-semibold text-purple-400 uppercase tracking-wider">STR / Airbnb Intent</h2>
                </div>
                <div className="space-y-2 text-sm">
                  {p.investment_goal && (
                    <p className="text-zinc-300"><span className="text-zinc-500">Goal:</span> {p.investment_goal}</p>
                  )}
                  {p.rental_frequency_needed && (
                    <p className="text-zinc-300"><span className="text-zinc-500">Frequency:</span> {p.rental_frequency_needed.replace(/_/g, ' ')}</p>
                  )}
                  {p.str_budget && (
                    <p className="text-zinc-300"><span className="text-zinc-500">STR Budget:</span> ${Number(p.str_budget).toLocaleString()}</p>
                  )}
                  {p.str_beds && (
                    <p className="text-zinc-300"><span className="text-zinc-500">Beds:</span> {p.str_beds}</p>
                  )}
                  {p.waterfront_preference && (
                    <p className="text-zinc-300"><span className="text-zinc-500">Waterfront:</span> {p.waterfront_preference.replace(/_/g, ' ')}</p>
                  )}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {p.daily_rental_required && (
                      <span className="px-2 py-0.5 bg-red-500/15 text-red-400 rounded-full text-[10px] font-medium">Daily Required</span>
                    )}
                    {p.condo_hotel_ok && (
                      <span className="px-2 py-0.5 bg-blue-500/15 text-blue-400 rounded-full text-[10px] font-medium">Condo-Hotel OK</span>
                    )}
                    {p.hotel_program_ok && (
                      <span className="px-2 py-0.5 bg-purple-500/15 text-purple-400 rounded-full text-[10px] font-medium">Hotel Program OK</span>
                    )}
                  </div>
                  {p.preferred_str_areas.length > 0 && (
                    <div className="mt-2">
                      <span className="text-zinc-500 text-xs">Preferred STR Areas:</span>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {p.preferred_str_areas.map((area) => (
                          <span key={area} className="px-2.5 py-0.5 bg-purple-500/15 text-purple-400 rounded-full text-xs">{area}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Recommended STR Buildings ──────────────────────────── */}
            {p.str_interest && (
              <div className="bg-[#1a1a1a] border border-purple-900/40 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-purple-400" />
                    <h2 className="text-sm font-semibold text-purple-400 uppercase tracking-wider">Recommended STR Buildings</h2>
                  </div>
                  {strRecs && strRecs.recommendations.length > 0 && (
                    <button
                      onClick={() => setStrRecsExpanded(!strRecsExpanded)}
                      className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 transition"
                    >
                      {strRecsExpanded ? 'Show Top 5' : `Show All ${strRecs.recommendations.length}`}
                      {strRecsExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  )}
                </div>

                {strRecsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin w-6 h-6 border-2 border-purple-400 border-t-transparent rounded-full" />
                    <span className="text-zinc-400 text-sm ml-3">Matching buildings...</span>
                  </div>
                ) : !strRecs || strRecs.recommendations.length === 0 ? (
                  <p className="text-zinc-500 text-sm text-center py-4">No matching STR-friendly buildings found for this profile.</p>
                ) : (
                  <>
                    <div className="space-y-3">
                      {(strRecsExpanded ? strRecs.recommendations : strRecs.recommendations.slice(0, 5)).map((rec, idx) => (
                        <div key={rec.id} className="bg-[#0f0f0f] border border-zinc-800 rounded-xl p-4">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-white font-medium text-sm">{idx + 1}. {rec.name}</span>
                                {rec.is_featured && (
                                  <span className="px-1.5 py-0.5 bg-[#c9a54e]/15 text-[#c9a54e] rounded text-[9px] font-bold uppercase">Featured</span>
                                )}
                              </div>
                              <p className="text-zinc-500 text-xs mt-0.5 truncate">{rec.address}</p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <div className="text-center">
                                <div className={`text-lg font-bold ${rec.match_score >= 60 ? 'text-emerald-400' : rec.match_score >= 40 ? 'text-amber-400' : 'text-zinc-400'}`}>
                                  {rec.match_score}
                                </div>
                                <div className="text-[9px] text-zinc-500 uppercase">Match</div>
                              </div>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                                rec.risk_level === 'low' ? 'bg-emerald-900/30 text-emerald-400' :
                                rec.risk_level === 'high' ? 'bg-red-900/30 text-red-400' :
                                'bg-amber-900/30 text-amber-400'
                              }`}>
                                {rec.risk_level} risk
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-1.5 mb-2">
                            <span className="px-2 py-0.5 bg-purple-500/10 text-purple-400 rounded text-[10px]">
                              {rec.category.replace(/_/g, ' ')}
                            </span>
                            <span className="px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded text-[10px]">
                              {rec.neighborhood || rec.city}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] ${
                              rec.hoa_verification === 'verified' ? 'bg-emerald-900/20 text-emerald-400' :
                              rec.hoa_verification === 'disputed' ? 'bg-red-900/20 text-red-400' :
                              'bg-zinc-800 text-zinc-500'
                            }`}>
                              HOA: {rec.hoa_verification}
                            </span>
                          </div>

                          <p className="text-zinc-400 text-xs leading-relaxed mb-2">
                            {rec.rental_restriction}
                          </p>

                          {rec.reason_matched.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-2">
                              {rec.reason_matched.map((r, i) => (
                                <span key={i} className="text-[10px] text-emerald-400/80 bg-emerald-900/15 px-1.5 py-0.5 rounded">
                                  {r}
                                </span>
                              ))}
                            </div>
                          )}

                          {rec.investor_notes && (
                            <p className="text-zinc-500 text-[11px] italic mb-2">{rec.investor_notes}</p>
                          )}

                          <div className="flex items-center gap-2 mt-2">
                            <button
                              onClick={() => copyClientExplanation(rec)}
                              className="flex items-center gap-1 px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 rounded text-[11px] text-zinc-300 transition"
                            >
                              <Copy className="w-3 h-3" />
                              {copiedExplanation === rec.id ? 'Copied!' : 'Copy Client Explanation'}
                            </button>
                            <button
                              onClick={() => toggleListingCard(rec)}
                              className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] transition ${
                                expandedListing === rec.id
                                  ? 'bg-purple-600/20 text-purple-400 border border-purple-600/30'
                                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                              }`}
                            >
                              <Building2 className="w-3 h-3" />
                              {expandedListing === rec.id ? 'Hide Listings' : 'View Listings'}
                            </button>
                            <span className="text-[10px] text-zinc-600">Investor Score: {rec.investor_score}/100</span>
                          </div>

                          {/* ── Listing Match Inline Card ── */}
                          {expandedListing === rec.id && (
                            <div className="mt-3 border border-zinc-700/50 rounded-lg bg-[#151515] p-3">
                              {(!rec.listing_match || rec.listing_match.mls_status === 'not_connected') ? (
                                <div className="text-center py-3">
                                  <div className="flex items-center justify-center gap-2 mb-2">
                                    <Building2 className="w-4 h-4 text-zinc-500" />
                                    <span className="text-xs text-zinc-400 font-medium">MLS Inventory Integration Coming Soon</span>
                                  </div>
                                  <p className="text-[10px] text-zinc-600 mb-3 max-w-xs mx-auto">
                                    Active listings, pricing, and availability for this building will appear here once MLS is connected.
                                  </p>
                                  <div className="bg-zinc-800/50 rounded-lg p-3 mb-3">
                                    <p className="text-[10px] text-zinc-500 mb-1">Search this building in your MLS:</p>
                                    <div className="flex items-center gap-2 justify-center">
                                      <code className="text-xs text-purple-400 bg-purple-900/15 px-2 py-1 rounded">{rec.name}</code>
                                      <button
                                        onClick={() => copyBuildingForMLS(rec)}
                                        className="flex items-center gap-1 px-2 py-1 bg-zinc-700 hover:bg-zinc-600 rounded text-[10px] text-zinc-300 transition"
                                      >
                                        <Copy className="w-2.5 h-2.5" />
                                        {copiedBuildingName === rec.id ? 'Copied!' : 'Copy'}
                                      </button>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-4 gap-2 text-center">
                                    <div className="bg-zinc-800/30 rounded p-2">
                                      <div className="text-[10px] text-zinc-600">Active</div>
                                      <div className="text-sm text-zinc-500">--</div>
                                    </div>
                                    <div className="bg-zinc-800/30 rounded p-2">
                                      <div className="text-[10px] text-zinc-600">Price Range</div>
                                      <div className="text-sm text-zinc-500">--</div>
                                    </div>
                                    <div className="bg-zinc-800/30 rounded p-2">
                                      <div className="text-[10px] text-zinc-600">Avg DOM</div>
                                      <div className="text-sm text-zinc-500">--</div>
                                    </div>
                                    <div className="bg-zinc-800/30 rounded p-2">
                                      <div className="text-[10px] text-zinc-600">Waterfront</div>
                                      <div className="text-sm text-zinc-500">{rec.listing_match?.waterfront ? 'Yes' : '--'}</div>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-center py-2">
                                  <p className="text-xs text-emerald-400">MLS Connected — {rec.listing_match.active_count} active listings</p>
                                  <div className="grid grid-cols-4 gap-2 mt-2 text-center">
                                    <div className="bg-zinc-800/30 rounded p-2">
                                      <div className="text-[10px] text-zinc-600">Active</div>
                                      <div className="text-sm text-white font-medium">{rec.listing_match.active_count}</div>
                                    </div>
                                    <div className="bg-zinc-800/30 rounded p-2">
                                      <div className="text-[10px] text-zinc-600">Price Range</div>
                                      <div className="text-sm text-white font-medium">
                                        {rec.listing_match.price_low ? `$${(rec.listing_match.price_low / 1000).toFixed(0)}K` : '--'} - {rec.listing_match.price_high ? `$${(rec.listing_match.price_high / 1000).toFixed(0)}K` : '--'}
                                      </div>
                                    </div>
                                    <div className="bg-zinc-800/30 rounded p-2">
                                      <div className="text-[10px] text-zinc-600">Avg DOM</div>
                                      <div className="text-sm text-white font-medium">{rec.listing_match.avg_dom ?? '--'}</div>
                                    </div>
                                    <div className="bg-zinc-800/30 rounded p-2">
                                      <div className="text-[10px] text-zinc-600">Waterfront</div>
                                      <div className="text-sm text-white font-medium">{rec.listing_match.waterfront ? 'Yes' : 'No'}</div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Compliance disclaimer */}
                    <div className="mt-3 p-3 bg-amber-900/10 border border-amber-900/30 rounded-lg">
                      <p className="text-[10px] text-amber-400/80 leading-relaxed">
                        <AlertCircle className="w-3 h-3 inline mr-1 -mt-0.5" />
                        {strRecs.disclaimer}
                      </p>
                    </div>

                    {/* MLS placeholder */}
                    <div className="mt-2 text-center">
                      <p className="text-[10px] text-zinc-600">
                        MLS integration not yet connected. Active listings will appear here in a future update.
                      </p>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-[10px] text-zinc-600">
                      <span>{strRecs.total_buildings_analyzed} buildings analyzed</span>
                      <span>{strRecs.recommendations.length} matches</span>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── Relationship Timeline ──────────────────────────────── */}
            <div className="bg-[#1a1a1a] border border-zinc-800 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-5 h-5 text-blue-400" />
                <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Timeline</h2>
              </div>
              {activityLog.length === 0 ? (
                <p className="text-zinc-500 text-sm text-center py-4">No activity yet</p>
              ) : (
                <div className="space-y-3">
                  {activityLog.slice(0, 8).map((entry) => (
                    <div key={entry.id} className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-[#c9a54e] mt-1.5 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-zinc-300 capitalize truncate">{entry.action}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-zinc-500">{formatRelativeDate(entry.date)}</span>
                          <span className={`text-[10px] uppercase font-semibold ${
                            entry.status === 'sent' ? 'text-blue-400' :
                            entry.status === 'opened' ? 'text-emerald-400' :
                            entry.status === 'replied' ? 'text-[#c9a54e]' :
                            entry.status === 'failed' ? 'text-red-400' :
                            'text-zinc-500'
                          }`}>
                            {entry.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Action toast ──────────────────────────────────────────── */}
      {actionToast && (
        <div className={`fixed bottom-6 right-6 ${
          actionToast.type === 'error' ? 'bg-red-900/90 border-red-800' : 'bg-emerald-900/90 border-emerald-800'
        } border rounded-lg p-4 flex items-center gap-2 max-w-sm shadow-lg z-50`}>
          {actionToast.type === 'error'
            ? <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            : <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          }
          <span className={`text-sm ${actionToast.type === 'error' ? 'text-red-200' : 'text-emerald-200'}`}>
            {actionToast.message}
          </span>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT — List + Detail Router
// ══════════════════════════════════════════════════════════════════════════

export default function ClientIntelligenceScreen() {
  const [profiles, setProfiles] = useState<ClientProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('mine');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchProfiles = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ tab });
      if (searchTerm) params.append('search', searchTerm);

      const res = await fetch(`/api/broker/client-intelligence?${params}`);
      const json = await res.json();
      setProfiles(json.data || []);
    } catch (err) {
      console.error('Error fetching profiles:', err);
    } finally {
      setLoading(false);
    }
  }, [tab, searchTerm]);

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

  const handleClaim = async (profileId: string) => {
    if (claiming) return;
    setClaiming(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`/api/broker/client-intelligence/${profileId}/claim`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Failed to claim');
        return;
      }
      setSuccess(`Successfully claimed ${json.data.full_name}!`);
      setSelectedProfileId(json.data.id);
      fetchProfiles();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setClaiming(false);
    }
  };

  // ── Detail View — full agent workspace ──
  if (selectedProfileId) {
    return (
      <AgentWorkspace
        profileId={selectedProfileId}
        onBack={() => { setSelectedProfileId(null); setError(''); setSuccess(''); }}
      />
    );
  }

  // ── List View ──
  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Brain className="w-7 h-7 text-[#c9a54e]" />
          <h1 className="text-2xl font-bold">Client Intelligence</h1>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#1a1a1a] rounded-lg p-1 mb-6 w-fit">
        {[
          { key: 'mine' as Tab, label: 'My Clients' },
          { key: 'dispo' as Tab, label: 'Dispo Feed' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              tab === t.key
                ? 'bg-[#c9a54e] text-black'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          type="text"
          placeholder="Search by name, email, or phone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-[#1a1a1a] border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:border-[#c9a54e] focus:outline-none text-sm"
        />
      </div>

      {/* Cards */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-8 h-8 border-2 border-[#c9a54e] border-t-transparent rounded-full" />
        </div>
      ) : profiles.length === 0 ? (
        <div className="text-center py-20 text-zinc-500">
          <Brain className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg">
            {tab === 'dispo' ? 'No profiles in the dispo feed right now.' : 'No client profiles assigned to you yet.'}
          </p>
          {tab === 'dispo' && (
            <p className="text-sm mt-2 text-zinc-600">Check back soon — new leads are pushed by the broker.</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {profiles.map(p => (
            <div
              key={p.id}
              onClick={() => setSelectedProfileId(p.id)}
              className="bg-[#1a1a1a] border border-zinc-800 rounded-xl p-5 cursor-pointer hover:border-[#c9a54e]/50 transition group"
            >
              {/* Top row */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-white font-semibold text-lg group-hover:text-[#c9a54e] transition">{p.full_name}</h3>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${getTypeBadge(p.profile_type)}`}>
                      {p.profile_type.charAt(0).toUpperCase() + p.profile_type.slice(1)}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${getTemperatureBadge(p.temperature)}`}>
                      {getTemperatureIcon(p.temperature)}
                      {p.temperature.toUpperCase()}
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-zinc-600 group-hover:text-[#c9a54e] transition" />
              </div>

              {/* Details */}
              <div className="space-y-1.5 text-sm text-zinc-400">
                {(p.budget_min || p.budget_max) && (
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-3.5 h-3.5" />
                    <span>{formatCurrency(p.budget_min)} — {formatCurrency(p.budget_max)}</span>
                  </div>
                )}
                {p.target_areas && p.target_areas.length > 0 && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{p.target_areas.slice(0, 3).join(', ')}</span>
                  </div>
                )}
                {p.timeline && (
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{p.timeline}</span>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="mt-4 pt-3 border-t border-zinc-800 flex items-center justify-between">
                <span className="text-xs text-zinc-500">
                  {p.dispo_pushed_at ? `Posted ${formatDate(p.dispo_pushed_at)}` : formatDate(p.created_at)}
                </span>
                {tab === 'dispo' && p.status === 'dispo' && !p.claimed_by && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleClaim(p.id); }}
                    disabled={claiming}
                    className="px-3 py-1.5 bg-[#c9a54e] text-black text-xs font-bold rounded-md hover:bg-[#d4b35e] transition disabled:opacity-50"
                  >
                    Claim
                  </button>
                )}
                {p.status === 'claimed' && p.assigned_agent_name && (
                  <span className="text-xs text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Yours
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Toast messages */}
      {error && (
        <div className="fixed bottom-6 right-6 bg-red-900/90 border border-red-800 rounded-lg p-4 flex items-center gap-2 max-w-sm shadow-lg z-50">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <span className="text-red-200 text-sm">{error}</span>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-200 ml-2">✕</button>
        </div>
      )}
      {success && (
        <div className="fixed bottom-6 right-6 bg-emerald-900/90 border border-emerald-800 rounded-lg p-4 flex items-center gap-2 max-w-sm shadow-lg z-50">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <span className="text-emerald-200 text-sm">{success}</span>
          <button onClick={() => setSuccess('')} className="text-emerald-400 hover:text-emerald-200 ml-2">✕</button>
        </div>
      )}
    </div>
  );
}
