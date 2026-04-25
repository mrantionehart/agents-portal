'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Mail, RefreshCw, Trash2, Settings, Link2,
  CheckCircle, AlertCircle, Loader2, ExternalLink,
} from 'lucide-react'

// ─── Constants ───────────────────────────────────────────────────────────────────
const VAULT_API = 'https://hartfelt-vault.vercel.app/api'

// ─── Inline UI primitives (matches CRM page style) ──────────────────────────────
const Card = ({ children, className = '', ...props }: any) => (
  <div className={`rounded-lg border border-[#1a1a2e] bg-[#0a0a0f] shadow-sm shadow-black/10 ${className}`} {...props}>{children}</div>
)
const CardHeader = ({ children, className = '', ...props }: any) => (
  <div className={`p-6 pb-2 ${className}`} {...props}>{children}</div>
)
const CardTitle = ({ children, className = '', ...props }: any) => (
  <h3 className={`text-lg font-semibold leading-none tracking-tight ${className}`} {...props}>{children}</h3>
)
const CardContent = ({ children, className = '', ...props }: any) => (
  <div className={`p-6 pt-2 ${className}`} {...props}>{children}</div>
)
const Button = ({ children, className = '', variant = 'default', size = 'default', disabled, ...props }: any) => {
  const base = 'inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none disabled:opacity-50 disabled:pointer-events-none'
  const variants: Record<string, string> = {
    default: 'bg-[#C9A84C] text-black hover:bg-[#b8973f]',
    outline: 'border border-[#1a1a2e] bg-[#0a0a0f] hover:bg-[#111] text-gray-200',
    ghost: 'hover:bg-[#111] text-gray-200',
    destructive: 'bg-red-600 text-white hover:bg-red-700',
  }
  const sizes: Record<string, string> = {
    default: 'h-10 px-4 py-2 text-sm',
    sm: 'h-8 px-3 text-xs',
    lg: 'h-12 px-6 text-base',
    icon: 'h-10 w-10',
  }
  return <button className={`${base} ${variants[variant] || variants.default} ${sizes[size] || sizes.default} ${className}`} disabled={disabled} {...props}>{children}</button>
}

// ─── Types ───────────────────────────────────────────────────────────────────────
interface EmailConnection {
  id?: string
  provider: 'gmail' | 'outlook'
  email: string
  connected_at?: string
  last_sync?: string
  status?: string
}

interface ConnectionStatus {
  connections: EmailConnection[]
  hasGmail: boolean
  hasOutlook: boolean
}

// ─── Provider helpers ────────────────────────────────────────────────────────────
function providerIcon(provider: string) {
  if (provider === 'gmail') {
    return (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
        <path d="M22 6L12 13L2 6V4l10 7 10-7v2z" fill="#EA4335" />
        <path d="M2 6v12h4V10l6 4.5L18 10v8h4V6l-10 7.5L2 6z" fill="#4285F4" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
      <rect x="2" y="4" width="20" height="16" rx="2" fill="#0078D4" />
      <path d="M2 7l10 6 10-6" stroke="white" strokeWidth="1.5" fill="none" />
    </svg>
  )
}

function providerLabel(provider: string) {
  return provider === 'gmail' ? 'Gmail' : 'Outlook'
}

function formatDate(dateStr: string | undefined) {
  if (!dateStr) return 'Never'
  const d = new Date(dateStr)
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

// ─── Page Component ──────────────────────────────────────────────────────────────
export default function EmailSettingsPage() {
  const [status, setStatus] = useState<ConnectionStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)

  const fetchStatus = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch(`${VAULT_API}/crm/email/status`)
      if (!res.ok) throw new Error(`Status ${res.status}`)
      const data: ConnectionStatus = await res.json()
      setStatus(data)
    } catch (err: any) {
      console.error('Failed to fetch email status:', err)
      setError(err.message || 'Failed to load email connection status')
      setStatus({ connections: [], hasGmail: false, hasOutlook: false })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchStatus() }, [fetchStatus])

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await fetch(`${VAULT_API}/crm/email/sync`, { method: 'POST' })
      if (!res.ok) throw new Error(`Sync failed (${res.status})`)
      await fetchStatus()
    } catch (err: any) {
      setError(err.message || 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  const handleDisconnect = async (provider: string) => {
    if (!confirm(`Disconnect ${providerLabel(provider)}? You can reconnect later.`)) return
    setDisconnecting(provider)
    try {
      const res = await fetch(`${VAULT_API}/crm/email/status`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      })
      if (!res.ok) throw new Error(`Disconnect failed (${res.status})`)
      await fetchStatus()
    } catch (err: any) {
      setError(err.message || 'Disconnect failed')
    } finally {
      setDisconnecting(null)
    }
  }

  const handleConnect = (provider: 'gmail' | 'outlook') => {
    window.open(`${VAULT_API}/crm/email/connect/${provider}`, '_blank')
  }

  return (
    <div className="min-h-screen bg-[#050507] text-white">
      {/* Header */}
      <div className="border-b border-[#1a1a2e] bg-[#0a0a0f]/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-3xl mx-auto flex items-center gap-4 px-6 py-4">
          <Link href="/crm" className="rounded-lg p-2 text-gray-400 transition hover:bg-white/5 hover:text-white">
            <ArrowLeft size={20} />
          </Link>
          <div className="flex items-center gap-2.5">
            <Settings className="w-5 h-5 text-[#C9A84C]" />
            <h1 className="text-lg font-semibold text-white">Email Settings</h1>
          </div>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing || loading}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Now'}
          </Button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {/* Error Banner */}
        {error && (
          <div className="flex items-center gap-3 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
            <AlertCircle size={16} className="shrink-0" />
            {error}
          </div>
        )}

        {/* Connected Accounts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Link2 className="w-5 h-5 text-[#C9A84C]" />
              Connected Accounts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2].map(i => (
                  <div key={i} className="animate-pulse rounded-lg border border-[#1a1a2e] bg-[#050507] p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#1a1a2e]" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-40 bg-[#1a1a2e] rounded" />
                        <div className="h-3 w-24 bg-[#1a1a2e] rounded" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : status?.connections && status.connections.length > 0 ? (
              <div className="space-y-3">
                {status.connections.map((conn, idx) => (
                  <div
                    key={conn.id || idx}
                    className="flex items-center gap-4 rounded-lg border border-[#1a1a2e] bg-[#050507] p-4 transition hover:border-[#C9A84C]/20"
                  >
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[#1a1a2e]">
                      {providerIcon(conn.provider)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white truncate">{conn.email}</span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 border border-green-500/20 px-2 py-0.5 text-[10px] font-medium text-green-400">
                          <CheckCircle size={10} /> Connected
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-gray-500">{providerLabel(conn.provider)}</span>
                        <span className="text-xs text-gray-600">Last sync: {formatDate(conn.last_sync)}</span>
                      </div>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDisconnect(conn.provider)}
                      disabled={disconnecting === conn.provider}
                    >
                      {disconnecting === conn.provider ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <><Trash2 size={14} className="mr-1" /> Disconnect</>
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Mail className="w-10 h-10 mx-auto mb-3 text-gray-600" />
                <p className="text-sm text-gray-400 mb-1">No email accounts connected</p>
                <p className="text-xs text-gray-600">Connect Gmail or Outlook below to sync your inbox.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Connect New Account */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Mail className="w-5 h-5 text-[#C9A84C]" />
              Connect Email Account
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-gray-500 mb-4">
              Link your email to sync messages into Smart Inbox and send replies directly from the CRM.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Gmail */}
              <button
                onClick={() => handleConnect('gmail')}
                disabled={status?.hasGmail}
                className={`flex items-center gap-3 rounded-lg border p-4 transition ${
                  status?.hasGmail
                    ? 'border-[#1a1a2e] bg-[#050507] opacity-50 cursor-not-allowed'
                    : 'border-[#1a1a2e] bg-[#050507] hover:border-[#C9A84C]/30 hover:bg-[#0f0f14] cursor-pointer'
                }`}
              >
                {providerIcon('gmail')}
                <div className="text-left flex-1">
                  <span className="text-sm font-medium text-white">
                    {status?.hasGmail ? 'Gmail Connected' : 'Connect Gmail'}
                  </span>
                  <p className="text-[10px] text-gray-500 mt-0.5">Google Workspace &amp; Gmail</p>
                </div>
                {!status?.hasGmail && <ExternalLink size={14} className="text-gray-500" />}
                {status?.hasGmail && <CheckCircle size={14} className="text-green-400" />}
              </button>

              {/* Outlook */}
              <button
                onClick={() => handleConnect('outlook')}
                disabled={status?.hasOutlook}
                className={`flex items-center gap-3 rounded-lg border p-4 transition ${
                  status?.hasOutlook
                    ? 'border-[#1a1a2e] bg-[#050507] opacity-50 cursor-not-allowed'
                    : 'border-[#1a1a2e] bg-[#050507] hover:border-[#C9A84C]/30 hover:bg-[#0f0f14] cursor-pointer'
                }`}
              >
                {providerIcon('outlook')}
                <div className="text-left flex-1">
                  <span className="text-sm font-medium text-white">
                    {status?.hasOutlook ? 'Outlook Connected' : 'Connect Outlook'}
                  </span>
                  <p className="text-[10px] text-gray-500 mt-0.5">Microsoft 365 &amp; Outlook</p>
                </div>
                {!status?.hasOutlook && <ExternalLink size={14} className="text-gray-500" />}
                {status?.hasOutlook && <CheckCircle size={14} className="text-green-400" />}
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Info Card */}
        <div className="rounded-lg border border-[#1a1a2e] bg-[#0a0a0f]/50 p-4">
          <p className="text-xs text-gray-500 leading-relaxed">
            Email connections are managed securely through OAuth. Your credentials are never stored.
            Connected accounts sync automatically every 15 minutes, or use Sync Now for immediate updates.
          </p>
        </div>
      </div>
    </div>
  )
}
