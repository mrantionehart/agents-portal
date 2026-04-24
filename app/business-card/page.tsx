'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../providers'
import { supabase } from '@/lib/supabase'
import SidebarNav from '../components/SidebarNav'

interface ProfileData {
  id: string
  full_name: string
  email: string
  title: string
  phone: string
  bio: string
  license_number: string
  avatar_url: string
  website: string
  instagram_handle: string
  facebook_url: string
  linkedin_url: string
  tiktok_handle: string
}

const VAULT_URL = 'https://hartfelt-vault.vercel.app'

export default function BusinessCardPage() {
  const { user, role, loading, signOut } = useAuth()
  const router = useRouter()
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [formData, setFormData] = useState<Partial<ProfileData>>({})
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (user) {
      fetchProfile()
    }
  }, [user])

  const fetchProfile = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, title, phone, bio, license_number, avatar_url, website, instagram_handle, facebook_url, linkedin_url, tiktok_handle')
      .eq('id', user!.id)
      .single()

    if (data) {
      setProfile(data as ProfileData)
      setFormData({
        title: data.title || '',
        phone: data.phone || '',
        bio: data.bio || '',
        website: data.website || '',
        instagram_handle: data.instagram_handle || '',
        facebook_url: data.facebook_url || '',
        linkedin_url: data.linkedin_url || '',
        tiktok_handle: data.tiktok_handle || '',
      })
    }
  }

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    setSaveMessage('')

    const { error } = await supabase
      .from('profiles')
      .update({
        title: formData.title,
        phone: formData.phone,
        bio: formData.bio,
        website: formData.website,
        instagram_handle: formData.instagram_handle,
        facebook_url: formData.facebook_url,
        linkedin_url: formData.linkedin_url,
        tiktok_handle: formData.tiktok_handle,
      })
      .eq('id', user.id)

    if (error) {
      setSaveMessage('Error saving profile. Please try again.')
    } else {
      setSaveMessage('Profile updated successfully!')
      fetchProfile()
    }
    setSaving(false)
    setTimeout(() => setSaveMessage(''), 3000)
  }

  const intakeUrl = profile ? `${VAULT_URL}/intake/${profile.id}` : ''
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(intakeUrl)}`

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(intakeUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
      const textArea = document.createElement('textarea')
      textArea.value = intakeUrl
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleShareEmail = () => {
    const subject = encodeURIComponent(`Connect with ${profile?.full_name || 'me'} - HartFelt Real Estate`)
    const body = encodeURIComponent(
      `Hi,\n\nI'd love to help you with your real estate needs. Use this link to connect with me and get started:\n\n${intakeUrl}\n\nLooking forward to working with you!\n\n${profile?.full_name || ''}\nHartFelt Real Estate`
    )
    window.open(`mailto:?subject=${subject}&body=${body}`)
  }

  const handleShareText = () => {
    const body = encodeURIComponent(
      `Hey! Connect with me for your real estate needs: ${intakeUrl}`
    )
    window.open(`sms:?body=${body}`)
  }

  // Live preview uses formData merged with profile
  const displayName = profile?.full_name || 'Agent Name'
  const displayTitle = formData.title || profile?.title || 'Real Estate Agent'
  const displayPhone = formData.phone || profile?.phone || ''
  const displayEmail = profile?.email || ''
  const displayLicense = profile?.license_number || ''
  const displayAvatar = profile?.avatar_url || ''
  const displayWebsite = formData.website || ''
  const displayInstagram = formData.instagram_handle || ''
  const displayFacebook = formData.facebook_url || ''
  const displayLinkedin = formData.linkedin_url || ''
  const displayTiktok = formData.tiktok_handle || ''

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#050507]">
        <div className="animate-spin h-8 w-8 border-2 border-[#C9A84C] border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-[#050507]">
      <SidebarNav onSignOut={signOut} userName={profile?.full_name || user?.email || ''} role={role || ''} />

      <main className="flex-1 overflow-y-auto p-8">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold text-white mb-2">My Business Card</h1>
          <p className="text-gray-400 mb-8">Share your digital card with clients to connect instantly</p>

          {/* === CARD PREVIEW === */}
          <div className="flex justify-center mb-8">
            <div className="w-[420px] bg-[#0a0a0f] rounded-xl shadow-2xl overflow-hidden">
              {/* Gold top bar */}
              <div className="h-2 bg-[#C9A84C]" />

              <div className="p-6 text-center">
                {/* Avatar */}
                {displayAvatar ? (
                  <img
                    src={displayAvatar}
                    alt={displayName}
                    className="w-20 h-20 rounded-full mx-auto mb-3 object-cover border-3 border-[#C9A84C]"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full mx-auto mb-3 bg-[#C9A84C] flex items-center justify-center">
                    <span className="text-2xl font-bold text-white">{getInitials(displayName)}</span>
                  </div>
                )}

                {/* Name & Title */}
                <h2 className="text-xl font-bold text-[#1a1a2e]">{displayName}</h2>
                <p className="text-sm text-[#C9A84C] font-medium mt-0.5">{displayTitle}</p>
                {displayLicense && (
                  <p className="text-xs text-gray-400 mt-1">License #{displayLicense}</p>
                )}

                {/* Contact */}
                <div className="mt-4 space-y-1">
                  {displayPhone && (
                    <p className="text-sm text-gray-200">{displayPhone}</p>
                  )}
                  <p className="text-sm text-gray-200">{displayEmail}</p>
                </div>

                {/* Social Icons */}
                {(displayInstagram || displayFacebook || displayLinkedin || displayTiktok || displayWebsite) && (
                  <div className="flex items-center justify-center gap-3 mt-4">
                    {displayInstagram && (
                      <a href={`https://instagram.com/${displayInstagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-[#C9A84C] transition">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                      </a>
                    )}
                    {displayFacebook && (
                      <a href={displayFacebook.startsWith('http') ? displayFacebook : `https://facebook.com/${displayFacebook}`} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-[#C9A84C] transition">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                      </a>
                    )}
                    {displayLinkedin && (
                      <a href={displayLinkedin.startsWith('http') ? displayLinkedin : `https://linkedin.com/in/${displayLinkedin}`} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-[#C9A84C] transition">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                      </a>
                    )}
                    {displayTiktok && (
                      <a href={`https://tiktok.com/@${displayTiktok.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-[#C9A84C] transition">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>
                      </a>
                    )}
                    {displayWebsite && (
                      <a href={displayWebsite.startsWith('http') ? displayWebsite : `https://${displayWebsite}`} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-[#C9A84C] transition">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
                      </a>
                    )}
                  </div>
                )}

                {/* QR Code */}
                <div className="mt-6">
                  {intakeUrl && (
                    <>
                      <img
                        src={qrUrl}
                        alt="QR Code"
                        className="w-[130px] h-[130px] mx-auto"
                      />
                      <p className="text-xs text-gray-400 mt-2">Scan to connect with me</p>
                    </>
                  )}
                </div>

                {/* Branding */}
                <div className="mt-6 pt-4 border-t border-[#1a1a2e]">
                  <p className="text-sm font-bold text-[#1a1a2e] tracking-wider">HARTFELT REAL ESTATE</p>
                  <p className="text-xs text-[#C9A84C] italic mt-0.5">Because Choices Matter</p>
                  <p className="text-xs text-gray-400 mt-2">hartfeltrealestate.com | @hartfeltrealestate</p>
                </div>
              </div>

              {/* Gold bottom bar */}
              <div className="h-2 bg-[#C9A84C]" />
            </div>
          </div>

          {/* === ACTION BUTTONS === */}
          <div className="flex flex-wrap justify-center gap-3 mb-10">
            <button
              onClick={handleCopyLink}
              className="px-5 py-2.5 bg-[#C9A84C] text-white font-medium rounded-lg hover:bg-[#b8963f] transition text-sm"
            >
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
            <button
              onClick={handleShareEmail}
              className="px-5 py-2.5 bg-[#0a0a1a] text-white font-medium rounded-lg border border-[#1a1a2e] hover:border-[#C9A84C] transition text-sm"
            >
              Share via Email
            </button>
            <button
              onClick={handleShareText}
              className="px-5 py-2.5 bg-[#0a0a1a] text-white font-medium rounded-lg border border-[#1a1a2e] hover:border-[#2EC4D6] transition text-sm"
            >
              Share via Text
            </button>
          </div>

          {/* === EDIT PROFILE SECTION === */}
          <div className="bg-[#0a0a1a] rounded-xl border border-[#1a1a2e] p-6">
            <h2 className="text-xl font-bold text-white mb-1">Edit Profile</h2>
            <p className="text-sm text-gray-400 mb-6">Changes update the card preview in real-time</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Title</label>
                <input
                  type="text"
                  value={formData.title || ''}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Realtor, Broker Associate"
                  className="w-full px-3 py-2 bg-[#050507] border border-[#1a1a2e] rounded-lg text-white text-sm focus:outline-none focus:border-[#C9A84C]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Phone</label>
                <input
                  type="tel"
                  value={formData.phone || ''}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="(555) 123-4567"
                  className="w-full px-3 py-2 bg-[#050507] border border-[#1a1a2e] rounded-lg text-white text-sm focus:outline-none focus:border-[#C9A84C]"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-400 mb-1">Bio</label>
                <textarea
                  value={formData.bio || ''}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  placeholder="A brief description about yourself..."
                  rows={3}
                  className="w-full px-3 py-2 bg-[#050507] border border-[#1a1a2e] rounded-lg text-white text-sm focus:outline-none focus:border-[#C9A84C] resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Website</label>
                <input
                  type="url"
                  value={formData.website || ''}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  placeholder="https://yoursite.com"
                  className="w-full px-3 py-2 bg-[#050507] border border-[#1a1a2e] rounded-lg text-white text-sm focus:outline-none focus:border-[#C9A84C]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Instagram Handle</label>
                <input
                  type="text"
                  value={formData.instagram_handle || ''}
                  onChange={(e) => setFormData({ ...formData, instagram_handle: e.target.value })}
                  placeholder="@yourhandle"
                  className="w-full px-3 py-2 bg-[#050507] border border-[#1a1a2e] rounded-lg text-white text-sm focus:outline-none focus:border-[#C9A84C]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Facebook URL</label>
                <input
                  type="text"
                  value={formData.facebook_url || ''}
                  onChange={(e) => setFormData({ ...formData, facebook_url: e.target.value })}
                  placeholder="https://facebook.com/yourpage"
                  className="w-full px-3 py-2 bg-[#050507] border border-[#1a1a2e] rounded-lg text-white text-sm focus:outline-none focus:border-[#C9A84C]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">LinkedIn URL</label>
                <input
                  type="text"
                  value={formData.linkedin_url || ''}
                  onChange={(e) => setFormData({ ...formData, linkedin_url: e.target.value })}
                  placeholder="https://linkedin.com/in/yourprofile"
                  className="w-full px-3 py-2 bg-[#050507] border border-[#1a1a2e] rounded-lg text-white text-sm focus:outline-none focus:border-[#C9A84C]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">TikTok Handle</label>
                <input
                  type="text"
                  value={formData.tiktok_handle || ''}
                  onChange={(e) => setFormData({ ...formData, tiktok_handle: e.target.value })}
                  placeholder="@yourhandle"
                  className="w-full px-3 py-2 bg-[#050507] border border-[#1a1a2e] rounded-lg text-white text-sm focus:outline-none focus:border-[#C9A84C]"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center gap-4">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2.5 bg-[#C9A84C] text-white font-medium rounded-lg hover:bg-[#b8963f] transition text-sm disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              {saveMessage && (
                <p className={`text-sm ${saveMessage.includes('Error') ? 'text-red-400' : 'text-green-400'}`}>
                  {saveMessage}
                </p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
