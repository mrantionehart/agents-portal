'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '../providers'
import { ArrowLeft, User, Mail, Phone, MapPin, Loader2, Save, CheckCircle } from 'lucide-react'
import { useState, useEffect } from 'react'
import { supabase, authFetch } from '@/lib/supabase'
import ProfileBirthdaySection from '@/src/portal/profile/ProfileBirthdaySection'
import MarketingProfileSection from '@/src/portal/marketing-profile/MarketingProfileSection'

interface Profile {
  id: string
  full_name: string
  email: string
  phone?: string
  bio?: string
  avatar_url?: string
  license_number?: string
  role: string
}

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  // `location` is intentionally absent: there is no such column on `profiles`.
  // Submitting it is what made every save fail (42703) — see /api/profile.
  const [form, setForm] = useState({ full_name: '', phone: '', bio: '', license_number: '' })
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [user, authLoading, router])

  useEffect(() => {
    if (user) fetchProfile()
  }, [user])

  const fetchProfile = async () => {
    setLoading(true)
    try {
      // Defense-in-depth: race the query against a timeout so `loading` ALWAYS
      // resolves and the page renders. The root deadlock (a re-entrant Supabase
      // call inside onAuthStateChange) is fixed in AuthProvider, but Supabase's
      // client session read still uses the shared navigator auth lock; under
      // pathological cross-tab contention it could stall. On timeout we render the
      // page anyway — the birthday + marketing-card sections use the lock-free
      // authFetch/API paths, so they load regardless of this direct query.
      const query = supabase.from('profiles').select('*').eq('id', user!.id).single()
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('profile-load-timeout')), 6000),
      )
      const { data, error } = (await Promise.race([query, timeout])) as Awaited<typeof query>

      if (error) throw error
      setProfile(data)
      setForm({
        full_name: data.full_name || '',
        phone: data.phone || '',
        bio: data.bio || '',
        license_number: data.license_number || '',
      })
    } catch (e) {
      console.error('Error fetching profile:', e)
    }
    setLoading(false)
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    setSaved(false)
    try {
      // Server route, not a browser-direct table write. The route allowlists
      // the editable columns and CONFIRMS a row actually changed before it
      // reports success — a filtered UPDATE that matches nothing is not an
      // error in PostgREST, which is how the old code could claim to save
      // while persisting nothing.
      const res = await authFetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json().catch(() => null)

      if (!res.ok || !json?.success) {
        setSaveError(json?.error ?? 'Save failed. Please try again.')
        return
      }

      // Re-seed the form from what the SERVER persisted, so what is on screen
      // is what is in the database.
      if (json.profile) {
        setForm({
          full_name: json.profile.full_name || '',
          phone: json.profile.phone || '',
          bio: json.profile.bio || '',
          license_number: json.profile.license_number || '',
        })
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      setSaveError('Save failed. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (authLoading || !user) return null

  return (
    <div className="min-h-screen bg-[#050507] text-white">
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-5">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 rounded-lg bg-[#0a0a0f]/5 hover:bg-[#0a0a0f]/10 transition">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold">My Profile</h1>
            <p className="text-sm text-gray-400 mt-0.5">{user.email}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-[#C9A84C]" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Avatar + Role */}
            <div className="flex items-center gap-4 p-5 rounded-xl bg-[#0a0a1a] border border-white/5">
              <div className="w-16 h-16 rounded-full bg-[#C9A84C]/20 flex items-center justify-center text-xl font-bold text-[#C9A84C]">
                {form.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?'}
              </div>
              <div>
                <p className="text-lg font-bold">{form.full_name || 'Agent'}</p>
                <p className="text-sm text-gray-400 capitalize">{profile?.role || 'agent'}</p>
              </div>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={form.full_name}
                  onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl bg-[#0a0a0f]/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-[#C9A84C]/50 transition"
                  placeholder="Your full name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Phone</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl bg-[#0a0a0f]/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-[#C9A84C]/50 transition"
                  placeholder="(555) 123-4567"
                />
              </div>
              {profile?.role !== 'office_manager' && (
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">License Number</label>
                <input
                  type="text"
                  value={form.license_number}
                  onChange={e => setForm(f => ({ ...f, license_number: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl bg-[#0a0a0f]/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-[#C9A84C]/50 transition"
                  placeholder="RE license #"
                />
              </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Bio</label>
                <textarea
                  value={form.bio}
                  onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl bg-[#0a0a0f]/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-[#C9A84C]/50 transition resize-none"
                  placeholder="A short bio about yourself..."
                />
              </div>
            </div>

            {/* Birthday — saves through Vault (system of record), month/day only */}
            <ProfileBirthdaySection />

            {/* Marketing Card — headshot + preferred public phone + readiness
                (Vault companion contracts; server-owned readiness/capabilities) */}
            <MarketingProfileSection />

            {/* Save Button */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-gradient-to-r from-[#C9A84C] to-[#A88A3C] text-[#050507] font-bold text-sm hover:opacity-90 transition disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving…
                </>
              ) : saved ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Saved!
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Profile
                </>
              )}
            </button>

            {/* Failure is shown inline and persists until the next attempt.
                The previous code used a blocking alert(), which is dismissable
                without being read — and was invisible to automated checks. */}
            {saveError && (
              <p role="alert" className="mt-2 text-sm text-red-400">
                Save failed — {saveError}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
