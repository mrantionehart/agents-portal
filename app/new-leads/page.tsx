'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '../providers'
import { ArrowLeft, UserPlus, MapPin, Home, Clock, Flame, Zap, Phone, Mail, DollarSign, Loader2, CheckCircle } from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

interface NewLead {
  id: string
  name: string
  email?: string
  phone?: string
  property_address?: string
  lead_type: string
  urgency: string
  budget?: string
  timeline?: string
  notes?: string
  listing_info?: string
  status: 'available' | 'claimed'
  claimed_by: string | null
  claimed_by_name: string | null
  claimed_at: string | null
  created_at: string
}

export default function NewLeadsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [leads, setLeads] = useState<NewLead[]>([])
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState<string | null>(null)
  const [filter, setFilter] = useState<'available' | 'mine' | 'all'>('available')

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [user, authLoading, router])

  useEffect(() => {
    if (user) fetchLeads()
  }, [user, filter])

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('new_leads')
        .select('*')
        .order('created_at', { ascending: false })

      if (filter === 'available') {
        query = query.is('claimed_by', null)
      } else if (filter === 'mine') {
        query = query.eq('claimed_by', user!.id)
      }

      const { data, error } = await query
      if (error) throw error
      setLeads(data || [])
    } catch (e) {
      console.error('Error fetching leads:', e)
    }
    setLoading(false)
  }, [user, filter])

  const handleClaim = async (lead: NewLead) => {
    if (!confirm(`Claim ${lead.name}?\n\nOnce claimed, this lead will be assigned to you and other agents won't be able to claim it.`)) return

    setClaiming(lead.id)
    try {
      // Check if still available
      const { data: check } = await supabase
        .from('new_leads')
        .select('claimed_by')
        .eq('id', lead.id)
        .single()

      if (check?.claimed_by) {
        alert('Another agent already claimed this lead.')
        fetchLeads()
        setClaiming(null)
        return
      }

      // Get agent name
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user!.id)
        .single()

      const { error } = await supabase
        .from('new_leads')
        .update({
          claimed_by: user!.id,
          claimed_by_name: profile?.full_name || user!.email,
          claimed_at: new Date().toISOString(),
          status: 'claimed',
        })
        .eq('id', lead.id)

      if (error) throw error

      alert(`Lead claimed! ${lead.name} is now yours.`)
      fetchLeads()
    } catch (e) {
      alert('Could not claim this lead. Please try again.')
    }
    setClaiming(null)
  }

  const getTypeColor = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'buyer': return { bg: 'bg-[#2EC4D6]/10', text: 'text-[#2EC4D6]', border: 'border-[#2EC4D6]/20' }
      case 'seller': return { bg: 'bg-[#C9A84C]/10', text: 'text-[#C9A84C]', border: 'border-[#C9A84C]/20' }
      case 'investor': return { bg: 'bg-purple-500/100/10', text: 'text-purple-400', border: 'border-purple-500/20' }
      case 'renter': return { bg: 'bg-green-500/100/10', text: 'text-green-400', border: 'border-green-500/20' }
      default: return { bg: 'bg-[#050507]0/10', text: 'text-gray-400', border: 'border-[#1a1a2e]0/20' }
    }
  }

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case 'hot': return { bg: 'bg-red-500/100/15', text: 'text-red-400', label: 'HOT', icon: Flame }
      case 'warm': return { bg: 'bg-yellow-500/100/15', text: 'text-yellow-400', label: 'WARM', icon: Zap }
      default: return { bg: 'bg-[#2EC4D6]/15', text: 'text-[#2EC4D6]', label: 'NEW', icon: Zap }
    }
  }

  const isMine = (lead: NewLead) => lead.claimed_by === user?.id

  if (authLoading || !user) return null

  return (
    <div className="min-h-screen bg-[#050507] text-white">
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="p-2 rounded-lg bg-[#0a0a0f]/5 hover:bg-[#0a0a0f]/10 transition">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold">New Leads</h1>
              <p className="text-sm text-gray-400 mt-0.5">{leads.length} lead{leads.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mt-4">
          {([
            { key: 'available' as const, label: 'Available' },
            { key: 'mine' as const, label: 'My Claims' },
            { key: 'all' as const, label: 'All Leads' },
          ]).map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                filter === f.key
                  ? 'bg-[#C9A84C]/20 text-[#C9A84C] border border-[#C9A84C]/30'
                  : 'bg-[#0a0a0f]/5 text-gray-400 hover:bg-[#0a0a0f]/10 border border-transparent'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-[#C9A84C]" />
          </div>
        ) : leads.length === 0 ? (
          <div className="text-center py-20">
            <UserPlus className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-400 text-lg font-medium">
              {filter === 'available' ? 'No leads available right now' : filter === 'mine' ? "You haven't claimed any leads yet" : 'No leads posted yet'}
            </p>
            <p className="text-gray-400 text-sm mt-1">New leads will appear here when your broker posts them.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {leads.map(lead => {
              const urgency = getUrgencyBadge(lead.urgency)
              const typeStyle = getTypeColor(lead.lead_type)
              const claimed = !!lead.claimed_by
              const mine = isMine(lead)
              const UrgencyIcon = urgency.icon

              return (
                <div
                  key={lead.id}
                  className={`rounded-xl border p-5 transition ${
                    mine
                      ? 'bg-[#0a0a1a] border-green-500/20'
                      : 'bg-[#0a0a1a] border-white/5 hover:border-white/10'
                  }`}
                >
                  {/* Top: Name + Badges */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-lg font-bold text-white">{lead.name}</h3>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider ${urgency.bg} ${urgency.text}`}>
                          {urgency.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${typeStyle.bg} ${typeStyle.text}`}>
                          {lead.lead_type || 'Lead'}
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(lead.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          {' at '}
                          {new Date(lead.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Property Address */}
                  {lead.property_address && (
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/5">
                      <Home className="w-4 h-4 text-[#2EC4D6] flex-shrink-0" />
                      <p className="text-sm text-gray-400">{lead.property_address}</p>
                    </div>
                  )}

                  {/* Notes */}
                  {lead.notes && (
                    <p className="text-sm text-gray-400 italic mt-2">{lead.notes}</p>
                  )}

                  {/* Listing Info */}
                  {lead.listing_info && (
                    <div className="bg-[#C9A84C]/5 rounded-lg p-3 mt-3 text-sm text-gray-400">
                      {lead.listing_info}
                    </div>
                  )}

                  {/* Contact Info (only for claimed-by-me) */}
                  {mine && (
                    <div className="bg-[#2EC4D6]/5 border border-[#2EC4D6]/15 rounded-lg p-4 mt-3 space-y-2">
                      <p className="text-[10px] font-bold tracking-widest text-[#2EC4D6] mb-2">CONTACT INFORMATION</p>
                      {lead.phone && (
                        <a href={`tel:${lead.phone}`} className="flex items-center gap-2 text-sm text-gray-400 hover:text-[#2EC4D6] transition">
                          <Phone className="w-4 h-4 text-[#2EC4D6]" /> {lead.phone}
                        </a>
                      )}
                      {lead.email && (
                        <a href={`mailto:${lead.email}`} className="flex items-center gap-2 text-sm text-gray-400 hover:text-[#2EC4D6] transition">
                          <Mail className="w-4 h-4 text-[#2EC4D6]" /> {lead.email}
                        </a>
                      )}
                      {lead.budget && (
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                          <DollarSign className="w-4 h-4 text-[#C9A84C]" /> Budget: {lead.budget}
                        </div>
                      )}
                      {lead.timeline && (
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                          <Clock className="w-4 h-4 text-[#C9A84C]" /> Timeline: {lead.timeline}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Claimed by other */}
                  {claimed && !mine && (
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/5 text-sm text-gray-400">
                      <CheckCircle className="w-4 h-4" />
                      Claimed by {lead.claimed_by_name}
                    </div>
                  )}

                  {/* Claim Button */}
                  {!claimed && (
                    <button
                      onClick={() => handleClaim(lead)}
                      disabled={claiming === lead.id}
                      className="w-full mt-4 py-3 rounded-xl bg-gradient-to-r from-[#C9A84C] to-[#A88A3C] text-[#050507] font-bold text-sm hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {claiming === lead.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <UserPlus className="w-4 h-4" />
                          Claim This Lead
                        </>
                      )}
                    </button>
                  )}

                  {/* My Claim Badge */}
                  {mine && (
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/5 text-sm text-green-400">
                      <CheckCircle className="w-4 h-4" />
                      You claimed this lead
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
