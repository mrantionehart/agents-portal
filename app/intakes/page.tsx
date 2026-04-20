'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '../providers'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Phone, Mail, Archive, CheckCircle, UserPlus, Clock,
  Home, Key, Plane, Tag, ChevronDown, ChevronUp, RefreshCw
} from 'lucide-react'

interface Intake {
  id: string
  agent_id: string
  client_first_name: string
  client_last_name: string
  client_email: string
  client_phone: string
  transaction_type: 'buy' | 'sell' | 'rent' | 'relocate'
  budget_min: number | null
  budget_max: number | null
  timeline: string | null
  location_preferences: string | null
  property_type: string | null
  bedrooms_min: number | null
  bathrooms_min: number | null
  current_address: string | null
  estimated_value: number | null
  pre_approval_status: string | null
  lender_name: string | null
  lender_contact: string | null
  notes: string | null
  referral_source: string | null
  status: 'new' | 'contacted' | 'converted' | 'archived'
  created_at: string
  updated_at: string
}

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  contacted: 'bg-[#C9A84C]/20 text-[#C9A84C] border-[#C9A84C]/30',
  converted: 'bg-green-500/20 text-green-400 border-green-500/30',
  archived: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
}

const TYPE_ICONS: Record<string, typeof Home> = {
  buy: Home,
  sell: Tag,
  rent: Key,
  relocate: Plane,
}

const TYPE_LABELS: Record<string, string> = {
  buy: 'Buyer',
  sell: 'Seller',
  rent: 'Renter',
  relocate: 'Relocation',
}

function formatBudget(min: number | null, max: number | null): string {
  const fmt = (v: number | null) => {
    if (!v) return null
    if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`
    if (v >= 1000) return `$${(v / 1000).toFixed(0)}K`
    return `$${v.toLocaleString()}`
  }
  const fMin = fmt(min)
  const fMax = fmt(max)
  if (fMin && fMax) return `${fMin} - ${fMax}`
  if (fMin) return `${fMin}+`
  if (fMax) return `Up to ${fMax}`
  return '-'
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return ''
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHrs = Math.floor(diffMins / 60)
  if (diffHrs < 24) return `${diffHrs}h ago`
  const diffDays = Math.floor(diffHrs / 24)
  if (diffDays === 1) return '1 day ago'
  if (diffDays < 30) return `${diffDays} days ago`
  return date.toLocaleDateString()
}

export default function IntakesPage() {
  const { user, role, loading: authLoading } = useAuth()
  const router = useRouter()
  const [intakes, setIntakes] = useState<Intake[]>([])
  const [intakesLoading, setIntakesLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)

  useEffect(() => {
    if (user) loadIntakes()
  }, [user])

  const loadIntakes = async () => {
    if (!user) return
    try {
      setIntakesLoading(true)
      const { data, error } = await supabase
        .from('client_intakes')
        .select('*')
        .eq('agent_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setIntakes(data || [])
    } catch (err) {
      console.error('Error loading intakes:', err)
      setIntakes([])
    } finally {
      setIntakesLoading(false)
    }
  }

  const updateStatus = async (id: string, newStatus: string) => {
    setUpdating(id)
    try {
      const { error } = await supabase
        .from('client_intakes')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', id)

      if (error) throw error
      setIntakes(prev =>
        prev.map(i => i.id === id ? { ...i, status: newStatus as Intake['status'] } : i)
      )
    } catch (err) {
      console.error('Error updating status:', err)
    } finally {
      setUpdating(null)
    }
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-[#050507]">
        <RefreshCw className="w-8 h-8 text-[#C9A84C] animate-spin" />
      </div>
    )
  }

  if (!user) {
    router.push('/login')
    return null
  }

  const filtered = filter === 'all' ? intakes : intakes.filter(i => i.status === filter)
  const stats = {
    total: intakes.length,
    new: intakes.filter(i => i.status === 'new').length,
    contacted: intakes.filter(i => i.status === 'contacted').length,
    converted: intakes.filter(i => i.status === 'converted').length,
  }

  const filters = ['all', 'new', 'contacted', 'converted', 'archived']

  return (
    <div className="min-h-screen bg-[#050507] text-white p-6 md:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Client Intakes</h1>
        <p className="text-gray-400 mt-1">Manage inquiries from your business card QR code</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Intakes" value={stats.total} color="text-white" />
        <StatCard label="New" value={stats.new} color="text-teal-400" />
        <StatCard label="Contacted" value={stats.contacted} color="text-[#C9A84C]" />
        <StatCard label="Converted" value={stats.converted} color="text-green-400" />
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {filters.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition capitalize ${
              filter === f
                ? 'bg-[#C9A84C]/20 text-[#C9A84C] border border-[#C9A84C]/40'
                : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
            }`}
          >
            {f === 'all' ? `All (${intakes.length})` : `${f} (${intakes.filter(i => i.status === f).length})`}
          </button>
        ))}
      </div>

      {/* Content */}
      {intakesLoading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-8 h-8 text-[#C9A84C] animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <UserPlus className="w-16 h-16 text-gray-600 mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No client inquiries yet</h3>
          <p className="text-gray-400 max-w-md">
            Share your business card to start receiving leads!
          </p>
          <button
            onClick={() => router.push('/business-card')}
            className="mt-6 px-6 py-3 bg-[#C9A84C] text-black font-semibold rounded-lg hover:bg-[#B8973F] transition"
          >
            Go to My Card
          </button>
        </div>
      ) : (
        /* Table */
        <div className="border border-white/10 rounded-xl overflow-hidden">
          {/* Table Header */}
          <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 bg-white/5 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            <div className="col-span-3">Client</div>
            <div className="col-span-1">Type</div>
            <div className="col-span-2">Budget</div>
            <div className="col-span-2">Timeline</div>
            <div className="col-span-1">Status</div>
            <div className="col-span-1">Submitted</div>
            <div className="col-span-2">Actions</div>
          </div>

          {/* Rows */}
          {filtered.map(intake => {
            const expanded = expandedId === intake.id
            const TypeIcon = TYPE_ICONS[intake.transaction_type] || Home

            return (
              <div key={intake.id} className="border-t border-white/10">
                {/* Main Row */}
                <div
                  className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 px-6 py-4 hover:bg-white/5 cursor-pointer transition"
                  onClick={() => setExpandedId(expanded ? null : intake.id)}
                >
                  {/* Client */}
                  <div className="col-span-3 flex items-center gap-2">
                    <div>
                      <p className="font-semibold text-white">
                        {intake.client_first_name} {intake.client_last_name}
                      </p>
                      <p className="text-xs text-gray-400 md:hidden">
                        {TYPE_LABELS[intake.transaction_type] || intake.transaction_type}
                      </p>
                    </div>
                  </div>

                  {/* Type */}
                  <div className="hidden md:flex col-span-1 items-center gap-1">
                    <TypeIcon className="w-4 h-4 text-[#C9A84C]" />
                    <span className="text-sm text-gray-300">{TYPE_LABELS[intake.transaction_type]}</span>
                  </div>

                  {/* Budget */}
                  <div className="hidden md:flex col-span-2 items-center text-sm text-gray-300">
                    {formatBudget(intake.budget_min, intake.budget_max)}
                  </div>

                  {/* Timeline */}
                  <div className="hidden md:flex col-span-2 items-center text-sm text-gray-300">
                    {intake.timeline || '-'}
                  </div>

                  {/* Status */}
                  <div className="col-span-1 flex items-center">
                    <span className={`px-2 py-1 rounded-md text-xs font-semibold border capitalize ${STATUS_COLORS[intake.status]}`}>
                      {intake.status}
                    </span>
                  </div>

                  {/* Submitted */}
                  <div className="hidden md:flex col-span-1 items-center text-xs text-gray-400">
                    {timeAgo(intake.created_at)}
                  </div>

                  {/* Actions */}
                  <div className="col-span-2 flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    {intake.status === 'new' && (
                      <button
                        onClick={() => updateStatus(intake.id, 'contacted')}
                        disabled={updating === intake.id}
                        className="p-2 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 transition"
                        title="Mark Contacted"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                    )}
                    {(intake.status === 'new' || intake.status === 'contacted') && (
                      <button
                        onClick={() => updateStatus(intake.id, 'converted')}
                        disabled={updating === intake.id}
                        className="p-2 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-400 transition"
                        title="Convert to Lead"
                      >
                        <UserPlus className="w-4 h-4" />
                      </button>
                    )}
                    {intake.status !== 'archived' && (
                      <button
                        onClick={() => updateStatus(intake.id, 'archived')}
                        disabled={updating === intake.id}
                        className="p-2 rounded-lg bg-gray-500/10 hover:bg-gray-500/20 text-gray-400 transition"
                        title="Archive"
                      >
                        <Archive className="w-4 h-4" />
                      </button>
                    )}
                    {expanded ? (
                      <ChevronUp className="w-4 h-4 text-gray-500 ml-auto" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-500 ml-auto" />
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                {expanded && (
                  <div className="px-6 pb-6 pt-2 bg-white/[0.02] border-t border-white/5">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Contact */}
                      <div className="space-y-2">
                        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Contact</h4>
                        {intake.client_phone && (
                          <a
                            href={`tel:${intake.client_phone}`}
                            className="flex items-center gap-2 text-sm text-teal-400 hover:text-teal-300"
                          >
                            <Phone className="w-4 h-4" /> {intake.client_phone}
                          </a>
                        )}
                        {intake.client_email && (
                          <a
                            href={`mailto:${intake.client_email}`}
                            className="flex items-center gap-2 text-sm text-[#C9A84C] hover:text-[#B8973F]"
                          >
                            <Mail className="w-4 h-4" /> {intake.client_email}
                          </a>
                        )}
                      </div>

                      {/* Property Details */}
                      <div className="space-y-2">
                        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Property</h4>
                        {intake.location_preferences && (
                          <p className="text-sm text-gray-300">Location: {intake.location_preferences}</p>
                        )}
                        {intake.property_type && (
                          <p className="text-sm text-gray-300">Type: {intake.property_type}</p>
                        )}
                        {(intake.bedrooms_min || intake.bathrooms_min) && (
                          <p className="text-sm text-gray-300">
                            {intake.bedrooms_min ? `${intake.bedrooms_min}+ bd` : ''}{' '}
                            {intake.bathrooms_min ? `${intake.bathrooms_min}+ ba` : ''}
                          </p>
                        )}
                        {intake.current_address && (
                          <p className="text-sm text-gray-300">Current: {intake.current_address}</p>
                        )}
                        {intake.estimated_value && (
                          <p className="text-sm text-gray-300">Est. Value: ${Number(intake.estimated_value).toLocaleString()}</p>
                        )}
                      </div>

                      {/* Financial / Notes */}
                      <div className="space-y-2">
                        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Details</h4>
                        {intake.pre_approval_status && (
                          <p className="text-sm text-gray-300">Pre-Approval: {intake.pre_approval_status}</p>
                        )}
                        {intake.lender_name && (
                          <p className="text-sm text-gray-300">
                            Lender: {intake.lender_name}{intake.lender_contact ? ` (${intake.lender_contact})` : ''}
                          </p>
                        )}
                        {intake.referral_source && (
                          <p className="text-sm text-gray-300">Referral: {intake.referral_source}</p>
                        )}
                        {intake.notes && (
                          <p className="text-sm text-gray-300 italic">Notes: {intake.notes}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
      <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  )
}
