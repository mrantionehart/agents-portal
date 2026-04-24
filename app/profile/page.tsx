'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '../providers'
import { ArrowLeft, User, Mail, Phone, MapPin, Loader2, Save, CheckCircle } from 'lucide-react'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface Profile {
  id: string
  full_name: string
  email: string
  phone?: string
  location?: string
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
  const [form, setForm] = useState({ full_name: '', phone: '', location: '', bio: '', license_number: '' })

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [user, authLoading, router])

  useEffect(() => {
    if (user) fetchProfile()
  }, [user])

  const fetchProfile = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user!.id)
        .single()

      if (error) throw error
      setProfile(data)
      setForm({
        full_name: data.full_name || '',
        phone: data.phone || '',
        location: data.location || '',
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
    try {
      const { error } = await supabase
        .from('profiles')
        .update(form)
        .eq('id', user!.id)

      if (error) throw error
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      alert('Error saving profile. Please try again.')
    }
    setSaving(false)
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
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Location</label>
                <input
                  type="text"
                  value={form.location}
                  onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl bg-[#0a0a0f]/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-[#C9A84C]/50 transition"
                  placeholder="City, State"
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

            {/* Save Button */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-gradient-to-r from-[#C9A84C] to-[#A88A3C] text-[#050507] font-bold text-sm hover:opacity-90 transition disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
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
          </div>
        )}
      </div>
    </div>
  )
}
