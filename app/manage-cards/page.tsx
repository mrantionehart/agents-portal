'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../providers'
import SidebarNav from '../components/SidebarNav'
import { supabase } from '@/lib/supabase'

interface AgentCard {
  id: string
  full_name: string
  email: string
  phone: string
  title: string
  role: string
  avatar_url: string | null
  business_card_url: string | null
  card_slug: string | null
  card_enabled: boolean
}

export default function ManageCardsPage() {
  const { user, role, loading, signOut } = useAuth()
  const router = useRouter()
  const [agents, setAgents] = useState<AgentCard[]>([])
  const [fetching, setFetching] = useState(true)
  const [uploading, setUploading] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && !user) router.push('/login')
    if (!loading && user && role !== 'broker' && role !== 'admin') router.push('/dashboard')
  }, [user, loading, role, router])

  useEffect(() => {
    if (user && (role === 'broker' || role === 'admin')) loadAgents()
  }, [user, role])

  const loadAgents = async () => {
    setFetching(true)
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, title, role, avatar_url, business_card_url, card_slug, card_enabled')
        .in('role', ['agent', 'broker'])
        .eq('is_active', true)
        .order('full_name')

      setAgents(data || [])
    } catch (e) {
      console.error('Error loading agents:', e)
    }
    setFetching(false)
  }

  const handleUploadClick = (agentId: string) => {
    setSelectedAgent(agentId)
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedAgent) return

    // Validate
    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.type)) {
      setMessage('Invalid file type. Use PNG, JPEG, or WebP.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage('File too large. Maximum 5MB.')
      return
    }

    setUploading(selectedAgent)
    setMessage('')

    try {
      // Upload to Supabase storage
      const ext = file.type.split('/')[1] === 'jpeg' ? 'jpg' : file.type.split('/')[1]
      const filePath = `${selectedAgent}/card.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('business-cards')
        .upload(filePath, file, { upsert: true })

      if (uploadError) {
        console.error('Upload error:', uploadError)
        setMessage('Upload failed. Try again.')
        setUploading(null)
        return
      }

      const { data: urlData } = supabase.storage
        .from('business-cards')
        .getPublicUrl(filePath)

      // Generate slug
      const agent = agents.find(a => a.id === selectedAgent)
      let slug = agent?.card_slug
      if (!slug && agent?.full_name) {
        slug = agent.full_name
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .trim()
      }

      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          business_card_url: urlData.publicUrl,
          card_slug: slug,
          card_enabled: true,
        })
        .eq('id', selectedAgent)

      if (updateError) {
        console.error('Profile update error:', updateError)
        setMessage('Upload succeeded but failed to update profile.')
      } else {
        setMessage(`Card uploaded for ${agent?.full_name}!`)
        loadAgents()
      }
    } catch (err) {
      console.error('Upload error:', err)
      setMessage('Something went wrong. Try again.')
    }

    setUploading(null)
    setSelectedAgent(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    setTimeout(() => setMessage(''), 4000)
  }

  const toggleCardEnabled = async (agentId: string, enabled: boolean) => {
    const { error } = await supabase
      .from('profiles')
      .update({ card_enabled: enabled })
      .eq('id', agentId)

    if (!error) {
      setAgents(prev =>
        prev.map(a => a.id === agentId ? { ...a, card_enabled: enabled } : a)
      )
    }
  }

  if (loading || fetching) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#050507]">
        <div className="animate-spin h-8 w-8 border-2 border-[#C9A84C] border-t-transparent rounded-full" />
      </div>
    )
  }

  const APP_URL = 'https://agents.hartfeltrealestate.com'

  return (
    <div className="flex min-h-screen bg-[#050507]">
      <SidebarNav onSignOut={signOut} userName={user?.email || ''} role={role || ''} />

      <main className="flex-1 overflow-y-auto p-8">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl font-bold text-white mb-2">Manage Business Cards</h1>
          <p className="text-gray-400 mb-8">Upload custom card images for your agents. Each agent gets a shareable public card page.</p>

          {message && (
            <div className={`mb-6 px-4 py-3 rounded-lg text-sm font-medium ${
              message.includes('failed') || message.includes('Invalid') || message.includes('large')
                ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                : 'bg-green-500/10 text-green-400 border border-green-500/20'
            }`}>
              {message}
            </div>
          )}

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {agents.map(agent => (
              <div
                key={agent.id}
                className="bg-[#0a0a1a] border border-[#1a1a2e] rounded-xl overflow-hidden"
              >
                {/* Card Image Preview */}
                {agent.business_card_url ? (
                  <div className="relative">
                    <img
                      src={agent.business_card_url}
                      alt={`${agent.full_name} card`}
                      className="w-full h-48 object-cover"
                    />
                    {!agent.card_enabled && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <span className="text-gray-300 text-sm font-medium bg-black/50 px-3 py-1 rounded">Disabled</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-48 bg-[#050507] flex items-center justify-center">
                    <div className="text-center">
                      <svg className="w-10 h-10 text-gray-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                        <path d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a1.5 1.5 0 001.5-1.5V5.25a1.5 1.5 0 00-1.5-1.5H3.75a1.5 1.5 0 00-1.5 1.5v14.25a1.5 1.5 0 001.5 1.5z"/>
                      </svg>
                      <p className="text-gray-500 text-xs">No card uploaded</p>
                    </div>
                  </div>
                )}

                {/* Agent Info */}
                <div className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    {agent.avatar_url ? (
                      <img src={agent.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-[#C9A84C] flex items-center justify-center">
                        <span className="text-xs font-bold text-white">
                          {(agent.full_name || '?').split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </span>
                      </div>
                    )}
                    <div>
                      <p className="text-white font-semibold text-sm">{agent.full_name}</p>
                      <p className="text-gray-400 text-xs">{agent.title || agent.role}</p>
                    </div>
                  </div>

                  {/* Card Link */}
                  {agent.card_slug && agent.card_enabled && (
                    <div className="mb-3 px-3 py-2 bg-[#050507] rounded-lg">
                      <p className="text-xs text-gray-400 mb-0.5">Public card URL</p>
                      <a
                        href={`${APP_URL}/card/${agent.card_slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[#C9A84C] hover:underline break-all"
                      >
                        {APP_URL}/card/{agent.card_slug}
                      </a>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleUploadClick(agent.id)}
                      disabled={uploading === agent.id}
                      className="flex-1 px-3 py-2 bg-[#C9A84C] text-white text-xs font-medium rounded-lg hover:bg-[#b8963f] transition disabled:opacity-50"
                    >
                      {uploading === agent.id ? 'Uploading...' : agent.business_card_url ? 'Replace Card' : 'Upload Card'}
                    </button>

                    {agent.business_card_url && (
                      <button
                        onClick={() => toggleCardEnabled(agent.id, !agent.card_enabled)}
                        className={`px-3 py-2 text-xs font-medium rounded-lg border transition ${
                          agent.card_enabled
                            ? 'border-red-500/30 text-red-400 hover:bg-red-500/10'
                            : 'border-green-500/30 text-green-400 hover:bg-green-500/10'
                        }`}
                      >
                        {agent.card_enabled ? 'Disable' : 'Enable'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {agents.length === 0 && (
            <div className="text-center py-16">
              <p className="text-gray-400">No agents found.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
