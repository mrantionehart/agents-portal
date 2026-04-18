'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '../providers'
import Link from 'next/link'
import { Users, MapPin, DollarSign, TrendingUp, AlertCircle } from 'lucide-react'
import { useState } from 'react'

interface Opportunity {
  id: number
  title: string
  type: string
  location: string
  description: string
  investmentRange: string
  daysPosted: number
  postedBy: string
}

export default function OpportunitiesPage() {
  const { user, role, loading, signOut } = useAuth()
  const router = useRouter()

  // Role-based access: broker and admin can view opportunities
  const isUnlocked = role === 'broker' || role === 'admin'

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  if (!user) {
    return null
  }

  // Opportunities loaded from API — empty until real data is connected
  const opportunities: Opportunity[] = []

  const getOpportunityIcon = (type: string) => {
    switch (type) {
      case 'Exclusive Deal':
        return 'text-red-600'
      case 'Development Opportunity':
        return 'text-blue-600'
      case 'Investment Property':
        return 'text-green-600'
      case 'Partnership Opportunity':
        return 'text-purple-600'
      default:
        return 'text-gray-600'
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'Exclusive Deal':
        return 'bg-red-100 text-red-800'
      case 'Development Opportunity':
        return 'bg-blue-100 text-blue-800'
      case 'Investment Property':
        return 'bg-green-100 text-green-800'
      case 'Partnership Opportunity':
        return 'bg-purple-100 text-purple-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-blue-600 hover:text-blue-700 font-medium">
              ← Dashboard
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Private Opportunities</h1>
          </div>
          <button
            onClick={handleSignOut}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        {!isUnlocked ? (
          // Locked State — agents without broker/admin role
          <div className="flex items-center justify-center py-24">
            <div className="bg-white rounded-lg shadow p-12 max-w-md w-full text-center">
              <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-3">Private Opportunities</h2>
              <p className="text-gray-600 mb-8">
                This section contains exclusive off-market deals and development opportunities within the HartFelt network. Only brokers and admins can access this page.
              </p>
              <Link
                href="/dashboard"
                className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-medium"
              >
                Back to Dashboard
              </Link>
            </div>
          </div>
        ) : (
          // Unlocked State
          <div>
            <div className="mb-8">
              <p className="text-gray-600 text-lg">
                Access exclusive off-market deals and development opportunities shared within the HartFelt network. These opportunities are curated for qualified investors and agents looking to expand their portfolios.
              </p>
            </div>

            {/* Opportunities Grid */}
            {opportunities.length > 0 ? (
              <div className="space-y-4">
                {opportunities.map((opp) => (
                  <div
                    key={opp.id}
                    className="bg-white rounded-lg shadow hover:shadow-lg transition overflow-hidden border-l-4 border-blue-500"
                  >
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-xl font-bold text-gray-900">{opp.title}</h3>
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getTypeColor(opp.type)}`}>
                              {opp.type}
                            </span>
                          </div>
                          <p className="text-gray-600 mb-3">{opp.description}</p>
                        </div>
                        <Users className={`w-10 h-10 flex-shrink-0 ${getOpportunityIcon(opp.type)}`} />
                      </div>

                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-600">{opp.location}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-gray-400" />
                          <span className="text-sm font-medium text-gray-900">{opp.investmentRange}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-600">{opp.daysPosted} days ago</span>
                        </div>
                      </div>

                      <div className="border-t border-gray-200 pt-4 flex items-center justify-between">
                        <span className="text-sm text-gray-500">Posted by {opp.postedBy}</span>
                        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm font-medium">
                          View Details
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 font-medium mb-2">No opportunities posted yet.</p>
                <p className="text-gray-500 text-sm">Check back soon or contact your broker.</p>
              </div>
            )}

            {/* Submit Opportunity Button */}
            <div className="mt-12 text-center">
              <button className="bg-green-600 text-white px-8 py-3 rounded-lg hover:bg-green-700 transition font-medium">
                Submit Opportunity
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
