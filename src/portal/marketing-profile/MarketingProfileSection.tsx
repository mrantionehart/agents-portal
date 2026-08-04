'use client'

// ============================================================================
// Marketing Card — profile section (headshot + preferred public phone).
// ============================================================================
// Renders the agent's own canonical marketing-profile state from Vault: current
// headshot (or initials), canonical readiness + missing items, read-only card
// fields, self-service headshot upload, and preferred-public-phone edit. Readiness
// and capabilities are SERVER-owned — never recomputed here. Respects partial
// rollout (phone/upload capabilities are independent). No image bytes / display
// URLs / responses are persisted; local preview object URLs are always revoked.
import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, Loader2, CheckCircle, AlertCircle, Phone, IdCard, Mail } from 'lucide-react'
import {
  getMarketingProfile, updatePreferredPublicPhone, uploadAvatar,
  MarketingProfileError, NETWORK_ERROR_CODE, NON_CONTRACT_CODE,
} from './api'
import type { MarketingProfileState } from './types'

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const ACCEPT_ATTR = 'image/jpeg,image/png,image/webp'
const MAX_BYTES = 8 * 1024 * 1024 // mirror the Vault request bound; server is authoritative

const READINESS_LABEL: Record<string, string> = {
  ready_to_generate: 'Ready — your card can be generated',
  generated_awaiting_approval: 'Generated — awaiting broker approval',
  approved: 'Approved',
  needs_regeneration: 'Needs an update',
  awaiting_headshot: 'Add your headshot to continue',
  awaiting_preferred_phone: 'Add your public phone to continue',
  awaiting_provisioned_email: 'Your brokerage email is being set up',
  awaiting_license: 'Your license is being verified',
  license_not_eligible: 'License not currently eligible',
  not_ready: 'A few items are still needed',
}
const MISSING_LABEL: Record<string, string> = {
  headshot: 'Headshot',
  preferred_public_phone: 'Public phone',
  brokerage_email: 'Brokerage email',
  license_number: 'License number',
  name: 'Name',
  onboarding: 'Onboarding',
}

function friendlyError(code: string, status: number): string {
  if (code === NETWORK_ERROR_CODE) return 'Unable to connect to the profile service. Please try again.'
  if (code === NON_CONTRACT_CODE) return 'This is temporarily unavailable. Please try again.'
  switch (code) {
    case 'PROFILE_NOT_FOUND': return 'Your marketing profile is unavailable right now.'
    case 'NO_TENANT': return 'Your account is not fully configured yet.'
    case 'PHONE_INVALID': return 'Enter a valid phone number.'
    case 'PHONE_TOO_LONG': return 'That phone number is too long.'
    case 'AVATAR_UPLOAD_DISABLED': return "Photo upload isn't available yet."
    case 'PHONE_UPDATE_UNAVAILABLE': return "Updating your public phone isn't available yet."
    case 'AVATAR_MIME_UNSUPPORTED': return 'Use a JPEG, PNG, or WebP image.'
    case 'AVATAR_TOO_LARGE': return 'That image is too large (max 8 MB).'
    case 'RATE_LIMITED': return 'Too many attempts. Please try again shortly.'
    case 'AVATAR_INFRA_NOT_READY':
    case 'MARKETING_PROFILE_UNAVAILABLE': return 'This is temporarily unavailable. Please try again.'
    case 'UNAUTHENTICATED': return 'Your session expired. Please sign in again.'
    default:
      if (status === 413) return 'That image is too large (max 8 MB).'
      if (status === 415) return 'Use a JPEG, PNG, or WebP image.'
      if (status === 429) return 'Too many attempts. Please try again shortly.'
      if (status >= 500) return 'This is temporarily unavailable. Please try again.'
      return 'Something went wrong. Please try again.'
  }
}

function initials(name: string | null): string {
  return (name || '?').split(' ').map((n) => n[0]).filter(Boolean).join('').slice(0, 2).toUpperCase()
}

export default function MarketingProfileSection() {
  const [state, setState] = useState<MarketingProfileState | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [hidden, setHidden] = useState(false) // feature not present (404) → hide quietly

  // Avatar upload sub-state
  const fileInputRef = useRef<HTMLInputElement>(null)
  const previewUrlRef = useRef<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [imgFailed, setImgFailed] = useState(false)

  // Phone sub-state
  const [editingPhone, setEditingPhone] = useState(false)
  const [phoneInput, setPhoneInput] = useState('')
  const [savingPhone, setSavingPhone] = useState(false)
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [phoneSaved, setPhoneSaved] = useState(false)

  const revokePreview = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
      setPreviewUrl(null)
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const data = await getMarketingProfile()
      setState(data)
      setImgFailed(false)
    } catch (e) {
      const err = e as MarketingProfileError
      // Distinguish an UNDEPLOYED / absent route (a non-JSON platform 404 — the
      // response was not the Vault JSON contract) from a STRUCTURED Vault error.
      // Undeployed → hide this additive section quietly; the rest of the profile
      // page is unaffected and no disruptive global error is shown.
      if (err.contract === false && err.status === 404) { setHidden(true); return }
      // Everything else — a structured Vault error (including a JSON 404 with a
      // stable code), network/CORS, or 403/429/500/503 — renders a bounded,
      // retryable message. Raw response content is never surfaced.
      setLoadError(friendlyError(err.code, err.status))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])
  // Revoke any outstanding preview object URL on unmount.
  useEffect(() => () => revokePreview(), [revokePreview])

  // ── Avatar upload ──────────────────────────────────────────────────────────
  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    setUploadError(null)
    const file = e.target.files?.[0]
    if (fileInputRef.current) fileInputRef.current.value = '' // allow re-picking the same file
    if (!file) return
    if (file.size === 0) { setUploadError('That file is empty.'); return }
    if (!ACCEPTED_TYPES.includes(file.type)) { setUploadError('Use a JPEG, PNG, or WebP image.'); return }
    if (file.size > MAX_BYTES) { setUploadError('That image is too large (max 8 MB).'); return }
    revokePreview()
    const url = URL.createObjectURL(file)
    previewUrlRef.current = url
    setPreviewUrl(url)
    setPendingFile(file)
  }

  async function onSavePhoto() {
    if (!pendingFile) return
    setUploading(true)
    setUploadError(null)
    try {
      const fresh = await uploadAvatar(pendingFile)
      setState(fresh) // server-confirmed state (hasPhoto/displayUrl/readiness)
      setImgFailed(false)
      setPendingFile(null)
      revokePreview()
    } catch (e) {
      const err = e as MarketingProfileError
      // Upload failed → keep the previous avatar; show a bounded message.
      setUploadError(friendlyError(err.code, err.status))
    } finally {
      setUploading(false)
    }
  }

  function onCancelPhoto() {
    setPendingFile(null)
    setUploadError(null)
    revokePreview()
  }

  // ── Phone ────────────────────────────────────────────────────────────────
  function startEditPhone() {
    setPhoneInput(state?.profile.preferredPublicPhone ?? '')
    setPhoneError(null)
    setPhoneSaved(false)
    setEditingPhone(true)
  }
  async function onSavePhone() {
    setSavingPhone(true)
    setPhoneError(null)
    try {
      const trimmed = phoneInput.trim()
      const fresh = await updatePreferredPublicPhone(trimmed === '' ? null : trimmed)
      setState(fresh)
      setEditingPhone(false)
      setPhoneSaved(true)
    } catch (e) {
      const err = e as MarketingProfileError
      setPhoneError(friendlyError(err.code, err.status))
    } finally {
      setSavingPhone(false)
    }
  }

  if (hidden) return null

  if (loading) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-4" aria-busy="true">
        <div className="flex items-center gap-2 text-gray-400"><Loader2 className="w-4 h-4 animate-spin" /> Loading your marketing card…</div>
      </div>
    )
  }

  if (loadError || !state) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-4" role="alert" aria-live="polite">
        <div className="flex items-center gap-2 text-gray-300"><AlertCircle className="w-4 h-4 text-[#C9A84C]" /> {loadError ?? 'Unable to load your marketing card.'}</div>
        <button onClick={load} className="mt-2 text-sm text-[#C9A84C] hover:underline">Try again</button>
      </div>
    )
  }

  const { avatar, marketingCard, profile } = state
  const showPhoto = avatar.hasPhoto && avatar.displayUrl && !imgFailed
  const displaySrc = previewUrl || (showPhoto ? avatar.displayUrl : null)

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-5">
      <div className="flex items-center gap-2">
        <IdCard className="w-5 h-5 text-[#C9A84C]" />
        <h3 className="text-white font-semibold">Marketing Card</h3>
      </div>

      {/* Headshot */}
      <div className="flex items-start gap-4">
        {displaySrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={displaySrc}
            alt={`${profile.fullName ?? 'Agent'} headshot`}
            className="w-20 h-20 rounded-full object-cover border border-white/10"
            onError={() => { if (!previewUrl) setImgFailed(true) }}
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-[#C9A84C]/20 flex items-center justify-center border border-white/10" aria-label="No headshot">
            <span className="text-lg font-bold text-[#C9A84C]">{initials(profile.fullName)}</span>
          </div>
        )}

        <div className="flex-1 min-w-0">
          <p className="text-white font-medium truncate">{profile.fullName ?? '—'}</p>
          <p className="text-sm text-gray-400">{profile.cardTitle}</p>

          {avatar.uploadAvailable ? (
            <div className="mt-2">
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT_ATTR}
                className="sr-only"
                id="marketing-headshot-input"
                onChange={onPickFile}
              />
              {!pendingFile ? (
                <label
                  htmlFor="marketing-headshot-input"
                  className="inline-flex items-center gap-1.5 text-sm text-[#C9A84C] hover:underline cursor-pointer"
                >
                  <Camera className="w-4 h-4" /> {avatar.hasPhoto ? 'Replace photo' : 'Upload photo'}
                </label>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={onSavePhoto}
                    disabled={uploading}
                    className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-[#C9A84C] text-black font-medium disabled:opacity-60"
                    aria-live="polite"
                  >
                    {uploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><CheckCircle className="w-4 h-4" /> Save photo</>}
                  </button>
                  <button onClick={onCancelPhoto} disabled={uploading} className="text-sm text-gray-400 hover:text-white">Cancel</button>
                </div>
              )}
              <p className="mt-1 text-xs text-gray-500">JPEG, PNG, or WebP · up to 8 MB</p>
            </div>
          ) : (
            <p className="mt-2 text-xs text-gray-500">Photo upload isn’t available yet.</p>
          )}

          {uploadError && (
            <p className="mt-2 text-sm text-red-300 flex items-center gap-1.5" role="alert" aria-live="assertive">
              <AlertCircle className="w-4 h-4" /> {uploadError}
            </p>
          )}
        </div>
      </div>

      {/* Readiness */}
      <div>
        <p className="text-sm text-gray-300 flex items-center gap-1.5">
          <CheckCircle className="w-4 h-4 text-[#C9A84C]" />
          {READINESS_LABEL[marketingCard.readiness] ?? 'In progress'}
        </p>
        {marketingCard.missingRequirements.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Still needed">
            {marketingCard.missingRequirements.map((k) => (
              <span key={k} className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-gray-200 border border-white/10">
                {MISSING_LABEL[k] ?? k}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Read-only canonical fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-gray-500 flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> Brokerage email</span>
          <p className="text-gray-200 truncate">{profile.brokerageEmail ?? '—'}</p>
        </div>
        <div>
          <span className="text-gray-500 flex items-center gap-1"><IdCard className="w-3.5 h-3.5" /> License</span>
          <p className="text-gray-200 truncate">{profile.licenseNumber ?? '—'}</p>
        </div>
      </div>

      {/* Preferred public phone */}
      <div>
        <label className="text-gray-500 text-sm flex items-center gap-1" htmlFor="preferred-public-phone">
          <Phone className="w-3.5 h-3.5" /> Public phone
        </label>
        <p className="text-xs text-gray-500 mb-1">The number shown on your marketing materials.</p>
        {!editingPhone ? (
          <div className="flex items-center gap-3">
            <span className="text-gray-200">{profile.preferredPublicPhone ?? 'Not set'}</span>
            {marketingCard.phoneUpdateAvailable ? (
              <button onClick={startEditPhone} className="text-sm text-[#C9A84C] hover:underline">
                {profile.preferredPublicPhone ? 'Edit' : 'Add'}
              </button>
            ) : (
              <span className="text-xs text-gray-500">(not available yet)</span>
            )}
            {phoneSaved && <span className="text-xs text-green-400 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Saved</span>}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <input
              id="preferred-public-phone"
              type="tel"
              inputMode="tel"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              placeholder="(305) 555-1234"
              className="w-full sm:w-64 px-3 py-2 rounded-lg bg-black/20 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-[#C9A84C]/50"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={onSavePhone}
                disabled={savingPhone}
                className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-[#C9A84C] text-black font-medium disabled:opacity-60"
                aria-live="polite"
              >
                {savingPhone ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : 'Save'}
              </button>
              <button onClick={() => setEditingPhone(false)} disabled={savingPhone} className="text-sm text-gray-400 hover:text-white">Cancel</button>
              <span className="text-xs text-gray-500">Leave blank to clear.</span>
            </div>
            {phoneError && (
              <p className="text-sm text-red-300 flex items-center gap-1.5" role="alert" aria-live="assertive">
                <AlertCircle className="w-4 h-4" /> {phoneError}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
