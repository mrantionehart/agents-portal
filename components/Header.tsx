'use client'

import React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { LogOut, Menu, X } from 'lucide-react'
import { useState } from 'react'

export default function Header() {
  const { user, role, logout } = useAuth()
  const router = useRouter()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleLogout = async () => {
    try {
      await logout()
      router.push('/login')
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  if (!user) return null

  return (
    <header className="bg-[#0a0a0f] shadow-sm shadow-black/10 sticky top-0 z-50">
      <nav className="container flex items-center justify-between py-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">HF</span>
          </div>
          <span className="font-bold text-white hidden sm:inline">Hartfelt Portal</span>
        </Link>

        <div className="hidden md:flex items-center gap-6">
          {role === 'admin' || role === 'broker' ? (
            <>
              <Link href="/dashboard" className="text-gray-400 hover:text-white font-medium">
                Admin Dashboard
              </Link>
              <Link href="/agents" className="text-gray-400 hover:text-white font-medium">
                Agents
              </Link>
            </>
          ) : (
            <Link href="/dashboard" className="text-gray-400 hover:text-white font-medium">
              My Dashboard
            </Link>
          )}

          <Link href="/deals" className="text-gray-400 hover:text-white font-medium">
            Deals
          </Link>

          <Link href="/commissions" className="text-gray-400 hover:text-white font-medium">
            Commissions
          </Link>

          <Link href="/documents" className="text-gray-400 hover:text-white font-medium">
            Documents
          </Link>

          <div className="flex items-center gap-4 border-l pl-6">
            <div className="text-sm">
              <p className="text-white font-medium">{user.email}</p>
              <p className="text-gray-400 capitalize text-xs">{role}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-500/10 rounded-lg transition"
              title="Logout"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>

        <button
          className="md:hidden p-2 hover:bg-[#111] rounded-lg"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </nav>

      {mobileMenuOpen && (
        <div className="md:hidden border-t bg-[#0a0a0f]">
          <div className="container py-4 space-y-3">
            {role === 'admin' || role === 'broker' ? (
              <>
                <Link
                  href="/dashboard"
                  className="block text-gray-400 hover:text-white py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Admin Dashboard
                </Link>
                <Link
                  href="/agents"
                  className="block text-gray-400 hover:text-white py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Agents
                </Link>
              </>
            ) : (
              <Link
                href="/dashboard"
                className="block text-gray-400 hover:text-white py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                My Dashboard
              </Link>
            )}

            <Link
              href="/deals"
              className="block text-gray-400 hover:text-white py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Deals
            </Link>

            <Link
              href="/commissions"
              className="block text-gray-400 hover:text-white py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Commissions
            </Link>

            <Link
              href="/documents"
              className="block text-gray-400 hover:text-white py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Documents
            </Link>

            <button
              onClick={() => {
                handleLogout()
                setMobileMenuOpen(false)
              }}
              className="w-full text-left text-red-600 hover:bg-red-500/10 py-2 px-2 rounded"
            >
              Logout
            </button>
          </div>
        </div>
      )}
    </header>
  )
}
