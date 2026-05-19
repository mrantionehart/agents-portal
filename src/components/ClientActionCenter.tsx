'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Phone, FileText, Shield, Home, Clock, TrendingUp,
  Users, Send, Loader2, X, CheckCircle, AlertCircle,
  ChevronDown, ChevronUp, Mail, Zap, Star, Eye,
  MessageSquare, Sparkles, Repeat, ArrowRight,
  Calendar, DollarSign,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

interface ProfileData {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  profile_type: string;
  temperature: string;
  budget_min: number | null;
  budget_max: number | null;
  target_areas: string[];
  property_preferences: string | null;
  timeline: string | null;
  qualification_timeline?: string | null;
  purchase_method?: string | null;
  purchase_intent?: string | null;
  proof_status?: string | null;
  preapproved_status?: string | null;
  representation_status?: string | null;
  readiness_score?: number;
  status: string;
}

interface ActionLog {
  id: string;
  action: string;
  channel: string;
  status: string;
  subject: string;
  date: string;
}

interface ClientActionCenterProps {
  profile: ProfileData;
  timeline: ActionLog[];
  showToast: (message: string, type?: 'success' | 'error') => void;
  onActionSent?: () => void;
  highlightedAction?: string | null;
}

// ── Action Definitions ─────────────────────────────────────────────────────

type Urgency = 'immediate' | 'recommended' | 'nurture';

interface ActionDef {
  key: string;
  label: string;
  icon: React.ElementType;
  color: string;
  description: string;
}

const ACTIONS: ActionDef[] = [
  { key: 'discovery_call', label: 'Discovery Call', icon: Phone, color: '#22c55e', description: 'Schedule an initial call to understand needs and build rapport.' },
  { key: 'request_pof', label: 'Request Proof of Funds', icon: DollarSign, color: '#ef4444', description: 'Get financial verification to strengthen your position.' },
  { key: 'buyer_rep_agreement', label: 'Buyer Rep Agreement', icon: FileText, color: '#8b5cf6', description: 'Formalize the representation relationship.' },
  { key: 'curated_listings', label: 'Curated Listings', icon: Home, color: '#3b82f6', description: 'Send personalized property matches.' },
  { key: 'follow_up_7day', label: '7-Day Follow Up', icon: Clock, color: '#f59e0b', description: 'Check in and keep momentum going.' },
  { key: 'schedule_consultation', label: 'Schedule Consultation', icon: Calendar, color: '#06b6d4', description: 'Book a strategy meeting.' },
  { key: 'investment_opportunities', label: 'Investment Opportunities', icon: TrendingUp, color: '#10b981', description: 'Share ROI-focused property options.' },
];

// ── Urgency Config ─────────────────────────────────────────────────────────

const urgencyConfig: Record<Urgency, { dot: string; label: string; bg: string; text: string; border: string }> = {
  immediate: { dot: 'bg-red-500', label: 'Immediate', bg: 'bg-red-950/30', text: 'text-red-400', border: 'border-red-900/50' },
  recommended: { dot: 'bg-amber-500', label: 'Recommended', bg: 'bg-amber-950/20', text: 'text-amber-400', border: 'border-amber-900/50' },
  nurture: { dot: 'bg-emerald-500', label: 'Nurture', bg: 'bg-emerald-950/20', text: 'text-emerald-400', border: 'border-emerald-900/50' },
};

// ── Tone Variations ────────────────────────────────────────────────────────

const TONES = [
  { key: 'professional', label: 'Professional', icon: '💼' },
  { key: 'luxury', label: 'Luxury Editorial', icon: '✨' },
  { key: 'friendly', label: 'Friendly', icon: '😊' },
  { key: 'investor', label: 'Investor', icon: '📊' },
  { key: 'direct', label: 'Direct', icon: '🎯' },
  { key: 'from_the_hart', label: 'From The Hart', icon: '🔥' },
];

// ── Recommendation Engine ──────────────────────────────────────────────────

interface RecommendationResult {
  key: string;
  urgency: Urgency;
  reasons: string[];
}

function getRecommendedActions(profile: ProfileData): RecommendationResult[] {
  const results: RecommendationResult[] = [];
  const score = profile.readiness_score || 0;
  const temp = profile.temperature;
  const timeline = profile.qualification_timeline || profile.timeline || '';
  const pofMissing = profile.proof_status !== 'verified';
  const noRepAgreement = !profile.representation_status || profile.representation_status === 'unknown' || profile.representation_status === 'unrepresented';
  const preapprovalMissing = profile.preapproved_status !== 'yes' && profile.purchase_method !== 'cash';

  // Request POF
  if (pofMissing && (temp === 'hot' || timeline === 'immediate') && score >= 50) {
    const reasons = ['No proof of funds verified', `Readiness score ${score}/100`];
    if (temp === 'hot') reasons.push('Hot lead — needs docs fast');
    results.push({ key: 'request_pof', urgency: 'immediate', reasons });
  } else if (pofMissing && (timeline === 'active' || score >= 40)) {
    results.push({ key: 'request_pof', urgency: 'recommended', reasons: ['Proof of funds not yet on file', `Active timeline with ${score}/100 readiness`] });
  }

  // Buyer rep agreement
  if (noRepAgreement && score >= 80) {
    results.push({ key: 'buyer_rep_agreement', urgency: 'immediate', reasons: ['No representation agreement signed', `High readiness: ${score}/100`, 'Lock in the client'] });
  } else if (noRepAgreement && score >= 60) {
    results.push({ key: 'buyer_rep_agreement', urgency: 'recommended', reasons: ['Representation not yet formalized', `Score ${score}/100 — approaching sign-ready`] });
  }

  // Schedule consultation
  if ((timeline === 'immediate' && temp === 'hot') || score >= 85) {
    results.push({ key: 'schedule_consultation', urgency: 'immediate', reasons: ['Immediate timeline + hot interest', 'Ready for strategy meeting'] });
  } else if (timeline === 'immediate' || (timeline === 'active' && score >= 60)) {
    results.push({ key: 'schedule_consultation', urgency: 'recommended', reasons: ['Active buyer timeline', 'Strategy alignment needed'] });
  }

  // Curated listings
  if ((timeline === 'immediate' || timeline === 'active') && score >= 50) {
    results.push({ key: 'curated_listings', urgency: 'recommended', reasons: ['Active search phase', `Budget and areas defined`] });
  }

  // Investment opportunities
  if (profile.profile_type === 'investor') {
    const reasons = ['Investor profile detected'];
    if (profile.purchase_intent === '1031_exchange') reasons.push('1031 exchange timeline — time-sensitive');
    results.push({ key: 'investment_opportunities', urgency: profile.purchase_intent === '1031_exchange' ? 'immediate' : 'recommended', reasons });
  }

  // Follow-up
  if (timeline === 'exploring' || timeline === 'long_term') {
    results.push({ key: 'follow_up_7day', urgency: 'nurture', reasons: ['Long-term timeline — stay top of mind', 'Regular touchpoint recommended'] });
  }

  // Discovery call fallback
  if (results.length === 0 || (temp === 'cold' && score < 40)) {
    results.push({ key: 'discovery_call', urgency: results.length === 0 ? 'recommended' : 'nurture', reasons: ['New or early-stage lead', 'Build rapport first'] });
  }

  // Deduplicate, sort by urgency, cap at 5
  const seen = new Set<string>();
  const urgencyOrder: Urgency[] = ['immediate', 'recommended', 'nurture'];
  return results
    .filter(r => { if (seen.has(r.key)) return false; seen.add(r.key); return true; })
    .sort((a, b) => urgencyOrder.indexOf(a.urgency) - urgencyOrder.indexOf(b.urgency))
    .slice(0, 5);
}

// ── Status Icons ───────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'sent': return <Send className="w-3 h-3 text-blue-400" />;
    case 'opened': return <Eye className="w-3 h-3 text-emerald-400" />;
    case 'replied': return <MessageSquare className="w-3 h-3 text-[#c9a54e]" />;
    case 'clicked': return <ArrowRight className="w-3 h-3 text-purple-400" />;
    case 'failed': return <AlertCircle className="w-3 h-3 text-red-400" />;
    default: return <Clock className="w-3 h-3 text-zinc-500" />;
  }
}

function formatSendTime(d: string): string {
  const date = new Date(d);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return isToday ? `Today ${time}` : `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${time}`;
}

// ══════════════════════════════════════════════════════════════════════════
// CLIENT ACTION CENTER COMPONENT
// ══════════════════════════════════════════════════════════════════════════

export default function ClientActionCenter({
  profile,
  timeline,
  showToast,
  onActionSent,
  highlightedAction,
}: ClientActionCenterProps) {
  const [channel, setChannel] = useState<'email' | 'sms' | 'whatsapp'>('email');
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [previewAction, setPreviewAction] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const [customSubject, setCustomSubject] = useState('');
  const [customBody, setCustomBody] = useState('');
  const [generatingTone, setGeneratingTone] = useState<string | null>(null);
  const [actionTemplates, setActionTemplates] = useState<any[]>([]);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const recommendations = getRecommendedActions(profile);

  // Fetch templates on mount
  useEffect(() => {
    fetch(`/api/broker/client-intelligence/${profile.id}/actions`)
      .then(r => r.json())
      .then(d => { if (d.templates) setActionTemplates(d.templates); })
      .catch(() => {});
  }, [profile.id]);

  // Scroll to highlighted action
  useEffect(() => {
    if (highlightedAction && cardRefs.current[highlightedAction]) {
      cardRefs.current[highlightedAction]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Brief pulse animation
      const el = cardRefs.current[highlightedAction];
      if (el) {
        el.classList.add('ring-2', 'ring-[#c9a54e]');
        setTimeout(() => el.classList.remove('ring-2', 'ring-[#c9a54e]'), 2000);
      }
    }
  }, [highlightedAction]);

  // ── Send Action ─────────────────────────────────────────────────────────

  const handleSend = async (actionKey: string) => {
    setSending(actionKey);
    try {
      const res = await fetch(`/api/broker/client-intelligence/${profile.id}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action_key: actionKey,
          channel,
          custom_subject: customSubject || undefined,
          custom_body: customBody || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Send failed', 'error');
      } else {
        showToast(data.message || 'Action sent', 'success');
        setConfirmAction(null);
        setExpandedCard(null);
        setCustomSubject('');
        setCustomBody('');
        onActionSent?.();
      }
    } catch (err: any) {
      showToast(err.message || 'Network error', 'error');
    }
    setSending(null);
  };

  // ── Generate Tone Variation ─────────────────────────────────────────────

  const handleGenerateVariation = async (actionKey: string, tone: string) => {
    setGeneratingTone(tone);
    try {
      const template = actionTemplates.find(t => t.key === actionKey);
      if (!template) { setGeneratingTone(null); return; }

      const isShort = channel !== 'email';
      const res = await fetch(`/api/broker/client-intelligence/${profile.id}/ai-rewrite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tone,
          subject: isShort ? undefined : (customSubject || template.subject),
          template_body: isShort ? (template.sms_body || template.body) : (customBody || template.body),
          channel,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        if (data.subject) setCustomSubject(data.subject);
        setCustomBody(data.body);
        setExpandedCard(actionKey);
        showToast(`Rewritten in ${tone.replace(/_/g, ' ')} tone`, 'success');
      } else {
        showToast(data.error || 'Rewrite failed', 'error');
      }
    } catch {
      showToast('Could not generate variation', 'error');
    }
    setGeneratingTone(null);
  };

  // ── Get action history for a specific key ───────────────────────────────

  const getActionHistory = (actionKey: string): ActionLog[] => {
    return timeline
      .filter(e => e.action?.replace(/\s+/g, '_') === actionKey || e.subject?.toLowerCase().includes(actionKey.replace(/_/g, ' ')))
      .slice(0, 3);
  };

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="bg-[#1a1a1a] border border-zinc-800 rounded-2xl p-5">
      {/* Header + Channel Selector */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-[#c9a54e]" />
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Action Center</h2>
        </div>

        {/* Channel Tabs */}
        <div className="flex bg-zinc-900 rounded-lg p-0.5">
          {([
            { key: 'email' as const, label: 'Email', icon: Mail },
            { key: 'sms' as const, label: 'SMS', icon: MessageSquare },
            { key: 'whatsapp' as const, label: 'WhatsApp', icon: Phone },
          ]).map(ch => (
            <button
              key={ch.key}
              onClick={() => setChannel(ch.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                channel === ch.key
                  ? 'bg-[#c9a54e] text-black'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <ch.icon className="w-3 h-3" />
              {ch.label}
            </button>
          ))}
        </div>
      </div>

      {/* Action Cards */}
      <div className="space-y-3">
        {recommendations.map((rec) => {
          const def = ACTIONS.find(a => a.key === rec.key);
          if (!def) return null;
          const uc = urgencyConfig[rec.urgency];
          const isExpanded = expandedCard === rec.key;
          const history = getActionHistory(rec.key);
          const Icon = def.icon;

          return (
            <div
              key={rec.key}
              ref={el => { cardRefs.current[rec.key] = el; }}
              className={`rounded-xl border transition-all duration-300 ${uc.border} ${uc.bg}`}
            >
              {/* Card Header — always visible */}
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${def.color}15` }}>
                      <Icon className="w-4 h-4" style={{ color: def.color }} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-white text-sm font-semibold">{def.label}</h3>
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${uc.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${uc.dot}`} />
                          {uc.label}
                        </span>
                      </div>
                      <p className="text-zinc-500 text-xs mt-0.5">{def.description}</p>
                    </div>
                  </div>
                </div>

                {/* AI Reasoning */}
                <div className="mt-3 mb-3">
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">Why this action</p>
                  <div className="space-y-1">
                    {rec.reasons.map((reason, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <Sparkles className="w-3 h-3 text-[#c9a54e] mt-0.5 flex-shrink-0" />
                        <span className="text-xs text-zinc-400">{reason}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Send Tracking */}
                {history.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {history.map((h, i) => (
                      <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-900/80 text-[10px] text-zinc-400">
                        <StatusIcon status={h.status} />
                        <span className="capitalize">{h.status}</span>
                        <span className="text-zinc-600">·</span>
                        <span>{formatSendTime(h.date)}</span>
                      </span>
                    ))}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setConfirmAction(rec.key)}
                    disabled={sending === rec.key}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#c9a54e] text-black text-xs font-bold rounded-lg hover:bg-[#d4b35e] transition disabled:opacity-50"
                  >
                    {sending === rec.key ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Send className="w-3 h-3" />
                    )}
                    Send
                  </button>
                  <button
                    onClick={() => setPreviewAction(rec.key)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 text-zinc-300 text-xs rounded-lg hover:bg-zinc-700 transition"
                  >
                    <Eye className="w-3 h-3" /> Preview
                  </button>
                  <button
                    onClick={() => setExpandedCard(isExpanded ? null : rec.key)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 text-zinc-300 text-xs rounded-lg hover:bg-zinc-700 transition"
                  >
                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    Customize
                  </button>
                </div>
              </div>

              {/* Expanded — Edit + Tone Variations */}
              {isExpanded && (
                <div className="border-t border-zinc-800/50 p-4 space-y-4">
                  {/* Tone Variation Buttons */}
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Generate Variation</p>
                    <div className="flex flex-wrap gap-1.5">
                      {TONES.map(tone => (
                        <button
                          key={tone.key}
                          onClick={() => handleGenerateVariation(rec.key, tone.key)}
                          disabled={!!generatingTone}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-zinc-800 text-zinc-300 text-[11px] rounded-lg hover:bg-zinc-700 hover:text-white transition disabled:opacity-50"
                        >
                          {generatingTone === tone.key ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <span>{tone.icon}</span>
                          )}
                          {tone.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Subject line (email only) */}
                  {channel === 'email' && (
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-zinc-500 block mb-1.5">Subject</label>
                      <input
                        type="text"
                        value={customSubject}
                        onChange={e => setCustomSubject(e.target.value)}
                        placeholder={actionTemplates.find(t => t.key === rec.key)?.subject || 'Custom subject...'}
                        className="w-full px-3 py-2 bg-[#111] border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-600 focus:border-[#c9a54e]/50 focus:outline-none"
                      />
                    </div>
                  )}

                  {/* Body */}
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-zinc-500 block mb-1.5">
                      {channel === 'email' ? 'Body' : 'Message'}
                    </label>
                    <textarea
                      value={customBody}
                      onChange={e => setCustomBody(e.target.value)}
                      placeholder="Custom message..."
                      rows={channel === 'email' ? 6 : 3}
                      className="w-full px-3 py-2 bg-[#111] border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-600 focus:border-[#c9a54e]/50 focus:outline-none resize-none"
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Preview Modal ────────────────────────────────────────────────── */}
      {previewAction && (() => {
        const template = actionTemplates.find(t => t.key === previewAction);
        const def = ACTIONS.find(a => a.key === previewAction);
        if (!template || !def) return null;

        // Simple variable replacement for preview
        const vars: Record<string, string> = {
          client_name: profile.full_name?.split(' ')[0] || 'there',
          target_areas: profile.target_areas?.join(', ') || 'your target areas',
          budget_range: profile.budget_min && profile.budget_max
            ? `$${(profile.budget_min / 1000).toFixed(0)}K – $${(profile.budget_max / 1000).toFixed(0)}K`
            : 'your range',
          property_preferences: profile.property_preferences || 'your criteria',
          agent_name: 'Your Agent',
          brokerage: 'HartFelt Real Estate',
          phone: '',
        };
        const replaceVars = (t: string) => t.replace(/\{\{(\w+)\}\}/g, (m, k) => vars[k] || m);

        const previewContent = channel === 'email'
          ? (customBody || template.body)
          : (customBody || template.sms_body || template.body?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());

        return (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setPreviewAction(null)}>
            <div className="bg-[#1a1a1a] border border-zinc-700 rounded-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-[#c9a54e]" />
                  <h3 className="text-white font-semibold text-sm">{def.label} — Preview</h3>
                </div>
                <button onClick={() => setPreviewAction(null)} className="text-zinc-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4">
                {channel === 'email' && (
                  <div className="mb-3 px-3 py-2 bg-zinc-900 rounded-lg">
                    <span className="text-[10px] uppercase text-zinc-500">Subject: </span>
                    <span className="text-sm text-white">{replaceVars(customSubject || template.subject)}</span>
                  </div>
                )}
                {channel === 'email' ? (
                  <div
                    className="prose prose-invert prose-sm max-w-none bg-zinc-900/50 rounded-lg p-4"
                    dangerouslySetInnerHTML={{ __html: replaceVars(previewContent) }}
                  />
                ) : (
                  <div className="bg-zinc-900/50 rounded-lg p-4">
                    <p className="text-zinc-200 text-sm whitespace-pre-wrap">{replaceVars(previewContent)}</p>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 p-4 border-t border-zinc-800">
                <button
                  onClick={() => { setPreviewAction(null); setConfirmAction(previewAction); }}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-[#c9a54e] text-black text-sm font-bold rounded-lg hover:bg-[#d4b35e] transition"
                >
                  <Send className="w-3.5 h-3.5" /> Send This
                </button>
                <button
                  onClick={() => setPreviewAction(null)}
                  className="px-4 py-2 bg-zinc-800 text-zinc-300 text-sm rounded-lg hover:bg-zinc-700 transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Confirm Modal ────────────────────────────────────────────────── */}
      {confirmAction && (() => {
        const def = ACTIONS.find(a => a.key === confirmAction);
        const rec = recommendations.find(r => r.key === confirmAction);
        if (!def) return null;

        const channelLabels: Record<string, string> = { email: 'Email', sms: 'SMS', whatsapp: 'WhatsApp' };
        const recipient = channel === 'email' ? profile.email : profile.phone;
        const missingContact = !recipient;

        return (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setConfirmAction(null)}>
            <div className="bg-[#1a1a1a] border border-zinc-700 rounded-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
              <div className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Send className="w-5 h-5 text-[#c9a54e]" />
                  <h3 className="text-white font-semibold">Confirm Send</h3>
                </div>

                <div className="space-y-3 mb-5">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">Action</span>
                    <span className="text-white font-medium">{def.label}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">Channel</span>
                    <span className="text-white font-medium">{channelLabels[channel]}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">Recipient</span>
                    <span className={`font-medium ${missingContact ? 'text-red-400' : 'text-white'}`}>
                      {recipient || `No ${channel === 'email' ? 'email' : 'phone'} on file`}
                    </span>
                  </div>
                </div>

                {/* AI Reasoning in confirm */}
                {rec && rec.reasons.length > 0 && (
                  <div className="bg-zinc-900/50 rounded-lg p-3 mb-5">
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">AI Analysis</p>
                    {rec.reasons.map((r, i) => (
                      <div key={i} className="flex items-start gap-2 mb-1">
                        <Sparkles className="w-3 h-3 text-[#c9a54e] mt-0.5 flex-shrink-0" />
                        <span className="text-xs text-zinc-400">{r}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSend(confirmAction)}
                    disabled={!!sending || missingContact}
                    className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#c9a54e] text-black text-sm font-bold rounded-lg hover:bg-[#d4b35e] transition disabled:opacity-50"
                  >
                    {sending === confirmAction ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    Confirm Send
                  </button>
                  <button
                    onClick={() => setConfirmAction(null)}
                    className="px-4 py-2.5 bg-zinc-800 text-zinc-300 text-sm rounded-lg hover:bg-zinc-700 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
