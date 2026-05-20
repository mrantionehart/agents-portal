'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Search, Brain, Flame, Thermometer, Snowflake,
  Phone, Mail, MapPin, DollarSign, Clock,
  ChevronRight, ArrowLeft, CheckCircle2,
  AlertCircle, Building2, Tag, Zap, MessageSquare,
  Target, Shield, TrendingUp, Copy, ChevronDown,
  ChevronUp, Send, ExternalLink, Activity, Bell,
  Sparkles, X, Share2, Link, AlertTriangle, Banknote, FileText, CalendarClock,
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
    mls_status: 'connected' | 'not_connected' | 'coming_soon' | 'cached';
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
    attribution?: string;
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
  const [strFilter, setStrFilter] = useState<string>('all');

  // ── Deal Room share state ──
  const [dealRoomLoading, setDealRoomLoading] = useState(false);
  const [dealRoomUrl, setDealRoomUrl] = useState<string | null>(null);

  // ── Offer Intelligence state ──
  const [offerLoading, setOfferLoading] = useState(false);
  const [offerData, setOfferData] = useState<any>(null);
  const [offerExpanded, setOfferExpanded] = useState(false);

  // ── Transaction Intelligence state ──
  const [txnLoading, setTxnLoading] = useState(false);
  const [txnData, setTxnData] = useState<any>(null);
  const [txnExpanded, setTxnExpanded] = useState(false);
  const [txnCreateMode, setTxnCreateMode] = useState(false);
  const [txnAddress, setTxnAddress] = useState('');
  const [txnPrice, setTxnPrice] = useState('');

  // ── Advisor Performance ──
  const [perfData, setPerfData] = useState<any>(null);

  const handleShareDealRoom = async (pid: string) => {
    setDealRoomLoading(true);
    setDealRoomUrl(null);
    try {
      const res = await fetch('/api/broker/investor-rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_id: pid }),
      });
      const json = await res.json();
      if (json.room?.token || json.url) {
        const url = `https://hartfelt-vault.vercel.app${json.url || `/investor-room/${json.room.token}`}`;
        setDealRoomUrl(url);
        await navigator.clipboard.writeText(url);
        showToast('Deal room link copied to clipboard!');
      } else {
        showToast('Failed to create deal room');
      }
    } catch (err) {
      console.error('[Deal Room] Share error:', err);
      showToast('Error creating deal room');
    } finally {
      setDealRoomLoading(false);
    }
  };

  const handleGenerateOffer = async (pid: string, buildingId?: string, listingId?: string) => {
    setOfferLoading(true);
    setOfferData(null);
    try {
      const res = await fetch('/api/broker/offer-intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_id: pid, building_id: buildingId || null, listing_id: listingId || null }),
      });
      const json = await res.json();
      if (json.offer_id || json.suggested_offer_low) {
        setOfferData(json);
        setOfferExpanded(true);
        showToast('Offer intelligence generated');
      } else {
        showToast('Failed to generate offer intelligence');
      }
    } catch (err) {
      console.error('[Offer Intel] Error:', err);
      showToast('Error generating offer intelligence');
    } finally {
      setOfferLoading(false);
    }
  };

  const loadTransaction = async (pid: string) => {
    try {
      const res = await fetch(`/api/broker/transaction-intelligence?profile_id=${pid}`);
      const json = await res.json();
      if (json.transactions?.length > 0) {
        const txnId = json.transactions[0].id;
        const detail = await fetch(`/api/broker/transaction-intelligence?transaction_id=${txnId}`);
        const dJson = await detail.json();
        setTxnData(dJson);
        setTxnExpanded(true);
      }
    } catch (err) {
      console.error('[Txn Intel] Load error:', err);
    }
  };

  const handleCreateTransaction = async (pid: string) => {
    if (!txnAddress.trim()) { showToast('Property address required'); return; }
    setTxnLoading(true);
    try {
      const res = await fetch('/api/broker/transaction-intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile_id: pid,
          property_address: txnAddress.trim(),
          contract_price: txnPrice ? parseFloat(txnPrice) : undefined,
        }),
      });
      const json = await res.json();
      if (json.transaction_id) {
        showToast(`Transaction created with ${json.milestones_created} milestones`);
        setTxnCreateMode(false);
        setTxnAddress('');
        setTxnPrice('');
        await loadTransaction(pid);
      } else {
        showToast('Failed to create transaction');
      }
    } catch (err) {
      console.error('[Txn Intel] Create error:', err);
      showToast('Error creating transaction');
    } finally {
      setTxnLoading(false);
    }
  };

  const handleCompleteMilestone = async (milestoneId: string, txnId: string, pid: string) => {
    try {
      await fetch('/api/broker/transaction-intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete_milestone', milestone_id: milestoneId, transaction_id: txnId, profile_id: pid }),
      });
      showToast('Milestone completed');
      await loadTransaction(pid);
    } catch (err) {
      console.error('[Txn Intel] Complete error:', err);
    }
  };

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

  // Load advisor performance data
  useEffect(() => {
    async function loadPerf() {
      try {
        const res = await fetch('/api/broker/brokerage-intelligence?scope=agent&period=30');
        if (res.ok) {
          const json = await res.json();
          setPerfData(json);
        }
      } catch {}
    }
    loadPerf();
  }, [profileId]);

  // Load existing transactions for buyer/investor profiles
  useEffect(() => {
    if (!data?.profile) return;
    const pt = data.profile.profile_type;
    if (pt === 'buyer' || pt === 'investor') {
      loadTransaction(profileId);
    }
  }, [data?.profile?.profile_type, profileId]);

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

            {/* ── Share Deal Room ──────────────────────────────── */}
            {(p.profile_type === 'investor' || p.profile_type === 'buyer') && (
              <div className="bg-[#1a1a1a] border border-zinc-800 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Share2 className="w-5 h-5 text-[#c9a54e]" />
                  <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Investor Deal Room</h2>
                </div>
                <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
                  Share a personalized deal room with {p.full_name.split(' ')[0]} — curated STR recommendations, available units, and your advisor notes.
                </p>
                {dealRoomUrl ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 p-2.5 bg-emerald-900/20 border border-emerald-800/40 rounded-lg">
                      <Link className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span className="text-xs text-emerald-300 truncate flex-1">{dealRoomUrl}</span>
                    </div>
                    <button
                      onClick={() => { navigator.clipboard.writeText(dealRoomUrl); showToast('Link copied!'); }}
                      className="w-full py-2 text-xs text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg transition"
                    >
                      Copy Link Again
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleShareDealRoom(p.id)}
                    disabled={dealRoomLoading}
                    className="w-full py-2.5 bg-[#c9a54e] hover:bg-[#b8943e] text-black font-semibold text-sm rounded-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {dealRoomLoading ? (
                      <div className="animate-spin w-4 h-4 border-2 border-black border-t-transparent rounded-full" />
                    ) : (
                      <>
                        <Share2 className="w-4 h-4" />
                        Create & Share Deal Room
                      </>
                    )}
                  </button>
                )}
              </div>
            )}

            {/* ── Offer Intelligence ──────────────────────────────── */}
            {(p.profile_type === 'investor' || p.profile_type === 'buyer') && (
              <div className="bg-[#1a1a1a] border border-zinc-800 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Banknote className="w-5 h-5 text-[#c9a54e]" />
                    <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Offer Intelligence</h2>
                  </div>
                  {offerData && (
                    <button onClick={() => setOfferExpanded(!offerExpanded)} className="text-zinc-500 hover:text-white transition">
                      {offerExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  )}
                </div>
                <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
                  AI-powered offer analysis based on market signals, client budget, building data, and engagement patterns.
                </p>

                {!offerData ? (
                  <button
                    onClick={() => handleGenerateOffer(p.id)}
                    disabled={offerLoading}
                    className="w-full py-2.5 bg-[#c9a54e] hover:bg-[#b8943e] text-black font-semibold text-sm rounded-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {offerLoading ? (
                      <div className="animate-spin w-4 h-4 border-2 border-black border-t-transparent rounded-full" />
                    ) : (
                      <>
                        <Target className="w-4 h-4" />
                        Generate Offer Intelligence
                      </>
                    )}
                  </button>
                ) : offerExpanded ? (
                  <div className="space-y-3">
                    {/* Suggested Offer Range */}
                    <div className="bg-[#111] border border-zinc-800 rounded-xl p-3">
                      <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Suggested Offer Range</div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-xl font-bold text-emerald-400">${(offerData.suggested_offer_low || 0).toLocaleString()}</span>
                        <span className="text-zinc-500">—</span>
                        <span className="text-xl font-bold text-emerald-400">${(offerData.suggested_offer_high || 0).toLocaleString()}</span>
                      </div>
                      <div className="text-[10px] text-zinc-500 mt-1">List Price: ${(offerData.list_price || 0).toLocaleString()}</div>
                    </div>

                    {/* Score Grid */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-[#111] border border-zinc-800 rounded-lg p-2.5 text-center">
                        <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Negotiation</div>
                        <div className={`text-lg font-bold ${(offerData.negotiation_score || 0) >= 70 ? 'text-emerald-400' : (offerData.negotiation_score || 0) >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
                          {offerData.negotiation_score || 0}
                        </div>
                      </div>
                      <div className="bg-[#111] border border-zinc-800 rounded-lg p-2.5 text-center">
                        <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Confidence</div>
                        <div className={`text-lg font-bold ${(offerData.offer_confidence || 0) >= 70 ? 'text-emerald-400' : (offerData.offer_confidence || 0) >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
                          {offerData.offer_confidence || 0}
                        </div>
                      </div>
                      <div className="bg-[#111] border border-zinc-800 rounded-lg p-2.5 text-center">
                        <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Risk Flags</div>
                        <div className={`text-lg font-bold ${(offerData.risk_flags?.length || 0) > 2 ? 'text-red-400' : (offerData.risk_flags?.length || 0) > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                          {offerData.risk_flags?.length || 0}
                        </div>
                      </div>
                    </div>

                    {/* Cash Flow */}
                    <div className="bg-[#111] border border-zinc-800 rounded-xl p-3">
                      <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Estimated Monthly Cash Flow</div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex justify-between text-zinc-400">
                          <span>STR Income</span>
                          <span className="text-emerald-400 font-semibold">${(offerData.monthly_breakdown?.gross_rental || offerData.estimated_rental_income || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-zinc-400">
                          <span>Mortgage</span>
                          <span className="text-red-400 font-semibold">-${(offerData.monthly_breakdown?.mortgage || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-zinc-400">
                          <span>HOA</span>
                          <span className="text-red-400 font-semibold">-${(offerData.monthly_breakdown?.hoa || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-zinc-400">
                          <span>Mgmt (20%)</span>
                          <span className="text-red-400 font-semibold">-${(offerData.monthly_breakdown?.management_fee || 0).toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="mt-2 pt-2 border-t border-zinc-800 flex justify-between">
                        <span className="text-xs font-semibold text-white">Net Cash Flow</span>
                        <span className={`text-sm font-bold ${(offerData.estimated_str_cashflow || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          ${(offerData.estimated_str_cashflow || 0).toLocaleString()}/mo
                        </span>
                      </div>
                    </div>

                    {/* Risk Flags */}
                    {offerData.risk_flags?.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="text-[10px] uppercase tracking-wider text-zinc-500">Risk Flags</div>
                        {offerData.risk_flags.map((flag: string, i: number) => (
                          <div key={i} className="flex items-start gap-2 p-2 bg-red-950/20 border border-red-900/30 rounded-lg">
                            <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                            <span className="text-[11px] text-red-300 leading-tight">{flag}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Signals Used */}
                    {offerData.signals_used && (
                      <div className="bg-[#111] border border-zinc-800 rounded-xl p-3">
                        <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Signals Used</div>
                        <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                          {Object.entries(offerData.signals_used).map(([key, val]: [string, any]) => (
                            <div key={key} className="flex justify-between text-zinc-400">
                              <span>{key.replace(/_/g, ' ')}</span>
                              <span className="text-zinc-300 font-medium">{val}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => handleGenerateOffer(p.id)}
                      disabled={offerLoading}
                      className="w-full py-2 text-xs text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {offerLoading ? (
                        <div className="animate-spin w-3 h-3 border-2 border-zinc-300 border-t-transparent rounded-full" />
                      ) : (
                        'Refresh Analysis'
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-2.5 bg-[#111] border border-zinc-800 rounded-lg cursor-pointer" onClick={() => setOfferExpanded(true)}>
                    <div className="flex items-center gap-3">
                      <span className="text-emerald-400 font-bold text-sm">${(offerData.suggested_offer_low || 0).toLocaleString()} — ${(offerData.suggested_offer_high || 0).toLocaleString()}</span>
                      <span className="text-[10px] text-zinc-500">Confidence: {offerData.offer_confidence || 0}/100</span>
                    </div>
                    <ChevronDown className="w-4 h-4 text-zinc-500" />
                  </div>
                )}
              </div>
            )}

            {/* ── Transaction Intelligence ──────────────────────────── */}
            {(p.profile_type === 'buyer' || p.profile_type === 'investor') && (
              <div className="bg-[#1a1a1a] border border-zinc-800 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <CalendarClock className="w-5 h-5 text-[#c9a54e]" />
                    <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Transaction Intelligence</h2>
                  </div>
                  {txnData && (
                    <button onClick={() => setTxnExpanded(!txnExpanded)} className="text-zinc-500 hover:text-white transition">
                      {txnExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  )}
                </div>

                {/* No transaction yet — show create form */}
                {!txnData && !txnCreateMode && (
                  <div className="text-center py-4">
                    <p className="text-zinc-500 text-xs mb-3">No active transaction for this client</p>
                    <button
                      onClick={() => setTxnCreateMode(true)}
                      className="px-4 py-2 bg-[#c9a54e]/20 text-[#c9a54e] border border-[#c9a54e]/30 rounded-lg text-xs font-semibold hover:bg-[#c9a54e]/30 transition"
                    >
                      <FileText className="w-3.5 h-3.5 inline mr-1.5" /> Start Transaction
                    </button>
                  </div>
                )}

                {/* Create transaction form */}
                {txnCreateMode && !txnData && (
                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder="Property address"
                      value={txnAddress}
                      onChange={(e) => setTxnAddress(e.target.value)}
                      className="w-full px-3 py-2 bg-[#111] border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#c9a54e]"
                    />
                    <input
                      type="text"
                      placeholder="Contract price (optional)"
                      value={txnPrice}
                      onChange={(e) => setTxnPrice(e.target.value)}
                      className="w-full px-3 py-2 bg-[#111] border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#c9a54e]"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleCreateTransaction(profileId)}
                        disabled={txnLoading}
                        className="flex-1 py-2 bg-[#c9a54e] text-black rounded-lg text-xs font-bold hover:bg-[#d4b05c] transition disabled:opacity-50"
                      >
                        {txnLoading ? 'Creating...' : 'Create Transaction'}
                      </button>
                      <button
                        onClick={() => { setTxnCreateMode(false); setTxnAddress(''); setTxnPrice(''); }}
                        className="px-3 py-2 bg-zinc-800 text-zinc-400 rounded-lg text-xs hover:text-white transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Transaction detail view */}
                {txnData && txnExpanded && (
                  <div className="space-y-4">
                    {/* Header with completion % */}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white text-sm font-semibold">{txnData.transaction?.property_address || 'Transaction'}</p>
                        <p className="text-zinc-500 text-[10px] uppercase tracking-wider mt-0.5">
                          {txnData.transaction?.status === 'active' ? 'Active' : txnData.transaction?.status}
                          {txnData.transaction?.contract_price ? ` · $${Number(txnData.transaction.contract_price).toLocaleString()}` : ''}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className={`text-xl font-bold ${(txnData.intelligence?.completion_pct || 0) >= 75 ? 'text-emerald-400' : (txnData.intelligence?.completion_pct || 0) >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
                          {txnData.intelligence?.completion_pct || 0}%
                        </span>
                        <p className="text-[10px] text-zinc-500 uppercase">Complete</p>
                      </div>
                    </div>

                    {/* Completion progress bar */}
                    <div className="w-full bg-zinc-800 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${(txnData.intelligence?.completion_pct || 0) >= 75 ? 'bg-emerald-500' : (txnData.intelligence?.completion_pct || 0) >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${txnData.intelligence?.completion_pct || 0}%` }}
                      />
                    </div>

                    {/* Risk Level */}
                    {txnData.intelligence?.risk_level && txnData.intelligence.risk_level !== 'low' && (
                      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium ${
                        txnData.intelligence.risk_level === 'critical' ? 'bg-red-900/30 border-red-800/50 text-red-400' :
                        txnData.intelligence.risk_level === 'high' ? 'bg-orange-900/30 border-orange-800/50 text-orange-400' :
                        'bg-amber-900/30 border-amber-800/50 text-amber-400'
                      }`}>
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span className="uppercase">{txnData.intelligence.risk_level} Risk</span>
                      </div>
                    )}

                    {/* Critical Dates */}
                    {txnData.intelligence?.critical_dates?.length > 0 && (
                      <div>
                        <h3 className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Critical Dates</h3>
                        <div className="space-y-1.5">
                          {txnData.intelligence.critical_dates.map((cd: any, i: number) => (
                            <div key={i} className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs ${
                              cd.overdue ? 'bg-red-900/20 border border-red-800/30' : 'bg-[#111] border border-zinc-800'
                            }`}>
                              <span className={cd.overdue ? 'text-red-400' : 'text-zinc-300'}>{cd.name}</span>
                              <span className={`font-mono text-[10px] ${cd.overdue ? 'text-red-400 font-bold' : 'text-zinc-500'}`}>
                                {cd.due_date ? new Date(cd.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                                {cd.days_until !== undefined && (
                                  <span className="ml-1">({cd.days_until < 0 ? `${Math.abs(cd.days_until)}d overdue` : `${cd.days_until}d`})</span>
                                )}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Next Actions */}
                    {txnData.intelligence?.next_actions?.length > 0 && (
                      <div>
                        <h3 className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Next Actions</h3>
                        <div className="space-y-1.5">
                          {txnData.intelligence.next_actions.map((na: any, i: number) => (
                            <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 bg-[#111] border border-zinc-800 rounded-lg text-xs">
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                                na.urgency === 'critical' ? 'bg-red-900/40 text-red-400' :
                                na.urgency === 'high' ? 'bg-orange-900/40 text-orange-400' :
                                'bg-zinc-800 text-zinc-400'
                              }`}>{na.urgency}</span>
                              <span className="text-zinc-300 flex-1">{na.action}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Risk Flags */}
                    {txnData.intelligence?.risk_flags?.length > 0 && (
                      <div>
                        <h3 className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Risk Flags</h3>
                        <div className="space-y-1">
                          {txnData.intelligence.risk_flags.map((flag: string, i: number) => (
                            <div key={i} className="flex items-start gap-2 text-xs text-amber-400">
                              <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                              <span>{flag}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Missing Documents */}
                    {txnData.intelligence?.missing_documents?.length > 0 && (
                      <div>
                        <h3 className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Missing Documents</h3>
                        <div className="flex flex-wrap gap-1.5">
                          {txnData.intelligence.missing_documents.map((doc: string, i: number) => (
                            <span key={i} className="px-2 py-0.5 bg-zinc-800 text-zinc-400 border border-zinc-700 rounded text-[10px]">
                              {doc}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Milestone Checklist */}
                    <div>
                      <h3 className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Deal Timeline</h3>
                      <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
                        {(txnData.milestones || []).map((ms: any) => (
                          <div key={ms.id} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs ${
                            ms.status === 'completed' ? 'bg-emerald-900/10 border border-emerald-800/20' :
                            ms.status === 'overdue' ? 'bg-red-900/10 border border-red-800/20' :
                            'bg-[#111] border border-zinc-800'
                          }`}>
                            <button
                              onClick={() => ms.status !== 'completed' && handleCompleteMilestone(ms.id, txnData.transaction.id, profileId)}
                              className={`w-4 h-4 rounded-full border flex-shrink-0 flex items-center justify-center transition ${
                                ms.status === 'completed' ? 'bg-emerald-500 border-emerald-500' :
                                ms.status === 'overdue' ? 'border-red-500 hover:bg-red-500/20' :
                                'border-zinc-600 hover:border-[#c9a54e]'
                              }`}
                              disabled={ms.status === 'completed'}
                            >
                              {ms.status === 'completed' && <CheckCircle2 className="w-3 h-3 text-white" />}
                            </button>
                            <span className={`flex-1 ${
                              ms.status === 'completed' ? 'text-zinc-500 line-through' :
                              ms.status === 'overdue' ? 'text-red-400' : 'text-zinc-300'
                            }`}>{ms.name}</span>
                            <span className={`font-mono text-[9px] ${
                              ms.status === 'completed' ? 'text-emerald-500' :
                              ms.status === 'overdue' ? 'text-red-400' : 'text-zinc-600'
                            }`}>
                              {ms.due_date ? new Date(ms.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Collapsed summary */}
                {txnData && !txnExpanded && (
                  <div className="flex items-center justify-between p-2.5 bg-[#111] border border-zinc-800 rounded-lg cursor-pointer" onClick={() => setTxnExpanded(true)}>
                    <div className="flex items-center gap-3">
                      <span className={`font-bold text-sm ${
                        (txnData.intelligence?.completion_pct || 0) >= 75 ? 'text-emerald-400' :
                        (txnData.intelligence?.completion_pct || 0) >= 40 ? 'text-amber-400' : 'text-red-400'
                      }`}>{txnData.intelligence?.completion_pct || 0}% Complete</span>
                      <span className="text-[10px] text-zinc-500">{txnData.transaction?.property_address || ''}</span>
                    </div>
                    <ChevronDown className="w-4 h-4 text-zinc-500" />
                  </div>
                )}
              </div>
            )}

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

            {/* ── Advisor Performance Snapshot ──────────────────────── */}
            {perfData?.agent_rank && (
              <div className="bg-[#1a1a1a] border border-zinc-800 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-5 h-5 text-[#c9a54e]" />
                  <h2 className="text-sm font-semibold text-white uppercase tracking-wider">My Performance</h2>
                </div>
                {/* Rank badge */}
                <div className="flex items-center justify-center mb-4">
                  <div className="relative">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center border-2 ${
                      perfData.agent_rank.rank === 1 ? 'border-yellow-400 bg-yellow-400/10' :
                      perfData.agent_rank.rank <= 3 ? 'border-[#c9a54e] bg-[#c9a54e]/10' :
                      'border-zinc-700 bg-zinc-800'
                    }`}>
                      <span className="text-xl font-bold text-white">#{perfData.agent_rank.rank}</span>
                    </div>
                    <p className="text-[10px] text-zinc-500 text-center mt-1">of {perfData.agent_rank.total_agents}</p>
                  </div>
                </div>
                {/* Stats grid */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[
                    { label: 'Clients', value: perfData.agent_rank.total_clients, color: 'text-white' },
                    { label: 'Conv Rate', value: `${perfData.agent_rank.conversion_rate}%`, color: perfData.agent_rank.conversion_rate >= 50 ? 'text-emerald-400' : 'text-amber-400' },
                    { label: 'Closed', value: perfData.agent_rank.closed_transactions, color: 'text-emerald-400' },
                  ].map(s => (
                    <div key={s.label} className="bg-[#111] rounded-lg p-2 text-center">
                      <p className="text-[9px] text-zinc-500 uppercase tracking-wider">{s.label}</p>
                      <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Active Deals', value: perfData.agent_rank.active_transactions },
                    { label: 'Offers Made', value: perfData.agent_rank.offers_generated },
                    { label: 'Action Rate', value: `${perfData.agent_rank.action_completion_rate}%` },
                    { label: 'Score', value: perfData.agent_rank.composite_score },
                  ].map(s => (
                    <div key={s.label} className="flex justify-between text-xs text-zinc-400 px-1">
                      <span>{s.label}</span>
                      <span className="text-white font-semibold">{s.value}</span>
                    </div>
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

            {/* ── STR Intelligence — Advisor Recommendations ──────────────────────────── */}
            {p.str_interest && (
              <div className="bg-[#1a1a1a] border border-purple-900/40 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-purple-400" />
                    <h2 className="text-sm font-semibold text-purple-400 uppercase tracking-wider">STR Intelligence</h2>
                  </div>
                  {strRecs && strRecs.recommendations.length > 0 && (
                    <button
                      onClick={() => setStrRecsExpanded(!strRecsExpanded)}
                      className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 transition"
                    >
                      {strRecsExpanded ? 'Top 5' : `All ${strRecs.recommendations.length}`}
                      {strRecsExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-zinc-500 mb-4">Buildings matched to your client&apos;s investment profile. Advisor tools below each recommendation.</p>

                {/* Fast Filters */}
                {strRecs && strRecs.recommendations.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {['all', 'daily', 'no_restrictions', 'monthly_seasonal', 'hotel_program'].map(f => (
                      <button
                        key={f}
                        onClick={() => setStrFilter && setStrFilter(f)}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-semibold transition ${
                          (strFilter || 'all') === f
                            ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                            : 'bg-zinc-800/60 text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        {f === 'all' ? 'All' : f === 'no_restrictions' ? 'No Restrictions' : f === 'monthly_seasonal' ? 'Monthly' : f === 'hotel_program' ? 'Hotel Program' : f.charAt(0).toUpperCase() + f.slice(1)}
                      </button>
                    ))}
                  </div>
                )}

                {strRecsLoading ? (
                  <div className="flex flex-col items-center justify-center py-10">
                    <div className="animate-spin w-7 h-7 border-2 border-purple-400 border-t-transparent rounded-full mb-3" />
                    <span className="text-zinc-400 text-sm">Analyzing {p.full_name?.split(' ')[0] || 'client'}&apos;s investment profile...</span>
                    <span className="text-zinc-600 text-[10px] mt-1">Scoring {strRecs?.total_buildings_analyzed || '70+'} buildings</span>
                  </div>
                ) : !strRecs || strRecs.recommendations.length === 0 ? (
                  <div className="text-center py-8">
                    <Building2 className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
                    <p className="text-zinc-400 text-sm font-medium mb-1">No Matching Buildings Found</p>
                    <p className="text-zinc-600 text-xs max-w-xs mx-auto">Update this client&apos;s STR preferences (areas, rental frequency, budget) to generate personalized recommendations.</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-3">
                      {(strRecsExpanded ? strRecs.recommendations : strRecs.recommendations.slice(0, 5))
                        .filter(rec => !strFilter || strFilter === 'all' || rec.category === strFilter)
                        .map((rec, idx) => (
                        <div key={rec.id} className="bg-[#0f0f0f] border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition">
                          {/* Header row: Building + Score + Risk */}
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <Building2 className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                                <span className="text-white font-semibold text-sm">{rec.name}</span>
                                {rec.is_featured && (
                                  <span className="px-1.5 py-0.5 bg-[#c9a54e]/15 text-[#c9a54e] rounded text-[9px] font-bold">FEATURED</span>
                                )}
                              </div>
                              <p className="text-zinc-500 text-xs mt-0.5 truncate pl-5">{rec.neighborhood || rec.city} · {rec.address}</p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <div className="text-center px-2 py-1 bg-zinc-900 rounded-lg">
                                <div className={`text-base font-bold leading-none ${rec.match_score >= 60 ? 'text-emerald-400' : rec.match_score >= 40 ? 'text-amber-400' : 'text-zinc-400'}`}>
                                  {rec.match_score}
                                </div>
                                <div className="text-[8px] text-zinc-600 uppercase mt-0.5">Match</div>
                              </div>
                              <div className="text-center px-2 py-1 bg-zinc-900 rounded-lg">
                                <div className="text-base font-bold leading-none text-purple-400">{rec.investor_score}</div>
                                <div className="text-[8px] text-zinc-600 uppercase mt-0.5">Investor</div>
                              </div>
                              <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${
                                rec.risk_level === 'low' ? 'bg-emerald-900/30 text-emerald-400' :
                                rec.risk_level === 'high' ? 'bg-red-900/30 text-red-400' :
                                'bg-amber-900/30 text-amber-400'
                              }`}>
                                {rec.risk_level}
                              </span>
                            </div>
                          </div>

                          {/* ── Available Units Today — always visible ── */}
                          {rec.listing_match && rec.listing_match.mls_status === 'cached' && rec.listing_match.active_count > 0 ? (
                            <div className="mx-5 mb-3 border border-emerald-800/30 bg-emerald-900/10 rounded-lg p-3">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-emerald-400 text-xs font-semibold">Available: {rec.listing_match.active_count} unit{rec.listing_match.active_count !== 1 ? 's' : ''}</span>
                                  {rec.listing_match.has_new_listing && (
                                    <span className="px-1.5 py-0.5 bg-amber-500/15 text-amber-400 text-[9px] rounded-full font-bold animate-pulse">NEW</span>
                                  )}
                                </div>
                                {rec.listing_match.last_synced && (
                                  <span className="text-[9px] text-zinc-600">
                                    Updated: {(() => {
                                      const diff = Date.now() - new Date(rec.listing_match.last_synced).getTime();
                                      const hrs = Math.floor(diff / 3600000);
                                      if (hrs < 1) return 'just now';
                                      if (hrs < 24) return `${hrs}h ago`;
                                      return `${Math.floor(hrs / 24)}d ago`;
                                    })()}
                                  </span>
                                )}
                              </div>
                              <div className="grid grid-cols-3 gap-2">
                                <div className="bg-[#0a0a0a] rounded-lg p-2 text-center">
                                  <div className="text-white font-bold text-sm">
                                    {rec.listing_match.price_low ? `$${(rec.listing_match.price_low / 1000).toFixed(0)}K` : '--'}
                                    {rec.listing_match.price_high && rec.listing_match.price_high !== rec.listing_match.price_low
                                      ? `–$${(rec.listing_match.price_high / 1000).toFixed(0)}K`
                                      : ''}
                                  </div>
                                  <div className="text-[8px] text-zinc-500 uppercase mt-0.5">Price Range</div>
                                </div>
                                <div className="bg-[#0a0a0a] rounded-lg p-2 text-center">
                                  <div className="text-white font-bold text-sm">
                                    {rec.listing_match.beds_available && rec.listing_match.beds_available.length > 0
                                      ? [...new Set(rec.listing_match.beds_available)].sort().map(b => `${b}BR`).join(' · ')
                                      : '--'}
                                  </div>
                                  <div className="text-[8px] text-zinc-500 uppercase mt-0.5">Bedrooms</div>
                                </div>
                                <div className="bg-[#0a0a0a] rounded-lg p-2 text-center">
                                  <div className="text-white font-bold text-sm">{rec.listing_match.avg_dom ?? '--'}<span className="text-zinc-500 text-[10px] ml-0.5">days</span></div>
                                  <div className="text-[8px] text-zinc-500 uppercase mt-0.5">Avg DOM</div>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="mx-5 mb-3 border border-zinc-800/50 bg-zinc-900/30 rounded-lg p-2.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] text-zinc-500">Live MLS feed not connected yet</span>
                                <button
                                  onClick={() => {
                                    trackSTREvent('listing_request', rec.id, rec.name);
                                    copyBuildingForMLS(rec);
                                  }}
                                  className="text-[10px] text-amber-400 hover:text-amber-300 font-medium transition"
                                >
                                  Request Current Units
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Tags row: category + area + HOA */}
                          <div className="flex flex-wrap gap-1.5 mb-2 pl-5">
                            <span className="px-2 py-0.5 bg-cyan-500/10 text-cyan-400 rounded text-[10px] font-medium">
                              {rec.category === 'no_restrictions' ? 'No Restrictions' : rec.category === 'monthly_seasonal' ? 'Monthly / Seasonal' : rec.category === 'hotel_program' ? 'Hotel Program' : rec.category.charAt(0).toUpperCase() + rec.category.slice(1)}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                              rec.hoa_verification === 'verified' ? 'bg-emerald-900/20 text-emerald-400' :
                              rec.hoa_verification === 'disputed' ? 'bg-red-900/20 text-red-400' :
                              'bg-zinc-800 text-zinc-500'
                            }`}>
                              HOA: {rec.hoa_verification}
                            </span>
                            {rec.listing_match?.waterfront && (
                              <span className="px-2 py-0.5 bg-blue-900/20 text-blue-400 rounded text-[10px] font-medium">Waterfront</span>
                            )}
                          </div>

                          {/* Rental restriction */}
                          <p className="text-zinc-400 text-xs leading-relaxed mb-2 pl-5">{rec.rental_restriction}</p>

                          {/* Reason matched */}
                          {rec.reason_matched.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-2 pl-5">
                              {rec.reason_matched.map((r, i) => (
                                <span key={i} className="text-[10px] text-emerald-400/80 bg-emerald-900/15 px-1.5 py-0.5 rounded">
                                  {r}
                                </span>
                              ))}
                            </div>
                          )}

                          {rec.investor_notes && (
                            <p className="text-zinc-500 text-[11px] italic mb-2 pl-5">{rec.investor_notes}</p>
                          )}

                          {/* Advisor Actions */}
                          <div className="flex items-center gap-2 mt-3 flex-wrap pl-5">
                            <button
                              onClick={() => {
                                trackSTREvent('listing_view', rec.id, rec.name);
                                toggleListingCard(rec);
                              }}
                              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition ${
                                expandedListing === rec.id
                                  ? 'bg-purple-600/20 text-purple-400 border border-purple-600/30'
                                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                              }`}
                            >
                              <Building2 className="w-3 h-3" />
                              View Listings
                            </button>
                            <button
                              onClick={() => {
                                trackSTREvent('listing_request', rec.id, rec.name);
                                copyBuildingForMLS(rec);
                              }}
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-900/20 hover:bg-amber-900/30 border border-amber-700/30 rounded-lg text-[11px] font-medium text-amber-400 transition"
                            >
                              <ExternalLink className="w-3 h-3" />
                              Request Units
                            </button>
                            <button
                              onClick={() => copyClientExplanation(rec)}
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-[11px] font-medium text-zinc-300 transition"
                            >
                              <Copy className="w-3 h-3" />
                              {copiedExplanation === rec.id ? 'Copied!' : 'Copy Explanation'}
                            </button>
                            <button
                              onClick={() => {
                                trackSTREvent('conversion', rec.id, rec.name);
                                window.open(`mailto:info@hartfeltrealestate.com?subject=STR Inquiry: ${encodeURIComponent(rec.name)}&body=${encodeURIComponent(`Advisor inquiry about ${rec.name} for client ${p.full_name || ''}.\n\nBuilding: ${rec.name}\nArea: ${rec.neighborhood || rec.city}\nCategory: ${rec.category}\nMatch Score: ${rec.match_score}/100`)}`, '_blank');
                              }}
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-[#c9a54e]/10 hover:bg-[#c9a54e]/20 border border-[#c9a54e]/20 rounded-lg text-[11px] font-medium text-[#c9a54e] transition"
                            >
                              <MessageSquare className="w-3 h-3" />
                              Ask HARTFELT
                            </button>
                          </div>

                          {/* ── Expanded Listing Detail ── */}
                          {expandedListing === rec.id && (
                            <div className="mt-3 border border-zinc-700/50 rounded-lg bg-[#151515] p-3">
                              {(!rec.listing_match || rec.listing_match.mls_status === 'not_connected' || rec.listing_match.active_count === 0) ? (
                                <div className="text-center py-3">
                                  <Building2 className="w-5 h-5 text-zinc-600 mx-auto mb-2" />
                                  <span className="text-xs text-zinc-400 font-medium block mb-1">Live MLS feed not connected yet</span>
                                  <p className="text-[10px] text-zinc-600 mb-3 max-w-xs mx-auto">
                                    Active listings will appear here once MLS is connected. Use Request Units to get current availability.
                                  </p>
                                  {rec.listing_match && rec.listing_match.mls_status === 'cached' && (
                                    <p className="text-[9px] text-zinc-600">
                                      Last import: {rec.listing_match.last_synced ? new Date(rec.listing_match.last_synced).toLocaleDateString() : 'never'} · {rec.listing_match.active_count} cached listing{rec.listing_match.active_count !== 1 ? 's' : ''}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <div className="py-1">
                                  <div className="flex items-center justify-between mb-2">
                                    <p className="text-xs text-emerald-400 font-medium">
                                      {rec.listing_match.active_count} Active Listing{rec.listing_match.active_count !== 1 ? 's' : ''}
                                    </p>
                                    {rec.listing_match.attribution && (
                                      <span className="text-[9px] text-zinc-600">{rec.listing_match.attribution}</span>
                                    )}
                                  </div>
                                  <div className="grid grid-cols-4 gap-2 text-center">
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

                    {/* Inventory summary */}
                    <div className="mt-2 text-center">
                      <p className="text-[10px] text-zinc-600">
                        Inventory data from HARTFELT listing cache. Live MLS feed coming in a future update.
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

  // ── STR Match Feed state ──
  interface MatchAlert {
    id: string;
    profile_id: string;
    building_id: string;
    agent_id: string;
    match_score: number;
    match_reasons: string[];
    matched_listings_count: number;
    price_low: number | null;
    price_high: number | null;
    beds_available: number[];
    is_read: boolean;
    created_at: string;
    building_name: string;
    client_name: string;
  }
  const [matchAlerts, setMatchAlerts] = useState<MatchAlert[]>([]);
  const [matchUnreadCount, setMatchUnreadCount] = useState(0);
  const [matchBannerDismissed, setMatchBannerDismissed] = useState(false);

  // ── Advisor Actions state ──
  interface AdvisorAction {
    id: string;
    match_id: string;
    profile_id: string;
    building_id: string;
    agent_id: string | null;
    action_type: string;
    action_label: string;
    action_description: string;
    priority: number;
    priority_reason: string;
    status: string;
    metadata: any;
    created_at: string;
    building_name: string;
    client_name: string;
  }
  const [advisorActions, setAdvisorActions] = useState<AdvisorAction[]>([]);
  const [actionsLoading, setActionsLoading] = useState(false);

  const fetchAdvisorActions = useCallback(async () => {
    try {
      setActionsLoading(true);
      const res = await fetch('/api/broker/advisor-actions?status=pending&limit=10');
      if (res.ok) {
        const json = await res.json();
        setAdvisorActions(json.actions || []);
      }
    } catch (err) {
      console.error('[Advisor Actions] Fetch error:', err);
    } finally {
      setActionsLoading(false);
    }
  }, []);

  useEffect(() => { fetchAdvisorActions(); }, [fetchAdvisorActions]);

  const handleActionClick = async (action: AdvisorAction) => {
    // Mark as opened
    try {
      await fetch('/api/broker/advisor-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action_id: action.id, status: 'opened' }),
      });
    } catch (_) {}
    // Navigate to client
    setSelectedProfileId(action.profile_id);
  };

  const handleActionComplete = async (e: React.MouseEvent, action: AdvisorAction) => {
    e.stopPropagation();
    try {
      await fetch('/api/broker/advisor-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action_id: action.id, status: 'completed' }),
      });
      setAdvisorActions(prev => prev.filter(a => a.id !== action.id));
    } catch (_) {}
  };

  const handleActionIgnore = async (e: React.MouseEvent, action: AdvisorAction) => {
    e.stopPropagation();
    try {
      await fetch('/api/broker/advisor-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action_id: action.id, status: 'ignored' }),
      });
      setAdvisorActions(prev => prev.filter(a => a.id !== action.id));
    } catch (_) {}
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'call_client': return <Phone className="w-4 h-4" />;
      case 'send_inventory_update': return <Send className="w-4 h-4" />;
      case 'schedule_consultation': return <Clock className="w-4 h-4" />;
      case 'generate_explanation': return <MessageSquare className="w-4 h-4" />;
      case 'request_units': return <Building2 className="w-4 h-4" />;
      case 'share_top_matches': return <Target className="w-4 h-4" />;
      default: return <Zap className="w-4 h-4" />;
    }
  };

  // ── Conversion Intelligence state ──
  interface ConversionScore {
    id: string;
    profile_id: string;
    conversion_score: number;
    buying_probability: number;
    dropoff_risk: number;
    urgency_score: number;
    reengagement_score: number;
    signal_summary: string;
    client_name: string;
    temperature: string;
  }
  const [conversionScores, setConversionScores] = useState<ConversionScore[]>([]);

  const fetchConversions = useCallback(async () => {
    try {
      const res = await fetch('/api/broker/conversion-intelligence?sort=conversion_score&limit=8');
      if (res.ok) {
        const json = await res.json();
        setConversionScores(json.conversions || []);
      }
    } catch (err) {
      console.error('[Conversion Intelligence] Fetch error:', err);
    }
  }, []);

  useEffect(() => { fetchConversions(); }, [fetchConversions]);

  const handleConversionClick = async (conv: ConversionScore) => {
    try {
      fetch('/api/broker/conversion-intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversion_id: conv.id, status: 'opened' }),
      });
    } catch (_) {}
    setSelectedProfileId(conv.profile_id);
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-emerald-400';
    if (score >= 40) return 'text-amber-400';
    return 'text-zinc-400';
  };

  const getRiskColor = (risk: number) => {
    if (risk >= 60) return 'text-red-400 bg-red-900/30';
    if (risk >= 30) return 'text-amber-400 bg-amber-900/30';
    return 'text-emerald-400 bg-emerald-900/30';
  };

  const getActionPriorityColor = (priority: number) => {
    if (priority >= 70) return 'text-red-400 bg-red-900/30 border-red-800/50';
    if (priority >= 50) return 'text-amber-400 bg-amber-900/30 border-amber-800/50';
    return 'text-blue-400 bg-blue-900/30 border-blue-800/50';
  };

  const fetchMatches = useCallback(async () => {
    try {
      const res = await fetch('/api/broker/str-matches?unread=true&limit=20');
      if (res.ok) {
        const json = await res.json();
        setMatchAlerts(json.matches || []);
        setMatchUnreadCount(json.unread_count || 0);
      }
    } catch (err) {
      console.error('[Match Feed] Fetch error:', err);
    }
  }, []);

  useEffect(() => { fetchMatches(); }, [fetchMatches]);

  const handleMatchClick = async (match: MatchAlert) => {
    // Track alert_opened
    try {
      fetch('/api/broker/str-analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: 'alert_opened',
          building_id: match.building_id,
          profile_id: match.profile_id,
          metadata: { match_id: match.id, match_score: match.match_score },
        }),
      });
    } catch (_) {}

    // Mark as read
    try {
      await fetch('/api/broker/str-matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ match_ids: [match.id] }),
      });
      setMatchAlerts(prev => prev.filter(m => m.id !== match.id));
      setMatchUnreadCount(prev => Math.max(0, prev - 1));
    } catch (_) {}

    // Navigate to client
    setSelectedProfileId(match.profile_id);
  };

  const dismissAllMatches = async () => {
    const ids = matchAlerts.map(m => m.id);
    if (ids.length === 0) return;
    try {
      await fetch('/api/broker/str-matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ match_ids: ids }),
      });
      setMatchAlerts([]);
      setMatchUnreadCount(0);
      setMatchBannerDismissed(true);
    } catch (_) {}
  };

  const formatMatchPrice = (low: number | null, high: number | null) => {
    const fmt = (n: number) => n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${(n / 1_000).toFixed(0)}K`;
    if (low && high && low !== high) return `${fmt(low)} – ${fmt(high)}`;
    if (low) return fmt(low);
    if (high) return fmt(high);
    return '';
  };

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
          {matchUnreadCount > 0 && (
            <span className="relative flex items-center justify-center w-6 h-6 bg-[#c9a54e] text-black text-[11px] font-bold rounded-full animate-pulse">
              {matchUnreadCount}
            </span>
          )}
        </div>
      </div>

      {/* STR Match Feed Alerts */}
      {matchAlerts.length > 0 && !matchBannerDismissed && (
        <div className="mb-6 rounded-xl border border-[#c9a54e]/30 bg-[#c9a54e]/[0.05] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#c9a54e]/20">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#c9a54e]" />
              <span className="text-sm font-semibold text-[#c9a54e]">
                {matchUnreadCount} New Inventor{matchUnreadCount === 1 ? 'y' : 'y'} Match{matchUnreadCount === 1 ? '' : 'es'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={dismissAllMatches}
                className="text-[11px] text-zinc-400 hover:text-white transition px-2 py-1 rounded"
              >
                Mark all read
              </button>
              <button onClick={() => setMatchBannerDismissed(true)} className="text-zinc-500 hover:text-white transition">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="divide-y divide-zinc-800/50 max-h-[280px] overflow-y-auto">
            {matchAlerts.slice(0, 8).map(match => (
              <button
                key={match.id}
                onClick={() => handleMatchClick(match)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#c9a54e]/[0.08] transition text-left"
              >
                <div className="shrink-0 w-8 h-8 rounded-lg bg-[#c9a54e]/20 flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-[#c9a54e]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">
                    <span className="font-semibold">{match.matched_listings_count}</span>
                    {' '}new {match.building_name} unit{match.matched_listings_count === 1 ? '' : 's'} match{match.matched_listings_count === 1 ? 'es' : ''}
                    {' '}<span className="text-[#c9a54e] font-semibold">{match.client_name}</span>
                  </p>
                  <div className="flex items-center gap-3 mt-0.5 text-[11px] text-zinc-500">
                    {match.price_low && <span>{formatMatchPrice(match.price_low, match.price_high)}</span>}
                    {match.beds_available?.length > 0 && (
                      <span>{match.beds_available.join(', ')} bed{match.beds_available.length > 1 ? 's' : ''}</span>
                    )}
                    <span>Score: {match.match_score}</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-600 shrink-0" />
              </button>
            ))}
          </div>
          {matchAlerts.length > 8 && (
            <div className="px-4 py-2 border-t border-zinc-800/50 text-center">
              <span className="text-[11px] text-zinc-500">+{matchAlerts.length - 8} more matches</span>
            </div>
          )}
        </div>
      )}

      {/* Next Best Action Card */}
      {advisorActions.length > 0 && (
        <div className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.05] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-emerald-500/20">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-semibold text-emerald-400">
                Next Best Actions
              </span>
              <span className="text-[11px] text-zinc-500">
                ({advisorActions.length} pending)
              </span>
            </div>
          </div>
          <div className="divide-y divide-zinc-800/50 max-h-[320px] overflow-y-auto">
            {advisorActions.slice(0, 6).map(action => (
              <button
                key={action.id}
                onClick={() => handleActionClick(action)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-emerald-500/[0.08] transition text-left group"
              >
                <div className="shrink-0 w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                  {getActionIcon(action.action_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-white font-medium truncate">{action.action_label}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${getActionPriorityColor(action.priority)}`}>
                      {action.priority}
                    </span>
                  </div>
                  <p className="text-[12px] text-zinc-400 truncate mt-0.5">
                    <span className="text-[#c9a54e] font-medium">{action.client_name}</span>
                    {' · '}{action.building_name}
                  </p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">{action.priority_reason}</p>
                </div>
                <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button
                    onClick={(e) => handleActionComplete(e, action)}
                    className="p-1.5 rounded-lg bg-emerald-900/40 text-emerald-400 hover:bg-emerald-900/60 transition"
                    title="Mark completed"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => handleActionIgnore(e, action)}
                    className="p-1.5 rounded-lg bg-zinc-800/60 text-zinc-400 hover:bg-zinc-700/60 transition"
                    title="Dismiss"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-600 shrink-0" />
              </button>
            ))}
          </div>
          {advisorActions.length > 6 && (
            <div className="px-4 py-2 border-t border-zinc-800/50 text-center">
              <span className="text-[11px] text-zinc-500">+{advisorActions.length - 6} more actions</span>
            </div>
          )}
        </div>
      )}

      {/* ── Conversion Intelligence Card ── */}
      {conversionScores.length > 0 && (
        <div className="mb-6 bg-gradient-to-br from-[#1a1a2e] to-[#16162a] border border-indigo-900/40 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-indigo-900/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-indigo-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Conversion Intelligence</h3>
                <p className="text-[11px] text-zinc-500">Clients most likely to transact</p>
              </div>
            </div>
            <span className="text-[11px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full">
              {conversionScores.length} scored
            </span>
          </div>
          <div className="divide-y divide-indigo-900/20">
            {conversionScores.slice(0, 5).map((conv) => (
              <button
                key={conv.id}
                onClick={() => handleConversionClick(conv)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-indigo-500/[0.08] transition text-left group"
              >
                {/* Score circle */}
                <div className="shrink-0 relative">
                  <div className={`w-11 h-11 rounded-full border-2 flex items-center justify-center font-bold text-lg ${
                    conv.conversion_score >= 70 ? 'border-emerald-500 text-emerald-400' :
                    conv.conversion_score >= 40 ? 'border-amber-500 text-amber-400' :
                    'border-zinc-600 text-zinc-400'
                  }`}>
                    {conv.conversion_score}
                  </div>
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-white font-medium truncate">{conv.client_name}</p>
                    {conv.dropoff_risk >= 50 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full text-red-400 bg-red-900/30 border border-red-800/50 flex items-center gap-0.5">
                        <AlertCircle className="w-2.5 h-2.5" /> at-risk
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className={`text-[11px] font-medium ${getScoreColor(conv.buying_probability)}`}>
                      {conv.buying_probability}% likely to buy
                    </span>
                    {conv.urgency_score >= 60 && (
                      <span className="text-[10px] text-amber-400 flex items-center gap-0.5">
                        <Zap className="w-2.5 h-2.5" /> urgent
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-0.5 truncate">{conv.signal_summary}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-600 shrink-0" />
              </button>
            ))}
          </div>
          {conversionScores.length > 5 && (
            <div className="px-4 py-2 border-t border-indigo-900/30 text-center">
              <span className="text-[11px] text-zinc-500">+{conversionScores.length - 5} more scored clients</span>
            </div>
          )}
        </div>
      )}

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
