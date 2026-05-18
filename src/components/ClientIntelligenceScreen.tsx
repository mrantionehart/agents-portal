'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Search, Brain, Flame, Thermometer, Snowflake,
  User, Phone, Mail, MapPin, DollarSign, Clock,
  ChevronRight, ArrowLeft, HandMetal, CheckCircle2,
  AlertCircle, Eye, Building2, Tag,
} from 'lucide-react';

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

type Tab = 'dispo' | 'mine';

export default function ClientIntelligenceScreen() {
  const [profiles, setProfiles] = useState<ClientProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('mine');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProfile, setSelectedProfile] = useState<ClientProfile | null>(null);
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
      setSelectedProfile(json.data);
      fetchProfiles();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setClaiming(false);
    }
  };

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

  // ── Detail View ──
  if (selectedProfile) {
    const p = selectedProfile;
    return (
      <div className="min-h-screen bg-[#0f0f0f] text-white p-6">
        <button
          onClick={() => { setSelectedProfile(null); setError(''); setSuccess(''); }}
          className="flex items-center gap-2 text-zinc-400 hover:text-white mb-6 transition"
        >
          <ArrowLeft className="w-4 h-4" /> Back to list
        </button>

        {error && (
          <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 mb-4 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <span className="text-red-300 text-sm">{error}</span>
          </div>
        )}
        {success && (
          <div className="bg-emerald-900/30 border border-emerald-800 rounded-lg p-3 mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-emerald-300 text-sm">{success}</span>
          </div>
        )}

        {/* Header Card */}
        <div className="bg-[#1a1a1a] border border-zinc-800 rounded-xl p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-white">{p.full_name}</h1>
              <div className="flex items-center gap-3 mt-2">
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${getTypeBadge(p.profile_type)}`}>
                  {p.profile_type.charAt(0).toUpperCase() + p.profile_type.slice(1)}
                </span>
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${getTemperatureBadge(p.temperature)}`}>
                  {getTemperatureIcon(p.temperature)}
                  {p.temperature.toUpperCase()}
                </span>
              </div>
            </div>
            {p.status === 'dispo' && !p.claimed_by && (
              <button
                onClick={() => handleClaim(p.id)}
                disabled={claiming}
                className="px-5 py-2.5 bg-[#c9a54e] text-black font-bold rounded-lg hover:bg-[#d4b35e] transition disabled:opacity-50"
              >
                {claiming ? 'Claiming...' : 'Claim This Lead'}
              </button>
            )}
          </div>

          {/* Contact Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            {p.email && (
              <div className="flex items-center gap-2 text-zinc-400">
                <Mail className="w-4 h-4" />
                <a href={`mailto:${p.email}`} className="text-[#c9a54e] hover:underline text-sm">{p.email}</a>
              </div>
            )}
            {p.phone && (
              <div className="flex items-center gap-2 text-zinc-400">
                <Phone className="w-4 h-4" />
                <a href={`tel:${p.phone}`} className="text-[#c9a54e] hover:underline text-sm">{p.phone}</a>
              </div>
            )}
            {p.source && (
              <div className="flex items-center gap-2 text-zinc-400">
                <Tag className="w-4 h-4" />
                <span className="text-sm">Source: {p.source}</span>
              </div>
            )}
          </div>
        </div>

        {/* Intelligence Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Financial */}
          {(p.budget_min || p.budget_max) && (
            <div className="bg-[#1a1a1a] border border-zinc-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <DollarSign className="w-4 h-4" /> Budget
              </h3>
              <p className="text-white text-lg font-semibold">
                {formatCurrency(p.budget_min)} — {formatCurrency(p.budget_max)}
              </p>
            </div>
          )}

          {/* Target Areas */}
          {p.target_areas && p.target_areas.length > 0 && (
            <div className="bg-[#1a1a1a] border border-zinc-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <MapPin className="w-4 h-4" /> Target Areas
              </h3>
              <div className="flex flex-wrap gap-2">
                {p.target_areas.map((a, i) => (
                  <span key={i} className="px-2.5 py-1 bg-zinc-800 text-zinc-300 rounded-md text-sm">{a}</span>
                ))}
              </div>
            </div>
          )}

          {/* Timeline */}
          {p.timeline && (
            <div className="bg-[#1a1a1a] border border-zinc-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4" /> Timeline
              </h3>
              <p className="text-white">{p.timeline}</p>
            </div>
          )}

          {/* Motivation */}
          {p.motivation && (
            <div className="bg-[#1a1a1a] border border-zinc-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">Motivation</h3>
              <p className="text-zinc-300 leading-relaxed">{p.motivation}</p>
            </div>
          )}

          {/* Pain Points */}
          {p.pain_points && (
            <div className="bg-[#1a1a1a] border border-zinc-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">Pain Points</h3>
              <p className="text-zinc-300 leading-relaxed">{p.pain_points}</p>
            </div>
          )}

          {/* Personality Notes */}
          {p.personality_notes && (
            <div className="bg-[#1a1a1a] border border-zinc-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">Personality Notes</h3>
              <p className="text-zinc-300 leading-relaxed">{p.personality_notes}</p>
            </div>
          )}

          {/* Suggested Approach */}
          {p.suggested_approach && (
            <div className="bg-[#1a1a1a] border border-[#c9a54e]/30 rounded-xl p-5 md:col-span-2">
              <h3 className="text-sm font-semibold text-[#c9a54e] uppercase tracking-wider mb-3">Suggested Approach</h3>
              <p className="text-zinc-300 leading-relaxed">{p.suggested_approach}</p>
            </div>
          )}

          {/* Property Preferences */}
          {p.property_preferences && (
            <div className="bg-[#1a1a1a] border border-zinc-800 rounded-xl p-5 md:col-span-2">
              <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Building2 className="w-4 h-4" /> Property Preferences
              </h3>
              <p className="text-zinc-300 leading-relaxed">{p.property_preferences}</p>
            </div>
          )}
        </div>

        {/* Assignment Info */}
        {p.assigned_agent_name && (
          <div className="mt-4 bg-[#1a1a1a] border border-zinc-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-2">Assignment</h3>
            <p className="text-white">
              <span className="text-zinc-400">Assigned to:</span> {p.assigned_agent_name}
              {p.claimed_at && (
                <span className="text-zinc-500 text-sm ml-2">· Claimed {formatDate(p.claimed_at)}</span>
              )}
            </p>
          </div>
        )}
      </div>
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
              onClick={() => setSelectedProfile(p)}
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
