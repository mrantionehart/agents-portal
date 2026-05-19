'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

interface CardData {
  name: string
  title: string
  email: string
  phone: string
  bio: string
  avatar_url: string
  card_image_url: string
  slug: string
  social: {
    website: string
    instagram: string
    facebook: string
    linkedin: string
    tiktok: string
  }
}

export default function PublicCardPage() {
  const params = useParams()
  const slug = params?.slug as string
  const [card, setCard] = useState<CardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (slug) fetchCard()
  }, [slug])

  const fetchCard = async () => {
    try {
      const res = await fetch(`/api/card/${slug}`)
      if (!res.ok) {
        setNotFound(true)
        setLoading(false)
        return
      }
      const json = await res.json()
      if (json.success) {
        setCard(json.data)
      } else {
        setNotFound(true)
      }
    } catch {
      setNotFound(true)
    }
    setLoading(false)
  }

  const shareUrl = typeof window !== 'undefined' ? window.location.href : ''
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(shareUrl)}&bgcolor=0A0A0B&color=C9A84C`

  const handleSaveContact = () => {
    if (!card) return
    const vcard = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${card.name}`,
      `TITLE:${card.title}`,
      `ORG:HartFelt Real Estate`,
      card.email ? `EMAIL:${card.email}` : '',
      card.phone ? `TEL:${card.phone}` : '',
      card.social?.website ? `URL:${card.social.website}` : '',
      `NOTE:${card.bio || ''}`,
      'END:VCARD',
    ].filter(Boolean).join('\n')

    const blob = new Blob([vcard], { type: 'text/vcard' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${card.name.replace(/\s+/g, '_')}.vcf`
    a.click()
    URL.revokeObjectURL(url)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050507] flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-[#C9A84C] border-t-transparent rounded-full" />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-[#050507] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-2">Card Not Found</h1>
          <p className="text-gray-400">This business card is not available.</p>
        </div>
      </div>
    )
  }

  if (!card) return null

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div className="min-h-screen bg-[#050507] flex flex-col items-center justify-center p-4">
      {/* Card Container */}
      <div className="w-full max-w-md">
        {/* If custom card image exists, show it prominently */}
        {card.card_image_url ? (
          <div className="mb-6">
            <img
              src={card.card_image_url}
              alt={`${card.name} Business Card`}
              className="w-full rounded-xl shadow-2xl"
            />
          </div>
        ) : (
          /* Fallback: generated digital card */
          <div className="bg-[#0a0a0f] rounded-xl shadow-2xl overflow-hidden mb-6">
            <div className="h-2 bg-[#C9A84C]" />
            <div className="p-8 text-center">
              {card.avatar_url ? (
                <img
                  src={card.avatar_url}
                  alt={card.name}
                  className="w-24 h-24 rounded-full mx-auto mb-4 object-cover border-3 border-[#C9A84C]"
                />
              ) : (
                <div className="w-24 h-24 rounded-full mx-auto mb-4 bg-[#C9A84C] flex items-center justify-center">
                  <span className="text-3xl font-bold text-white">{getInitials(card.name)}</span>
                </div>
              )}
              <h1 className="text-2xl font-bold text-white">{card.name}</h1>
              <p className="text-[#C9A84C] font-medium mt-1">{card.title}</p>
              {card.bio && <p className="text-gray-400 text-sm mt-3 max-w-xs mx-auto">{card.bio}</p>}
            </div>
            <div className="h-2 bg-[#C9A84C]" />
          </div>
        )}

        {/* Contact Actions */}
        <div className="space-y-3 mb-6">
          {card.phone && (
            <a
              href={`tel:${card.phone}`}
              className="flex items-center gap-3 w-full px-5 py-3.5 bg-[#0a0a1a] border border-[#1a1a2e] rounded-xl text-white hover:border-[#C9A84C] transition"
            >
              <svg className="w-5 h-5 text-[#C9A84C]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
              </svg>
              <div>
                <p className="text-sm font-medium">Call</p>
                <p className="text-xs text-gray-400">{card.phone}</p>
              </div>
            </a>
          )}

          {card.email && (
            <a
              href={`mailto:${card.email}`}
              className="flex items-center gap-3 w-full px-5 py-3.5 bg-[#0a0a1a] border border-[#1a1a2e] rounded-xl text-white hover:border-[#C9A84C] transition"
            >
              <svg className="w-5 h-5 text-[#C9A84C]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
              </svg>
              <div>
                <p className="text-sm font-medium">Email</p>
                <p className="text-xs text-gray-400">{card.email}</p>
              </div>
            </a>
          )}

          {card.phone && (
            <a
              href={`sms:${card.phone}`}
              className="flex items-center gap-3 w-full px-5 py-3.5 bg-[#0a0a1a] border border-[#1a1a2e] rounded-xl text-white hover:border-[#C9A84C] transition"
            >
              <svg className="w-5 h-5 text-[#C9A84C]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
              </svg>
              <div>
                <p className="text-sm font-medium">Text</p>
                <p className="text-xs text-gray-400">{card.phone}</p>
              </div>
            </a>
          )}

          <button
            onClick={handleSaveContact}
            className="flex items-center gap-3 w-full px-5 py-3.5 bg-[#C9A84C] rounded-xl text-white hover:bg-[#b8963f] transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
            </svg>
            <p className="text-sm font-medium">{saved ? 'Contact Saved!' : 'Save Contact'}</p>
          </button>
        </div>

        {/* Social Links */}
        {(card.social?.instagram || card.social?.facebook || card.social?.linkedin || card.social?.tiktok || card.social?.website) && (
          <div className="flex items-center justify-center gap-4 mb-6">
            {card.social.instagram && (
              <a href={`https://instagram.com/${card.social.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-[#0a0a1a] border border-[#1a1a2e] rounded-full flex items-center justify-center text-gray-400 hover:text-[#C9A84C] hover:border-[#C9A84C] transition">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
              </a>
            )}
            {card.social.facebook && (
              <a href={card.social.facebook.startsWith('http') ? card.social.facebook : `https://facebook.com/${card.social.facebook}`} target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-[#0a0a1a] border border-[#1a1a2e] rounded-full flex items-center justify-center text-gray-400 hover:text-[#C9A84C] hover:border-[#C9A84C] transition">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              </a>
            )}
            {card.social.linkedin && (
              <a href={card.social.linkedin.startsWith('http') ? card.social.linkedin : `https://linkedin.com/in/${card.social.linkedin}`} target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-[#0a0a1a] border border-[#1a1a2e] rounded-full flex items-center justify-center text-gray-400 hover:text-[#C9A84C] hover:border-[#C9A84C] transition">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
              </a>
            )}
            {card.social.tiktok && (
              <a href={`https://tiktok.com/@${card.social.tiktok.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-[#0a0a1a] border border-[#1a1a2e] rounded-full flex items-center justify-center text-gray-400 hover:text-[#C9A84C] hover:border-[#C9A84C] transition">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>
              </a>
            )}
            {card.social.website && (
              <a href={card.social.website.startsWith('http') ? card.social.website : `https://${card.social.website}`} target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-[#0a0a1a] border border-[#1a1a2e] rounded-full flex items-center justify-center text-gray-400 hover:text-[#C9A84C] hover:border-[#C9A84C] transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
              </a>
            )}
          </div>
        )}

        {/* QR Code */}
        <div className="bg-[#0a0a1a] border border-[#1a1a2e] rounded-xl p-6 text-center mb-6">
          <p className="text-sm text-gray-400 mb-3">Scan to share this card</p>
          <img
            src={qrUrl}
            alt="QR Code"
            className="w-[160px] h-[160px] mx-auto rounded-lg"
          />
        </div>

        {/* Branding Footer */}
        <div className="text-center py-4">
          <p className="text-sm font-bold text-white tracking-wider">HARTFELT REAL ESTATE</p>
          <p className="text-xs text-[#C9A84C] italic mt-0.5">Because Choices Matter</p>
          <a href="https://hartfeltrealestate.com" target="_blank" rel="noopener noreferrer" className="text-xs text-gray-500 mt-2 block hover:text-[#C9A84C] transition">
            hartfeltrealestate.com
          </a>
        </div>
      </div>
    </div>
  )
}
